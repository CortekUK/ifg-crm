'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ReceiptPoundSterling,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  GitBranch,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/format'

interface DashboardStats {
  totalOutstanding: number
  totalPaid: number
  overdueCount: number
  nextDueDate: string | null
  currentStage: string | null
  pipelineName: string | null
}

interface Invoice {
  id: string
  invoice_number: string
  description: string
  amount: number
  currency: string
  status: string
  due_date: string
}

export default function PortalDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('contact_id')
        .eq('id', user.id)
        .single()

      if (!profile?.contact_id) return

      // Fetch invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, description, amount, currency, status, due_date')
        .eq('contact_id', profile.contact_id)
        .order('created_at', { ascending: false })

      const allInvoices = invoices || []

      // Calculate stats
      const outstanding = allInvoices
        .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
        .reduce((sum, i) => sum + Number(i.amount), 0)
      const paid = allInvoices
        .filter((i) => i.status === 'paid')
        .reduce((sum, i) => sum + Number(i.amount), 0)
      const overdue = allInvoices.filter((i) => i.status === 'overdue').length
      const unpaid = allInvoices
        .filter((i) => i.status !== 'paid' && i.status !== 'cancelled')
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

      // Fetch deal/pipeline info
      const { data: deals } = await supabase
        .from('deals')
        .select('current_stage_id, pipeline:pipelines(name), stage:pipeline_stages!deals_current_stage_id_fkey(name)')
        .eq('contact_id', profile.contact_id)
        .limit(1)
        .single()

      const stageData = deals?.stage as unknown as { name: string } | null
      const pipeData = deals?.pipeline as unknown as { name: string } | null
      const stageName = stageData?.name || null
      const pipeName = pipeData?.name || null

      setStats({
        totalOutstanding: outstanding,
        totalPaid: paid,
        overdueCount: overdue,
        nextDueDate: unpaid[0]?.due_date || null,
        currentStage: stageName,
        pipelineName: pipeName,
      })

      setRecentInvoices(allInvoices.slice(0, 3))
      setLoading(false)
    }

    fetchDashboard()
  }, [])

  const formatCurrency = (amount: number, currency = 'GBP') => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
  }

  const getPlayerStatus = (status: string) => {
    switch (status) {
      case 'paid':
        return { label: 'Paid', className: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' }
      case 'overdue':
        return { label: 'Overdue', className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' }
      case 'cancelled':
        return { label: 'Cancelled', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' }
      default:
        return { label: 'Unpaid', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' }
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your account overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Outstanding</span>
              <ReceiptPoundSterling className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(stats?.totalOutstanding || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Paid</span>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(stats?.totalPaid || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Overdue</span>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{stats?.overdueCount || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Stage</span>
              <GitBranch className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {stats?.currentStage || 'N/A'}
            </p>
            {stats?.pipelineName && (
              <p className="text-[10px] text-slate-400 truncate">{stats.pipelineName}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Next Due Date Banner */}
      {stats?.nextDueDate && (
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Next payment due</p>
                <p className="text-xs text-orange-600 dark:text-orange-400">{formatDate(stats.nextDueDate)}</p>
              </div>
            </div>
            <Link href="/portal/invoices">
              <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300">
                View
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Recent Invoices */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Invoices</h2>
          <Link href="/portal/invoices" className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentInvoices.length === 0 ? (
          <Card className="bg-white dark:bg-slate-900">
            <CardContent className="p-6 text-center">
              <ReceiptPoundSterling className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No invoices yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentInvoices.map((invoice) => (
              <Link key={invoice.id} href={`/portal/invoices/${invoice.id}`}>
                <Card className="bg-white dark:bg-slate-900 hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {invoice.invoice_number}
                        </span>
                        <Badge className={getPlayerStatus(invoice.status).className} variant="secondary">
                          {getPlayerStatus(invoice.status).label}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{invoice.description}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </p>
                      <p className="text-[10px] text-slate-400">Due {formatDate(invoice.due_date)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
