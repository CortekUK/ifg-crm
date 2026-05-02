-- ============================================================================
-- Migration 117: AI template builder — chat history persistence
-- ============================================================================
-- Mirrors the Scout chat persistence shape but scoped to the template
-- editor. Two tables:
--
--   template_ai_chats     — one row per conversation (sidebar entry)
--   template_ai_messages  — turns within a chat. AI turns carry a snapshot
--                           of the resulting block list so the user can
--                           "resume where they left off" with the canvas
--                           hydrated to whatever the AI produced last.
--
-- Title auto-derives from the first user message (route-side); the user
-- can rename later via PUT.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.template_ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  -- Optional pin to an existing email_templates row. Useful when the user
  -- "saved as draft" mid-chat — lets us link the conversation back to the
  -- saved template instead of orphaning it.
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_ai_chats_user
  ON public.template_ai_chats(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.template_ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.template_ai_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  -- AI messages carry the resulting blocks + subject/preheader so the canvas
  -- can be restored on resume. User messages leave this null.
  blocks_snapshot JSONB,
  subject_snapshot TEXT,
  preheader_snapshot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_ai_messages_chat
  ON public.template_ai_messages(chat_id, created_at);

-- Bump parent chat updated_at on every new message so list ordering by
-- "most recent activity" works without an extra query.
CREATE OR REPLACE FUNCTION public.template_ai_messages_touch_chat()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.template_ai_chats
  SET updated_at = NOW()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS template_ai_messages_touch_chat_trigger ON public.template_ai_messages;
CREATE TRIGGER template_ai_messages_touch_chat_trigger
AFTER INSERT ON public.template_ai_messages
FOR EACH ROW EXECUTE FUNCTION public.template_ai_messages_touch_chat();

-- RLS — super_admin can only see their own chats. The route uses the
-- service-role client so it bypasses RLS, but these policies guard the
-- direct anon-key path in case a UI ever queries these tables directly.
ALTER TABLE public.template_ai_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS template_ai_chats_owner ON public.template_ai_chats;
CREATE POLICY template_ai_chats_owner
  ON public.template_ai_chats
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS template_ai_messages_owner ON public.template_ai_messages;
CREATE POLICY template_ai_messages_owner
  ON public.template_ai_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.template_ai_chats c
      WHERE c.id = template_ai_messages.chat_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.template_ai_chats c
      WHERE c.id = template_ai_messages.chat_id
        AND c.user_id = auth.uid()
    )
  );
