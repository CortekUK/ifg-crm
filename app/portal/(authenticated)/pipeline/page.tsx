'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2, Circle, Clock, GitBranch, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils'

interface Stage {
  id: string
  name: string
  display_order: number
}

interface Deal {
  id: string
  title: string
  current_stage_id: string
  pipeline_name: string
  stages: Stage[]
  created_at: string
}

interface StageHistoryEntry {
  id: string
  stage_id: string
  stage_name: string
  moved_at: string
}

export default function PortalPipelinePage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [stageHistory, setStageHistory] = useState<StageHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPipeline = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('contact_id')
        .eq('id', user.id)
        .single()

      if (!profile?.contact_id) return

      const { data: dealData } = await supabase
        .from('deals')
        .select('id, title, current_stage_id, pipeline_id, created_at, pipeline:pipelines(name)')
        .eq('contact_id', profile.contact_id)
        .order('created_at', { ascending: false })

      if (!dealData || dealData.length === 0) {
        setLoading(false)
        return
      }

      const dealsWithStages: Deal[] = []
      for (const deal of dealData) {
        const { data: stages } = await supabase
          .from('pipeline_stages')
          .select('id, name, display_order')
          .eq('pipeline_id', deal.pipeline_id)
          .order('display_order')

        dealsWithStages.push({
          id: deal.id,
          title: deal.title,
          current_stage_id: deal.current_stage_id,
          pipeline_name: (deal.pipeline as unknown as { name: string } | null)?.name || 'Pipeline',
          stages: stages || [],
          created_at: deal.created_at,
        })
      }

      setDeals(dealsWithStages)

      const dealIds = dealData.map((d) => d.id)
      const { data: history } = await supabase
        .from('deal_stage_history')
        .select('id, deal_id, stage_id, stage:pipeline_stages(name), moved_at')
        .in('deal_id', dealIds)
        .order('moved_at', { ascending: true })

      setStageHistory(
        (history || []).map((h) => ({
          id: h.id,
          stage_id: h.stage_id,
          stage_name: (h.stage as unknown as { name: string } | null)?.name || 'Unknown',
          moved_at: h.moved_at,
        }))
      )

      setLoading(false)
    }

    fetchPipeline()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (deals.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Application Status</h1>
        <Card className="bg-white dark:bg-slate-900">
          <CardContent className="p-8 text-center">
            <GitBranch className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <h3 className="text-base font-medium text-slate-900 dark:text-white mb-1">No active applications</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your application progress will appear here once you're enrolled in a programme.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Application Status</h1>

      {deals.map((deal) => {
        const currentIndex = deal.stages.findIndex((s) => s.id === deal.current_stage_id)
        const progressPercent = deal.stages.length > 1
          ? Math.round((currentIndex / (deal.stages.length - 1)) * 100)
          : currentIndex >= 0 ? 100 : 0

        return (
          <div key={deal.id} className="space-y-4">
            {/* Header Card with Progress */}
            <Card className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 border-0">
              <CardContent className="p-5 text-white">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h2 className="text-lg font-bold">{deal.title}</h2>
                    <p className="text-blue-200 text-sm">{deal.pipeline_name}</p>
                  </div>
                  <span className="text-3xl font-bold text-blue-200">{progressPercent}%</span>
                </div>
                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="w-full bg-blue-500/40 rounded-full h-2">
                    <div
                      className="bg-white h-2 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-[10px] text-blue-200">Started {formatDate(deal.created_at)}</span>
                    <span className="text-[10px] text-blue-200">
                      Step {currentIndex + 1} of {deal.stages.length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Desktop - Zigzag Lifecycle */}
            <div className="hidden md:block">
              {(() => {
                const cols = 4
                const rows: Stage[][] = []
                for (let i = 0; i < deal.stages.length; i += cols) {
                  const row = deal.stages.slice(i, i + cols)
                  // Reverse every other row for snake/zigzag effect
                  if (rows.length % 2 === 1) row.reverse()
                  rows.push(row)
                }

                return (
                  <div className="space-y-2">
                    {rows.map((row, rowIdx) => {
                      const isReversed = rowIdx % 2 === 1
                      return (
                        <div key={rowIdx} className="flex items-center gap-2">
                          {row.map((stage, colIdx) => {
                            const originalIndex = deal.stages.findIndex((s) => s.id === stage.id)
                            const isCompleted = originalIndex < currentIndex
                            const isCurrent = originalIndex === currentIndex
                            const isPending = originalIndex > currentIndex
                            const historyEntry = stageHistory.find((h) => h.stage_id === stage.id)

                            // Show connector arrow between items
                            const showConnector = colIdx < row.length - 1

                            return (
                              <div key={stage.id} className="contents">
                                <div className={cn(
                                  'flex-1 rounded-xl border p-4 transition-all h-[80px] flex items-center gap-3',
                                  isCurrent && 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 shadow-lg shadow-blue-500/15',
                                  isCompleted && 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20',
                                  isPending && 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-50'
                                )}>
                                  <div className={cn(
                                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                                    isCompleted && 'bg-green-500 text-white',
                                    isCurrent && 'bg-blue-600 text-white ring-4 ring-blue-200 dark:ring-blue-800',
                                    isPending && 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                                  )}>
                                    {isCompleted ? (
                                      <CheckCircle2 className="h-5 w-5" />
                                    ) : isCurrent ? (
                                      <Clock className="h-5 w-5" />
                                    ) : (
                                      <span className="text-xs font-bold">{originalIndex + 1}</span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 flex items-center justify-between">
                                    <div className="min-w-0">
                                      <p className={cn(
                                        'text-sm font-semibold truncate',
                                        isCompleted && 'text-green-700 dark:text-green-400',
                                        isCurrent && 'text-blue-700 dark:text-blue-300',
                                        isPending && 'text-slate-400'
                                      )}>
                                        {stage.name}
                                      </p>
                                      {historyEntry && (
                                        <p className="text-[10px] text-slate-400">{formatDate(historyEntry.moved_at)}</p>
                                      )}
                                    </div>
                                    {isCurrent && (
                                      <Badge className="bg-blue-600 text-white text-[10px] shrink-0">Current</Badge>
                                    )}
                                  </div>
                                </div>
                                {showConnector && (
                                  <ChevronRight className={cn(
                                    'h-4 w-4 shrink-0',
                                    isReversed ? 'rotate-180' : '',
                                    isCompleted ? 'text-green-400' : 'text-slate-300 dark:text-slate-600'
                                  )} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* Vertical Steps (Mobile) */}
            <div className="md:hidden space-y-0">
              {deal.stages.map((stage, index) => {
                const isCompleted = index < currentIndex
                const isCurrent = index === currentIndex
                const isPending = index > currentIndex
                const historyEntry = stageHistory.find((h) => h.stage_id === stage.id)

                return (
                  <div key={stage.id} className="flex">
                    {/* Timeline */}
                    <div className="flex flex-col items-center mr-4">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all',
                          isCompleted && 'bg-green-500 text-white',
                          isCurrent && 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/50',
                          isPending && 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : isCurrent ? (
                          <Clock className="h-5 w-5" />
                        ) : (
                          <span className="text-xs font-bold">{index + 1}</span>
                        )}
                      </div>
                      {index < deal.stages.length - 1 && (
                        <div className={cn(
                          'w-0.5 flex-1 min-h-[24px]',
                          index < currentIndex ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'
                        )} />
                      )}
                    </div>

                    {/* Content */}
                    <Card className={cn(
                      'flex-1 mb-3',
                      isCurrent ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-900',
                      isPending && 'opacity-50'
                    )}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={cn(
                              'text-sm font-semibold',
                              isCompleted && 'text-green-700 dark:text-green-400',
                              isCurrent && 'text-blue-700 dark:text-blue-300',
                              isPending && 'text-slate-500'
                            )}>
                              {stage.name}
                            </p>
                            {historyEntry && (
                              <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(historyEntry.moved_at)}</p>
                            )}
                          </div>
                          {isCurrent && (
                            <Badge className="bg-blue-600 text-white text-[10px] px-2 py-0.5">Current</Badge>
                          )}
                          {isCompleted && (
                            <Badge className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-[10px] px-2 py-0.5">Done</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
