import { PageSkeleton, PageHeaderSkeleton, KpiRowSkeleton, CardGridSkeleton } from '@/components/ui/page-skeleton'

export default function AnalyticsLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <KpiRowSkeleton count={4} />
      <CardGridSkeleton count={4} columns={2} />
    </PageSkeleton>
  )
}
