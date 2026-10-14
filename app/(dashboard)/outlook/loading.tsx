import { PageSkeleton, PageHeaderSkeleton, TableSkeleton } from '@/components/ui/page-skeleton'

export default function OutlookLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton withActions={false} withSubtitle />
      <TableSkeleton rows={8} cols={7} />
    </PageSkeleton>
  )
}
