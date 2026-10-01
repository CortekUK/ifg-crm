import { differenceInCalendarDays, format, isSameMonth, isSameYear, startOfDay } from 'date-fns'
import type { Deal } from '@/lib/types/pipelines'
import type { SortOption } from '@/lib/hooks/useColumnPreferences'

export interface DealDateGroup {
  key: string
  label: string
  deals: Deal[]
}

// Which timestamp a sort orders by. Only date-based sorts get grouped —
// grouping a value- or name-sorted column by date would scatter the
// order the user just asked for.
export function groupingDateFor(sortBy: SortOption): ((deal: Deal) => string) | null {
  switch (sortBy) {
    case 'date-desc':
    case 'date-asc':
      return (deal) => deal.created_at
    case 'activity-desc':
      return (deal) => deal.last_activity_at || deal.created_at
    default:
      return null
  }
}

// The last week gets a bucket per day (Today, Yesterday, Monday 28 Sep…),
// anything older collapses into one bucket per month so a stage holding
// months of leads stays a short list of headers.
function bucketFor(date: Date, now: Date): { key: string; label: string } {
  const daysAgo = differenceInCalendarDays(now, date)

  if (daysAgo <= 0) return { key: 'today', label: 'Today' }
  if (daysAgo === 1) return { key: 'yesterday', label: 'Yesterday' }
  if (daysAgo < 7) {
    return { key: format(date, 'yyyy-MM-dd'), label: format(date, 'EEEE d MMM') }
  }
  if (isSameMonth(date, now)) {
    return { key: format(date, 'yyyy-MM'), label: `Earlier in ${format(date, 'MMMM')}` }
  }
  return {
    key: format(date, 'yyyy-MM'),
    label: isSameYear(date, now) ? format(date, 'MMMM') : format(date, 'MMMM yyyy'),
  }
}

// Walks the already-sorted deals and starts a new group whenever the
// bucket changes, so the column's sort direction is preserved.
export function groupDealsByDate(
  deals: Deal[],
  getDate: (deal: Deal) => string,
  now: Date = new Date(),
): DealDateGroup[] {
  const today = startOfDay(now)
  const groups: DealDateGroup[] = []
  const byKey = new Map<string, DealDateGroup>()

  for (const deal of deals) {
    const { key, label } = bucketFor(new Date(getDate(deal)), today)
    let group = byKey.get(key)
    if (!group) {
      group = { key, label, deals: [] }
      byKey.set(key, group)
      groups.push(group)
    }
    group.deals.push(deal)
  }

  return groups
}
