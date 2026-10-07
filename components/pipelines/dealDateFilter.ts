import { differenceInCalendarDays } from 'date-fns'
import type { Deal } from '@/lib/types/pipelines'

/**
 * Date filtering for a pipeline column.
 *
 * This replaces the inline "Today / Yesterday / Monday 28 Sep / September"
 * collapsible sections that used to be interleaved with the cards. Two things
 * were wrong with those:
 *
 *   * They did not shorten anything. Every one of the 328 leads in the
 *     University "Dormant" stage was created in the same month, so they all
 *     landed in ONE group, which opened by default — a single header followed
 *     by 328 cards. The grouping cost a header and saved nothing.
 *   * A header is not a filter. To reach the next date heading you had to
 *     scroll past every card under the current one, so with 100 leads in a day
 *     the controls were a hundred cards down the page.
 *
 * A range picked in the column header does what the headings were reaching
 * for, in one click, without pushing the cards around.
 */

export type DateRange = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'older'

export const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'older', label: 'Older than 30 days' },
]

/**
 * Always `created_at` — when the lead arrived.
 *
 * The old grouping switched between created_at and last_activity_at depending
 * on the sort, which meant the same card moved between headings when you
 * re-sorted. A filter the user sets explicitly should not change meaning
 * because of an unrelated control.
 */
export function withinDateRange(deal: Deal, range: DateRange, now: Date = new Date()): boolean {
  if (range === 'all') return true

  const created = new Date(deal.created_at)
  if (Number.isNaN(created.getTime())) return false

  const daysAgo = differenceInCalendarDays(now, created)

  switch (range) {
    case 'today':
      return daysAgo <= 0
    case 'yesterday':
      return daysAgo === 1
    case 'week':
      return daysAgo >= 0 && daysAgo < 7
    case 'month':
      return daysAgo >= 0 && daysAgo < 30
    case 'older':
      return daysAgo >= 30
    default:
      return true
  }
}
