'use client'

import { useToast } from '@/lib/hooks/use-toast'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'relative rounded-lg border bg-white p-4 shadow-lg transition-all',
            'animate-in slide-in-from-right-full fade-in-0 duration-300',
            toast.variant === 'destructive' && 'border-red-200 bg-red-50'
          )}
        >
          <button
            onClick={() => dismiss(toast.id)}
            className="absolute right-2 top-2 rounded-full p-1 hover:bg-gray-100"
          >
            <X className="h-3 w-3 text-gray-500" />
          </button>

          {toast.title && (
            <p
              className={cn(
                'font-semibold text-sm pr-6',
                toast.variant === 'destructive' ? 'text-red-800' : 'text-gray-900'
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
                  ? 'text-red-600'
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
