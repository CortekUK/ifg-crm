// GET /api/admin/openai-usage?range=7d
//
// Returns the aggregated OpenAI usage data the dashboard needs in a
// single payload:
//   {
//     range,
//     kpis: { totalSpend, totalCalls, totalTokens, avgTokensPerCall, errorCount },
//     dailySpend: [{ date, spend }, ...],
//     byFeature: [{ feature, calls, tokens, avgPerCall, errors, cost }, ...],
//   }
//
// Super_admin only — same access bar as the page.

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Range = '24h' | '7d' | '30d' | '90d'

function rangeStart(range: Range): Date {
  const now = new Date()
  const start = new Date(now)
  switch (range) {
    case '24h':
      start.setHours(now.getHours() - 24)
      break
    case '7d':
      start.setDate(now.getDate() - 7)
      break
    case '30d':
      start.setDate(now.getDate() - 30)
      break
    case '90d':
      start.setDate(now.getDate() - 90)
      break
  }
  return start
}

interface UsageRow {
  created_at: string
  feature: string
  total_tokens: number
  cost_usd: number | string
  error: string | null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'super_admin') {
    return Response.json({ error: 'Super_admin only' }, { status: 403 })
  }

  const rangeParam = (req.nextUrl.searchParams.get('range') ?? '7d') as Range
  const validRanges: Range[] = ['24h', '7d', '30d', '90d']
  const range: Range = validRanges.includes(rangeParam) ? rangeParam : '7d'

  const start = rangeStart(range)

  // Pull every row in range and aggregate in JS — fine up to ~100k
  // rows. When we outgrow that we'll move to a SQL-side aggregation
  // RPC, but this keeps the dashboard simple for now.
  const { data, error } = await supabase
    .from('openai_usage_logs')
    .select('created_at, feature, total_tokens, cost_usd, error')
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: true })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as UsageRow[]

  let totalSpend = 0
  let totalCalls = 0
  let totalTokens = 0
  let errorCount = 0

  // Daily-spend buckets keyed by YYYY-MM-DD.
  const daily: Record<string, number> = {}
  // By-feature aggregates.
  const byFeature: Record<
    string,
    { calls: number; tokens: number; errors: number; cost: number }
  > = {}

  for (const row of rows) {
    const cost = typeof row.cost_usd === 'string' ? parseFloat(row.cost_usd) : row.cost_usd
    totalSpend += cost
    totalCalls += 1
    totalTokens += row.total_tokens
    if (row.error) errorCount += 1

    const day = row.created_at.slice(0, 10) // YYYY-MM-DD
    daily[day] = (daily[day] ?? 0) + cost

    const f = row.feature
    if (!byFeature[f]) byFeature[f] = { calls: 0, tokens: 0, errors: 0, cost: 0 }
    byFeature[f].calls += 1
    byFeature[f].tokens += row.total_tokens
    byFeature[f].cost += cost
    if (row.error) byFeature[f].errors += 1
  }

  // Fill in empty days so the chart spans the whole range without gaps.
  const dailySpend: { date: string; spend: number }[] = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toISOString().slice(0, 10)
    dailySpend.push({ date: key, spend: Math.round((daily[key] ?? 0) * 1_000_000) / 1_000_000 })
    cursor.setDate(cursor.getDate() + 1)
  }

  const byFeatureArr = Object.entries(byFeature)
    .map(([feature, agg]) => ({
      feature,
      calls: agg.calls,
      tokens: agg.tokens,
      avgPerCall: agg.calls > 0 ? Math.round(agg.tokens / agg.calls) : 0,
      errors: agg.errors,
      cost: Math.round(agg.cost * 1_000_000) / 1_000_000,
    }))
    .sort((a, b) => b.cost - a.cost)

  return Response.json({
    range,
    kpis: {
      totalSpend: Math.round(totalSpend * 1_000_000) / 1_000_000,
      totalCalls,
      totalTokens,
      avgTokensPerCall: totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0,
      errorCount,
    },
    dailySpend,
    byFeature: byFeatureArr,
  })
}
