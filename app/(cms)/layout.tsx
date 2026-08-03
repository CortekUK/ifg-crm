import { Toaster } from '@/components/ui/toaster'

// Full-screen CMS editor layout — deliberately OUTSIDE the (dashboard) group so
// there is no sidebar/header chrome. Auth is still enforced by middleware.
export default function CmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {children}
      <Toaster />
    </div>
  )
}
