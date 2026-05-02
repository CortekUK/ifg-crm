import { PageSkeleton, PageHeaderSkeleton, CardGridSkeleton } from '@/components/ui/page-skeleton'

export default function ReportsLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={9} columns={3} />
    </PageSkeleton>
  )
}
