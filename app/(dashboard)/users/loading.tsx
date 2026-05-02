import { PageSkeleton, PageHeaderSkeleton, TableSkeleton } from '@/components/ui/page-skeleton'

export default function UsersLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} cols={4} />
    </PageSkeleton>
  )
}
