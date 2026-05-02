-- ============================================================================
-- Migration 115: Scout conversation persistence
-- ============================================================================
-- One conversation per session-of-questions, one message per turn.
-- We deliberately don't store tool-call internals here — only the
-- user-facing assistant + user messages. Tool calls are ephemeral and the
-- chat ID is enough to reconstruct context for the next turn.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scout_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scout_conversations_user_id
  ON public.scout_conversations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.scout_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.scout_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scout_messages_conversation_id
  ON public.scout_messages(conversation_id, created_at);

-- Bump the conversation's updated_at whenever a message lands so list
-- ordering by recent activity works without a separate query.
CREATE OR REPLACE FUNCTION public.scout_touch_conversation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.scout_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scout_messages_touch_conversation ON public.scout_messages;
CREATE TRIGGER scout_messages_touch_conversation
AFTER INSERT ON public.scout_messages
FOR EACH ROW EXECUTE FUNCTION public.scout_touch_conversation();

-- RLS: super_admins see only their own conversations. The API route uses the
-- service-role client (bypasses RLS) but enforces the gate in code; these
-- policies are belt-and-braces in case someone wires up a direct anon-key call.
ALTER TABLE public.scout_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scout_conversations_owner ON public.scout_conversations;
CREATE POLICY scout_conversations_owner
  ON public.scout_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS scout_messages_owner ON public.scout_messages;
CREATE POLICY scout_messages_owner
  ON public.scout_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scout_conversations c
      WHERE c.id = scout_messages.conversation_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scout_conversations c
      WHERE c.id = scout_messages.conversation_id AND c.user_id = auth.uid()
    )
  );
