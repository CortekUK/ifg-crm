'use client'

// Super_admin OpenAI Usage dashboard. Reads from /api/admin/openai-
// usage which aggregates the openai_usage_logs table (written by
// lib/ai/usage-logger.ts after every chat completion). Layout:
//   * Header — title + date range + Refresh
//   * 4 KPI cards (Total Spend, Total Calls, Total Tokens, Avg/Call)
//   * Failed-call warning banner (only when error_count > 0)
//   * Daily Spend bar chart
//   * By-feature table (calls / tokens / avg-per-call / errors / cost)

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  RefreshCcw,
  TriangleAlert,
  PoundSterling,
  Activity,
  Hash,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrentUser } from '@/lib/hooks/useCurrentUser'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'

type Range = '24h' | '7d' | '30d' | '90d'

interface UsageResponse {
  range: Range
  kpis: {
    totalSpend: number
    totalCalls: number
    totalTokens: number
    avgTokensPerCall: number
    errorCount: number
  }
  dailySpend: { date: string; spend: number }[]
  byFeature: {
    feature: string
    calls: number
    tokens: number
    avgPerCall: number
    errors: number
    cost: number
  }[]
}

function formatUsd(n: number): string {
  if (n === 0) return '$0.00'
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// Pleasant feature-name → tag colour. Falls back to slate.
function featureColor(feature: string): string {
  const COLORS = [
    'border-violet-500/40 bg-violet-500/10 text-violet-400',
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
    'border-blue-500/40 bg-blue-500/10 text-blue-400',
    'border-rose-500/40 bg-rose-500/10 text-rose-400',
    'border-amber-500/40 bg-amber-500/10 text-amber-400',
    'border-cyan-500/40 bg-cyan-500/10 text-cyan-400',
  ]
  let h = 0
  for (let i = 0; i < feature.length; i++) h = (h * 31 + feature.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

export default function OpenAIUsagePage() {
  const router = useRouter()
  const { data: currentUser, isLoading: userLoading } = useCurrentUser()
  const [range, setRange] = useState<Range>('7d')
  const [data, setData] = useState<UsageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Gate non-super_admin to /dashboard so this URL isn't a side-channel.
  useEffect(() => {
    if (!userLoading && currentUser && currentUser.role !== 'super_admin') {
      router.replace('/dashboard')
    }
  }, [userLoading, currentUser, router])

  const fetchUsage = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch(`/api/admin/openai-usage?range=${range}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const json = (await res.json()) as UsageResponse
      setData(json)
    } catch (e) {
      console.error('[openai-usage] fetch failed', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchUsage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  if (userLoading || (currentUser && currentUser.role !== 'super_admin')) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-md shadow-violet-500/30">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">OpenAI Usage</h1>
            <p className="text-sm text-muted-foreground">
              Per-call AI cost tracking across Scout, the template AI, and edge functions.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="h-9 w-[140px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsage(true)}
            disabled={refreshing}
            className="h-9"
          >
            {refreshing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total spend"
          value={data ? formatUsd(data.kpis.totalSpend) : '—'}
          icon={PoundSterling}
          accent="emerald"
          loading={loading}
        />
        <KpiCard
          title="Total calls"
          value={data ? data.kpis.totalCalls.toLocaleString() : '—'}
          icon={Activity}
          accent="blue"
          loading={loading}
        />
        <KpiCard
          title="Total tokens"
          value={data ? formatTokens(data.kpis.totalTokens) : '—'}
          icon={Hash}
          accent="violet"
          loading={loading}
        />
        <KpiCard
          title="Avg tokens / call"
          value={data ? data.kpis.avgTokensPerCall.toLocaleString() : '—'}
          icon={TrendingUp}
          accent="amber"
          loading={loading}
        />
      </div>

      {/* Failed-call warning */}
      {data && data.kpis.errorCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <span className="font-semibold text-amber-700 dark:text-amber-300">
              {data.kpis.errorCount} failed call{data.kpis.errorCount === 1 ? '' : 's'}
            </span>{' '}
            in this range. Errors still cost tokens — check the by-feature table for which integration is failing.
          </p>
        </div>
      )}

      {/* Daily spend chart */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Daily spend</h2>
          <p className="mb-4 text-xs text-muted-foreground">USD per day, computed from logged token counts.</p>
          <div className="h-[260px]">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : data && data.dailySpend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dailySpend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="#9CA3AF"
                    tickFormatter={(d: string) => {
                      // YYYY-MM-DD → "Mon DD"
                      const date = new Date(d)
                      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#9CA3AF"
                    tickFormatter={(v: number) => `$${v.toFixed(v < 1 ? 2 : 0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card, white)',
                      border: '1px solid var(--color-border, #E5E7EB)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value) => [
                      formatUsd(typeof value === 'number' ? value : 0),
                      'Spend',
                    ]}
                    labelFormatter={(label) => {
                      const date = new Date(String(label ?? ''))
                      if (Number.isNaN(date.getTime())) return String(label ?? '')
                      return date.toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                    }}
                  />
                  <Bar dataKey="spend" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No usage in this range yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* By-feature table */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">By feature</h2>
          <p className="mb-4 text-xs text-muted-foreground">Cost breakdown by calling code path. Click Refresh to pick up new entries.</p>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data || data.byFeature.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-muted-foreground dark:border-slate-700">
              No OpenAI calls have been logged in this range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground dark:border-slate-700">
                    <th className="px-3 py-2">Feature</th>
                    <th className="px-3 py-2 text-right">Calls</th>
                    <th className="px-3 py-2 text-right">Tokens</th>
                    <th className="px-3 py-2 text-right">Avg / call</th>
                    <th className="px-3 py-2 text-right">Errors</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byFeature.map((f) => (
                    <tr
                      key={f.feature}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'inline-block rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium',
                            featureColor(f.feature),
                          )}
                        >
                          {f.feature}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{f.calls.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatTokens(f.tokens)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {f.avgPerCall.toLocaleString()}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2.5 text-right tabular-nums',
                          f.errors > 0 ? 'text-rose-500' : 'text-muted-foreground/60',
                        )}
                      >
                        {f.errors === 0 ? '—' : f.errors}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                        {formatUsd(f.cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI card

function KpiCard({
  title,
  value,
  icon: Icon,
  accent,
  loading,
}: {
  title: string
  value: string
  icon: React.ElementType
  accent: 'emerald' | 'blue' | 'violet' | 'amber'
  loading?: boolean
}) {
  const a = {
    emerald: { tile: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400', border: 'border-l-emerald-500' },
    blue: { tile: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400', border: 'border-l-blue-500' },
    violet: { tile: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400', border: 'border-l-violet-500' },
    amber: { tile: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400', border: 'border-l-amber-500' },
  }[accent]
  return (
    <Card className={cn('border-l-4 bg-white shadow-sm dark:bg-slate-900', a.border)}>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <div className={cn('grid h-9 w-9 place-items-center rounded-lg', a.tile)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  )
}
