import { PageSkeleton, PageHeaderSkeleton, TableSkeleton } from '@/components/ui/page-skeleton'

export default function TagsLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} cols={3} />
    </PageSkeleton>
  )
}
