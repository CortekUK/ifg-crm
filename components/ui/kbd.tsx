import { cn } from '@/lib/utils'

interface KbdProps {
  children: React.ReactNode
  className?: string
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-xs font-mono font-medium text-gray-700 dark:text-gray-300',
        className
      )}
    >
      {children}
    </kbd>
  )
}
