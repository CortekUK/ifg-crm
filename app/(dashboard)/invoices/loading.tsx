import { PageSkeleton, PageHeaderSkeleton, TableSkeleton, KpiRowSkeleton } from '@/components/ui/page-skeleton'

export default function InvoicesLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <KpiRowSkeleton count={3} />
      <TableSkeleton rows={8} cols={6} />
    </PageSkeleton>
  )
}
