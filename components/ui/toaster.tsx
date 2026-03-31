'use client'

import { useToast } from '@/lib/hooks/use-toast'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'relative rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 p-4 shadow-lg transition-all pointer-events-auto',
            'animate-in slide-in-from-right-full fade-in-0 duration-300',
            toast.variant === 'destructive' && 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950'
          )}
        >
          <button
            onClick={(e) => { e.stopPropagation(); dismiss(toast.id) }}
            className="absolute right-2 top-2 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer z-10"
          >
            <X className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
          </button>

          {toast.title && (
            <p
              className={cn(
                'font-semibold text-sm pr-6',
                toast.variant === 'destructive' ? 'text-red-800 dark:text-red-300' : 'text-gray-900 dark:text-white'
              )}
            >
              {toast.title}
            </p>
          )}
          {toast.description && (
            <p
              className={cn(
                'text-sm mt-1',
                toast.variant === 'destructive'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-muted-foreground'
              )}
            >
              {toast.description}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
