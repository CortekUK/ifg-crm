import {
  PageSkeleton,
  PageHeaderSkeleton,
  KpiRowSkeleton,
  CardGridSkeleton,
} from '@/components/ui/page-skeleton'

export default function DashboardLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton withSubtitle withActions={false} />
      <KpiRowSkeleton count={4} />
      <CardGridSkeleton count={3} columns={3} />
    </PageSkeleton>
  )
}
