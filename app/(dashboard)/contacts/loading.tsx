import { PageSkeleton, PageHeaderSkeleton, TableSkeleton } from '@/components/ui/page-skeleton'

export default function ContactsLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <TableSkeleton rows={10} cols={6} />
    </PageSkeleton>
  )
}
