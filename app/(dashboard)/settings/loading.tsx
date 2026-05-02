import { PageSkeleton, PageHeaderSkeleton, CardGridSkeleton } from '@/components/ui/page-skeleton'

export default function SettingsLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={4} columns={2} />
    </PageSkeleton>
  )
}
