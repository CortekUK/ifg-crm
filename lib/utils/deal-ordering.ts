import type { Deal } from '@/lib/types/pipelines'

/**
 * Where a dragged card lands, as a `board_position`.
 *
 * Positions are doubles with gaps of 1000 (migration 196), so dropping between
 * two cards is the midpoint of its neighbours — one row written, however many
 * hundreds of cards the stage holds.
 */

/** The gap the backfill and the insert trigger use. */
export const POSITION_GAP = 1000

/**
 * Null means "cannot be expressed as a midpoint" — the gap between the two
 * neighbours has been halved so many times that a double can no longer sit
 * strictly between them. The caller renumbers the stage instead. With gaps of
 * 1000 this needs roughly fifty consecutive drops between the very same pair
 * of cards, so it is a correctness backstop rather than an expected path.
 */
export function positionBetween(
  before: number | null | undefined,
  after: number | null | undefined,
): number | null {
  const hasBefore = typeof before === 'number' && Number.isFinite(before)
  const hasAfter = typeof after === 'number' && Number.isFinite(after)

  if (!hasBefore && !hasAfter) return POSITION_GAP
  if (!hasBefore) return (after as number) - POSITION_GAP
  if (!hasAfter) return (before as number) + POSITION_GAP

  const mid = ((before as number) + (after as number)) / 2
  const strictlyBetween = mid > (before as number) && mid < (after as number)
  return strictlyBetween ? mid : null
}

/**
 * The neighbours a card dropped at `index` would sit between, given the list
 * the user is actually looking at.
 *
 * The list is the column's VISIBLE cards — what a search, a date filter and
 * the page size have left on screen. Using the full stage would put the card
 * between two rows the user cannot see.
 *
 * `movingDealId` is removed first, because within one column the dragged card
 * is still in the list it is being measured against, and leaving it in shifts
 * every neighbour by one.
 */
export function neighboursAt(
  visible: Deal[],
  index: number,
  movingDealId: string,
): { before: number | null; after: number | null } {
  const others = visible.filter((deal) => deal.id !== movingDealId)
  const clamped = Math.max(0, Math.min(index, others.length))
  return {
    before: clamped > 0 ? others[clamped - 1].board_position ?? null : null,
    after: clamped < others.length ? others[clamped].board_position ?? null : null,
  }
}
