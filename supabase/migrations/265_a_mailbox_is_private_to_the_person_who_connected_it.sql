-- Nobody reads anyone else's mailbox.
--
-- 248 scoped personal mailbox mail but kept an admin exception: an admin could
-- read any thread flagged is_crm_related, on the reasoning "admins see players,
-- not people". In practice that meant the other two super_admins could read 96
-- of Nathan's 451 threads — and the mailbox screen opened on "All mailboxes" by
-- default, so it was the first thing they saw rather than something they chose.
-- He disconnected his mailbox over it.
--
-- Two further problems with the exception as written:
--
--   is_crm_related is set at ingest as `!!attribution.contactId` — purely "does
--   this thread link to a CRM contact?", with no regard for category. Colleagues
--   exist as contact records, so 30 of those 96 were category 'internal': a
--   colleague's private correspondence, which 248 itself said an admin "has no
--   business reading". The mailbox UI hid them via HIDDEN_CATEGORIES, so they
--   were concealed rather than protected — one direct query away.
--
--   And it was symmetric in a way nobody wanted: three super_admins could each
--   read the other two's mail.
--
-- The decision (Nathan, 21 Oct 2026): a connected mailbox is private to the
-- person who connected it. No admin exception, and no exception between
-- super_admins either.
--
-- Bulk mail is deliberately untouched. email_replies rows that are NOT from
-- outlook are campaign, automation and invoice replies; they stay visible to
-- every staff user, which is what the Replies queue, Smart Match and Smart Deal
-- all run on. Only a human's own mailbox is narrowed. This is the same line 248
-- drew, with the admin exception removed from the outlook side.
--
-- Note: threads with a NULL mailbox_user_id (2 orphans from an old sync) become
-- invisible to everyone rather than visible to admins. That is the safer end of
-- the change and they are leftovers, not live mail.

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

DROP POLICY IF EXISTS email_replies_update ON email_replies;
CREATE POLICY email_replies_update ON email_replies
  FOR UPDATE TO authenticated
  USING (
    CASE WHEN source = 'outlook'
      THEN mailbox_user_id = auth.uid()
      ELSE (SELECT public.is_staff())
    END
  );

-- Delete followed is_admin() for every row, outlook or not, so an admin could
-- delete mailbox mail they can no longer read. Brought into line; bulk mail
-- keeps the admin rule it had.
DROP POLICY IF EXISTS email_replies_delete ON email_replies;
CREATE POLICY email_replies_delete ON email_replies
  FOR DELETE TO authenticated
  USING (
    CASE WHEN source = 'outlook'
      THEN mailbox_user_id = auth.uid()
      ELSE (SELECT public.is_admin())
    END
  );

COMMENT ON COLUMN email_threads.is_crm_related IS
  'Whether the thread is attached to a CRM contact. No longer grants anyone '
  'access: since 265 a mailbox is readable only by its owner. Kept because '
  'ingest still sets it and it is useful for reporting.';
