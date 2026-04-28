'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ReceiptPoundSterling,
  CheckCircle2,
  Clock,
  CreditCard,
  CalendarDays,
  AlertTriangle,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface Invoice {
  id: string
  amount: number
  status: string
  currency: string
  due_date: string
  created_at: string
  type: string
}

interface Payment {
  id: string
  amount: number
  payment_date: string
  payment_method: string
}

interface PlayerAnalytics {
  invoices: Invoice[]
  payments: Payment[]
  accountCreated: string | null
}

const COLORS = ['#22c55e', '#f97316', '#ef4444', '#3b82f6', '#8b5cf6', '#64748b']

export default function PortalAnalyticsPage() {
  const [data, setData] = useState<PlayerAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('contact_id, guardian_for_contact_id, created_at')
        .eq('id', user.id)
        .single()

      const playerContactId =
        profile?.contact_id ?? profile?.guardian_for_contact_id ?? null
      if (!playerContactId) return

      const [invoicesRes, paymentsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, amount, status, currency, due_date, created_at, type')
          .eq('contact_id', playerContactId),
        supabase
          .from('payments')
          .select('id, amount, payment_date, payment_method')
          .eq('contact_id', playerContactId)
          .order('payment_date', { ascending: false }),
      ])

      setData({
        invoices: invoicesRes.data || [],
        payments: paymentsRes.data || [],
        accountCreated: profile?.created_at ?? null,
      })

      setLoading(false)
    }

    fetchAnalytics()
  }, [])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!data) return null

  // Derived stats
  const paidInvoices = data.invoices.filter((i) => i.status === 'paid')
  const pendingInvoices = data.invoices.filter((i) => ['sent', 'viewed'].includes(i.status))
  const overdueInvoices = data.invoices.filter((i) => i.status === 'overdue')
  const totalPaid = paidInvoices.reduce((sum, i) => sum + Number(i.amount), 0)
  const totalOutstanding = [...pendingInvoices, ...overdueInvoices].reduce((sum, i) => sum + Number(i.amount), 0)

  // Chart data: Invoice status breakdown
  const invoiceStatusData = [
    { name: 'Paid', value: paidInvoices.length, color: '#22c55e' },
    { name: 'Pending', value: pendingInvoices.length, color: '#f97316' },
    { name: 'Overdue', value: overdueInvoices.length, color: '#ef4444' },
    { name: 'Other', value: data.invoices.filter((i) => !['paid', 'sent', 'viewed', 'overdue'].includes(i.status)).length, color: '#64748b' },
  ].filter((d) => d.value > 0)

  // Chart data: Payments by month (last 6 months)
  const monthlyPayments: { month: string; amount: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    const total = data.payments
      .filter((p) => {
        const pd = new Date(p.payment_date)
        return pd >= monthStart && pd <= monthEnd
      })
      .reduce((sum, p) => sum + Number(p.amount), 0)
    monthlyPayments.push({ month: key, amount: total })
  }

  // Chart data: Invoice types breakdown
  const typeMap: Record<string, string> = {
    deposit: 'Deposit',
    installment: 'Installment',
    full_payment: 'Full Payment',
    meal_plan: 'Meal Plan',
    trip: 'Trip',
    other: 'Other',
  }
  const invoiceTypeData = Object.entries(
    data.invoices.reduce<Record<string, number>>((acc, inv) => {
      const label = typeMap[inv.type] || inv.type
      acc[label] = (acc[label] || 0) + Number(inv.amount)
      return acc
    }, {})
  ).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your financial statistics and payment overview</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Total Paid</span>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Outstanding</span>
              <Clock className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Overdue</span>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{overdueInvoices.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Invoices</span>
              <ReceiptPoundSterling className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{data.invoices.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment History Chart */}
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">Payment History</h3>
            {data.payments.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-slate-400">No payments yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyPayments}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `£${v}`} />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), 'Amount']}
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#60a5fa' }}
                  />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Invoice Status Pie Chart */}
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">Invoice Status</h3>
            {data.invoices.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-slate-400">No invoices yet</div>
            ) : (
              <div className="flex items-center">
                <ResponsiveContainer width="60%" height={200}>
                  <PieChart>
                    <Pie
                      data={invoiceStatusData}
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {invoiceStatusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 flex-1">
                  {invoiceStatusData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-xs text-slate-500 dark:text-slate-400">{entry.name}</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white ml-auto">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice by Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">Invoices by Type</h3>
            {invoiceTypeData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-slate-400">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={invoiceTypeData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `£${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" width={80} />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), 'Amount']}
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12 }}
                    itemStyle={{ color: '#60a5fa' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {invoiceTypeData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Total Payments</span>
              <CreditCard className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{data.payments.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Last Payment</span>
              <CreditCard className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {data.payments[0] ? formatDate(data.payments[0].payment_date) : 'None'}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">Member Since</span>
              <CalendarDays className="h-4 w-4 text-slate-400" />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {data.accountCreated ? formatDate(data.accountCreated) : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
