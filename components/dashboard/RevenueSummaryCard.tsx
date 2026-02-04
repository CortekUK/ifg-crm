'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { PoundSterling, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function RevenueSummaryCard() {
  const supabase = createClient()

  const { data, isLoading } = useQuery({
    queryKey: ['revenue-summary'],
    queryFn: async () => {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      // Deposits received this month
      const { data: thisMonthPayments } = await supabase
        .from('invoices')
        .select('amount')
        .eq('status', 'paid')
        .gte('paid_at', startOfMonth.toISOString())

      const depositsThisMonth = thisMonthPayments?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0

      // Deposits received last month
      const { data: lastMonthPayments } = await supabase
        .from('invoices')
        .select('amount')
        .eq('status', 'paid')
        .gte('paid_at', startOfLastMonth.toISOString())
        .lte('paid_at', endOfLastMonth.toISOString())

      const depositsLastMonth = lastMonthPayments?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0

      // Outstanding balance (unpaid invoices)
      const { data: unpaidInvoices } = await supabase
        .from('invoices')
        .select('amount')
        .in('status', ['sent', 'overdue'])

      const outstandingBalance = unpaidInvoices?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0

      // Overdue count
      const { count: overdueCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'overdue')

      const trend = depositsLastMonth > 0
        ? Math.round((depositsThisMonth - depositsLastMonth) / depositsLastMonth * 100)
        : 0

      return {
        depositsThisMonth,
        outstandingBalance,
        overdueCount: overdueCount || 0,
        trend,
      }
    },
    refetchInterval: 60000,
  })

  return (
    <Card className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-emerald-50 dark:from-emerald-900/20 to-transparent pointer-events-none" />

      <CardHeader className="relative z-10 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <PoundSterling className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <CardTitle className="font-oswald text-sm font-medium text-emerald-900 dark:text-emerald-300 uppercase">
            Revenue Summary
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 pt-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(data?.depositsThisMonth || 0)}
                </span>
                {data?.trend !== undefined && data.trend !== 0 && (
                  <div className={cn(
                    "flex items-center gap-0.5 text-sm font-medium",
                    data.trend > 0 ? "text-green-600" : "text-red-500"
                  )}>
                    {data.trend > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    <span>{data.trend > 0 ? '+' : ''}{data.trend}%</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">deposits this month</p>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Outstanding</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(data?.outstandingBalance || 0)}
                </span>
              </div>
              {data?.overdueCount && data.overdueCount > 0 ? (
                <Link
                  href="/invoices?status=overdue"
                  className="flex items-center justify-between group"
                >
                  <span className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Overdue invoices
                  </span>
                  <span className="text-sm font-medium text-red-600 dark:text-red-400 group-hover:underline">
                    {data.overdueCount}
                  </span>
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
