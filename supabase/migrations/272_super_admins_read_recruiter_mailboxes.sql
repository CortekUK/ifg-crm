-- A super admin can read a recruiter's mailbox. Nobody else's.
--
-- 265 made every connected mailbox private to its owner, after Nathan found
-- the other super admins reading his mail. The business rule (5 Nov 2026) is
-- a hierarchy: a super admin oversees the recruiters, so they can read a
-- recruiter's CRM mail; a recruiter reads only their own. Super admins still
-- cannot read each other's mailboxes — that was the 21 Oct complaint, and it
-- stays fixed.
--
-- What a super admin gets from a recruiter's mailbox is the CRM part only:
-- threads and messages in the categories the mailbox screen shows. Mail
-- between colleagues ('internal'), robots ('vendor') and anything marked
-- 'personal' stays the recruiter's alone, enforced here rather than hidden
-- by the screen.
--
-- Read only. UPDATE and DELETE stay owner-only, and the reply, read and send
-- routes already refuse anyone but the owner.

CREATE OR REPLACE FUNCTION public.can_read_mailbox(p_owner uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_owner IS NOT NULL AND (
    p_owner = auth.uid()
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      AND EXISTS (SELECT 1 FROM profiles WHERE id = p_owner AND role = 'recruiter')
    )
  )
$$;

REVOKE ALL ON FUNCTION public.can_read_mailbox(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_read_mailbox(uuid) TO authenticated;

DROP POLICY IF EXISTS email_threads_select ON email_threads;
CREATE POLICY email_threads_select ON email_threads
  FOR SELECT TO authenticated
  USING (
    mailbox_user_id = auth.uid()
    OR (
      coalesce(category, 'unknown') NOT IN ('internal', 'vendor', 'personal')
      AND public.can_read_mailbox(mailbox_user_id)
    )
  );

DROP POLICY IF EXISTS email_replies_select ON email_replies;
CREATE POLICY email_replies_select ON email_replies
  FOR SELECT TO authenticated
  USING (
    CASE WHEN source = 'outlook'
      THEN mailbox_user_id = auth.uid()
        OR (
          coalesce(sender_kind, 'unknown') NOT IN ('internal', 'vendor', 'personal')
          AND public.can_read_mailbox(mailbox_user_id)
          AND EXISTS (
            SELECT 1 FROM email_threads t
            WHERE t.mailbox_user_id = email_replies.mailbox_user_id
              AND t.conversation_id = email_replies.conversation_id
              AND coalesce(t.category, 'unknown') NOT IN ('internal', 'vendor', 'personal')
          )
        )
      ELSE (SELECT public.is_staff())
    END
  );

DROP POLICY IF EXISTS email_sends_select ON email_sends;
CREATE POLICY email_sends_select ON email_sends
  FOR SELECT TO authenticated
  USING (
    CASE WHEN source = 'outlook'
      THEN mailbox_user_id = auth.uid()
        OR (
          public.can_read_mailbox(mailbox_user_id)
          AND EXISTS (
            SELECT 1 FROM email_threads t
            WHERE t.mailbox_user_id = email_sends.mailbox_user_id
              AND t.conversation_id = email_sends.conversation_id
              AND coalesce(t.category, 'unknown') NOT IN ('internal', 'vendor', 'personal')
          )
        )
      ELSE (SELECT public.is_staff())
    END
  );

-- The picker at the top of the Outlook tab: your own mailbox, plus every
-- recruiter's if you are a super admin. Names and addresses only — the
-- credentials table itself stays owner-only, because it holds tokens.
CREATE OR REPLACE FUNCTION public.readable_mailboxes()
RETURNS TABLE (user_id uuid, full_name text, mailbox_email text, is_mine boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.user_id, p.full_name, c.mailbox_email, c.user_id = auth.uid()
  FROM outlook_credentials c
  JOIN profiles p ON p.id = c.user_id
  WHERE public.can_read_mailbox(c.user_id)
  ORDER BY (c.user_id = auth.uid()) DESC, p.full_name
$$;

REVOKE ALL ON FUNCTION public.readable_mailboxes() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.readable_mailboxes() TO authenticated;
