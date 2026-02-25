import Link from 'next/link'
import { ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <ShieldX className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Access Denied
        </h1>
        <p className="text-muted-foreground mb-6">
          You don&apos;t have permission to access this page. Contact your administrator if you believe this is a mistake.
        </p>
        <Button asChild>
          <Link href="/dashboard">
            Return to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}
