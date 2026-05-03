-- ============================================================================
-- Migration 119: Star + rename support for Scout conversations
-- ============================================================================
-- Adds a `starred` flag so the user can pin frequently-used chats. The
-- existing `title` column already supports renaming — no schema change needed
-- for that, just a new PATCH endpoint client-side.
--
-- The partial index keeps the "starred chats" sidebar query fast even when
-- the user accumulates hundreds of chats.
-- ============================================================================

ALTER TABLE public.scout_conversations
  ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_scout_conversations_starred
  ON public.scout_conversations(user_id, updated_at DESC)
  WHERE starred = true;
