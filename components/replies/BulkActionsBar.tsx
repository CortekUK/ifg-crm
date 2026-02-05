'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2, Sparkles, X, CheckCircle, Users } from 'lucide-react'
import { usePipelines } from '@/lib/hooks/usePipelines'
import { cn } from '@/lib/utils'

interface BulkActionsBarProps {
  selectedCount: number
  positiveCount: number
  onApplyRecommendations: (pipelineId: string) => Promise<void>
  onClearSelection: () => void
  isProcessing: boolean
}

export function BulkActionsBar({
  selectedCount,
  positiveCount,
  onApplyRecommendations,
  onClearSelection,
  isProcessing,
}: BulkActionsBarProps) {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const { data: pipelines = [] } = usePipelines()
  const activePipelines = pipelines.filter((p) => p.is_active)

  const handleApply = async () => {
    if (!selectedPipelineId) return
    setShowConfirmDialog(false)
    await onApplyRecommendations(selectedPipelineId)
  }

  if (selectedCount === 0) return null

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
        <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-lg shadow-2xl px-4 py-3 flex items-center gap-4">
          {/* Selection Count */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-blue-600 text-white">
              {selectedCount}
            </Badge>
            <span className="text-sm">
              {selectedCount === 1 ? 'reply' : 'replies'} selected
            </span>
          </div>

          {/* Positive Count Indicator */}
          {positiveCount > 0 && (
            <div className="flex items-center gap-1.5 text-green-400 text-sm">
              <CheckCircle className="h-4 w-4" />
              <span>{positiveCount} positive</span>
            </div>
          )}

          {/* Divider */}
          <div className="w-px h-6 bg-slate-700" />

          {/* Pipeline Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Pipeline:</span>
            <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
              <SelectTrigger className="w-[180px] h-8 bg-slate-800 dark:bg-slate-700 border-slate-700 text-white">
                <SelectValue placeholder="Select pipeline" />
              </SelectTrigger>
              <SelectContent>
                {activePipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Apply Recommendations Button */}
          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={!selectedPipelineId || isProcessing || positiveCount === 0}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Apply Recommendations
              </>
            )}
          </Button>

          {/* Clear Selection */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearSelection}
            className="text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Apply Recommendations
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will process <strong>{selectedCount}</strong> selected{' '}
                {selectedCount === 1 ? 'reply' : 'replies'}:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>
                  Match replies to contacts (by email/phone) or create new contacts
                </li>
                <li>
                  Create deals in <strong>{activePipelines.find(p => p.id === selectedPipelineId)?.name}</strong> pipeline for positive replies
                </li>
                <li>
                  Deals will be assigned to you
                </li>
              </ul>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Only positive intent replies will have deals created. Other replies will only be matched to contacts.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApply}
              className="bg-green-600 hover:bg-green-700"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Apply to {positiveCount} {positiveCount === 1 ? 'Reply' : 'Replies'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
