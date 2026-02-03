'use client'

import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, WifiOff, ServerCrash } from 'lucide-react'
import { cn } from '@/lib/utils'

type ErrorType = 'network' | 'server' | 'generic'

interface ErrorStateProps {
  title?: string
  message?: string
  errorType?: ErrorType
  onRetry?: () => void
  isRetrying?: boolean
  className?: string
  compact?: boolean
}

const errorConfig: Record<ErrorType, { icon: typeof AlertCircle; defaultTitle: string; defaultMessage: string }> = {
  network: {
    icon: WifiOff,
    defaultTitle: 'Connection error',
    defaultMessage: 'Unable to connect. Please check your internet connection and try again.',
  },
  server: {
    icon: ServerCrash,
    defaultTitle: 'Server error',
    defaultMessage: 'Something went wrong on our end. Please try again later.',
  },
  generic: {
    icon: AlertCircle,
    defaultTitle: 'Something went wrong',
    defaultMessage: 'An error occurred while loading the data. Please try again.',
  },
}

export function ErrorState({
  title,
  message,
  errorType = 'generic',
  onRetry,
  isRetrying = false,
  className,
  compact = false,
}: ErrorStateProps) {
  const config = errorConfig[errorType]
  const Icon = config.icon

  if (compact) {
    return (
      <div className={cn('flex items-center justify-between gap-4 p-4 bg-red-50 border border-red-200 rounded-lg', className)}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-full">
            <Icon className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-red-800">
              {title || config.defaultTitle}
            </p>
            <p className="text-xs text-red-600">
              {message || config.defaultMessage}
            </p>
          </div>
        </div>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
            className="shrink-0 border-red-200 text-red-700 hover:bg-red-100"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </>
            )}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4', className)}>
      <div className="p-4 bg-red-100 rounded-full mb-4">
        <Icon className="h-8 w-8 text-red-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title || config.defaultTitle}
      </h3>
      <p className="text-sm text-gray-500 text-center max-w-sm mb-6">
        {message || config.defaultMessage}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          disabled={isRetrying}
          className="min-w-[120px]"
        >
          {isRetrying ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </>
          )}
        </Button>
      )}
    </div>
  )
}
