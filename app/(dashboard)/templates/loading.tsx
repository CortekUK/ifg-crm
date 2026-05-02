import { PageSkeleton, PageHeaderSkeleton, CardGridSkeleton } from '@/components/ui/page-skeleton'

export default function TemplatesLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={6} columns={3} />
    </PageSkeleton>
  )
}
