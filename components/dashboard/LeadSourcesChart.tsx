'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp } from 'lucide-react'

const sourceColours: Record<string, string> = {
  'google_ads': '#3b82f6',
  'instagram': '#ec4899',
  'email': '#10b981',
  'email_reply': '#10b981',
  'referral': '#f59e0b',
  'facebook': '#6366f1',
  'website': '#8b5cf6',
  'website_form': '#8b5cf6',
  'manual': '#6b7280',
  'Manual Entry': '#6b7280',
  'csv_import': '#f97316',
  'sms_reply': '#14b8a6',
  'tournament': '#eab308',
  'other': '#94a3b8',
}

const sourceLabels: Record<string, string> = {
  'google_ads': 'Google Ads',
  'instagram': 'Instagram',
  'email': 'Email',
  'email_reply': 'Email Reply',
  'referral': 'Referral',
  'facebook': 'Facebook',
  'website': 'Website',
  'website_form': 'Website Form',
  'manual': 'Manual Entry',
  'Manual Entry': 'Manual Entry',
  'csv_import': 'CSV Import',
  'sms_reply': 'SMS Reply',
  'tournament': 'Tournament',
  'other': 'Other',
}

interface SourceData {
  source: string
  count: number
  percentage: number
}

export function LeadSourcesChart() {
  const supabase = createClient()

  const { data, isLoading } = useQuery({
    queryKey: ['lead-sources'],
    queryFn: async () => {
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('source')

      if (error) throw error

      // Count by source
      const sourceCounts: Record<string, number> = {}
      contacts?.forEach((contact) => {
        const source = contact.source || 'other'
        sourceCounts[source] = (sourceCounts[source] || 0) + 1
      })

      const total = contacts?.length || 0

      // Convert to array and calculate percentages
      const sourceData: SourceData[] = Object.entries(sourceCounts)
        .map(([source, count]) => ({
          source,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5) // Top 5 sources

      return { sources: sourceData, total }
    },
    refetchInterval: 60000,
  })

  const maxCount = data?.sources?.[0]?.count || 1

  return (
    <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="font-oswald text-sm font-medium text-blue-900 dark:text-blue-300 uppercase">
            LEAD SOURCES BREAKDOWN
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Where your leads are coming from
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : data?.sources.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="p-3 rounded-full bg-slate-100 inline-block mb-2">
              <TrendingUp className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm">No lead source data</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data?.sources.map((source) => (
              <div key={source.source} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: sourceColours[source.source] || sourceColours.other }}
                    />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {sourceLabels[source.source] || source.source}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {source.count} ({source.percentage}%)
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(source.count / maxCount) * 100}%`,
                      backgroundColor: sourceColours[source.source] || sourceColours.other,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
