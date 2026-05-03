-- ============================================================================
-- Migration 118: Scout per-user memories
-- ============================================================================
-- Each super_admin gets their own private memory pool. Scout writes to it via
-- the save_memory tool when:
--   - the user explicitly asks ("remember X"), or
--   - it spots a durably-useful fact (preference, naming convention, recurring
--     contact, etc).
--
-- Memories are injected back into the system prompt at the start of every
-- conversation so Scout has continuity across sessions. The UI at
-- /scout/memory lets the user list / edit / delete entries.
--
-- Per-user isolation, NOT shared across the team — different super_admins
-- build different mental models and would get confused if memories pooled.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scout_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  -- 'manual'  -> user added/edited from the settings UI
  -- 'auto'    -> Scout saved it during a conversation via the save_memory tool
  source TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('manual', 'auto')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scout_memories_user_id
  ON public.scout_memories(user_id, created_at DESC);

ALTER TABLE public.scout_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scout_memories_owner ON public.scout_memories;
CREATE POLICY scout_memories_owner
  ON public.scout_memories
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Bump updated_at automatically on edits so the settings list can sort by
-- "recently changed" without an app-side touch.
CREATE OR REPLACE FUNCTION public.scout_memories_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scout_memories_touch_updated_at ON public.scout_memories;
CREATE TRIGGER scout_memories_touch_updated_at
BEFORE UPDATE ON public.scout_memories
FOR EACH ROW EXECUTE FUNCTION public.scout_memories_touch_updated_at();
