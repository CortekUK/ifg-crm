import { PageSkeleton, PageHeaderSkeleton, KanbanSkeleton } from '@/components/ui/page-skeleton'

export default function PipelinesLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton withSubtitle />
      <KanbanSkeleton columns={5} cardsPerColumn={3} />
    </PageSkeleton>
  )
}
