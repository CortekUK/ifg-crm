/**
 * A readable sentence out of whatever was thrown.
 *
 * WHY THIS EXISTS: `if (error) throw error` appears about 180 times across
 * lib/hooks, and what Supabase puts in `error` is a PostgrestError — a plain
 * object with message/details/hint/code, NOT an Error instance. Every screen
 * that guards with `err instanceof Error` therefore throws the only useful
 * information away and shows its own generic fallback.
 *
 * That is how a failed contact delete could say "Failed to delete contacts."
 * and nothing else: the database's own explanation was sitting in the thrown
 * object and the check in front of it was false.
 *
 * `details` and `hint` are included because Postgres puts the part a person
 * can act on there — which table the foreign key was in, which constraint
 * refused — while `message` alone is often just "update or delete violates
 * foreign key constraint".
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'string' && err.trim()) return err.trim()

  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [e.message, e.details, e.hint].filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0,
    )
    if (parts.length > 0) {
      // De-duplicated: Postgres often repeats the message inside details.
      const text = Array.from(new Set(parts.map((p) => p.trim()))).join(' — ')
      return typeof e.code === 'string' && e.code ? `${text} (${e.code})` : text
    }
  }

  return fallback
}
