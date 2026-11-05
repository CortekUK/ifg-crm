-- Undo 272: back to 265, every mailbox private to its owner.
DROP POLICY IF EXISTS email_threads_select ON email_threads;
CREATE POLICY email_threads_select ON email_threads
  FOR SELECT TO authenticated
  USING (mailbox_user_id = auth.uid());

DROP POLICY IF EXISTS email_replies_select ON email_replies;
CREATE POLICY email_replies_select ON email_replies
  FOR SELECT TO authenticated
  USING (
    CASE WHEN source = 'outlook'
      THEN mailbox_user_id = auth.uid()
      ELSE (SELECT public.is_staff())
    END
  );

DROP POLICY IF EXISTS email_sends_select ON email_sends;
CREATE POLICY email_sends_select ON email_sends
  FOR SELECT TO authenticated
  USING (
    CASE WHEN source = 'outlook'
      THEN mailbox_user_id = auth.uid()
      ELSE (SELECT public.is_staff())
    END
  );

DROP FUNCTION IF EXISTS public.readable_mailboxes();
DROP FUNCTION IF EXISTS public.can_read_mailbox(uuid);
