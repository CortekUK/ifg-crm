-- Migration 248: close the email_replies RLS hole, and scope mailbox mail.
--
-- ── The hole ─────────────────────────────────────────────────────────────
-- Migration 006 created three fully permissive policies on email_replies:
--     "Users can view email replies"    FOR SELECT USING (true)
--     "Users can insert email replies"  FOR INSERT WITH CHECK (true)
--     "Users can update email replies"  FOR UPDATE USING (true)
--
-- Migration 101 later added ownership rules (email_replies_select etc.) but
-- only dropped a policy named "Allow authenticated full access", which is NOT
-- one of the three above. Nothing in the 247 migrations since has dropped
-- them. Postgres OR's permissive policies together, so 101's ownership rules
-- have never restricted anything: any authenticated user — including a PLAYER
-- with a portal login — can read every reply in the business straight from
-- the database, whatever the screen shows.
--
-- ── Why 101's rule would not have been enough anyway ─────────────────────
-- 101 scoped by `contact_id IN (SELECT id FROM contacts)`. Migration 175 then
-- widened recruiters to every contact as a deliberate product decision, so
-- that predicate now passes for every row. Mail has to be scoped by WHOSE
-- MAILBOX it is, which is what 245 added the columns for.
--
-- ── The rule, and what deliberately does NOT change ──────────────────────
-- The guiding constraint is "do not break any functionality", so bulk mail
-- keeps today's behaviour exactly and only the new personal-mailbox mail is
-- scoped:
--
--   source <> 'outlook'  (Resend: campaigns, automations, invoices, legacy)
--     → every STAFF user, as today. This keeps unmatched-reply triage, Smart
--       Match (QA-31), Smart Deal (QA-32), the Needs Attention widget and the
--       whole existing Replies workflow working unchanged for recruiters.
--       The only narrowing is from `authenticated` to staff, which removes
--       players — they never read these tables (the portal does not touch
--       them) and never should have been able to.
--
--   source = 'outlook'   (a human's own mailbox)
--     → the mailbox owner always; an admin only when the message involves a
--       CRM contact. A synced mailbox also holds HR, payroll and personal
--       mail, and an admin has no business reading a colleague's private
--       correspondence. Admins see players, not people.
--
-- To widen admins to everything later, delete the `contact_id IS NOT NULL`
-- clause — one edit, nothing else depends on it.

-- ── What is actually live, which is worse than the migration files say ───
-- Read from pg_policies on the production database before writing this, and
-- it is as well: alongside the three from 006 there are TWO MORE permissive
-- policies on email_replies that appear in NO migration file —
--
--   "Allow all for authenticated users"           ALL  USING (true)
--   "Allow authenticated access to email_replies" ALL  USING (true)
--
-- and one on email_sends, "Allow authenticated access to email_sends". They
-- were applied straight to the database at some point and never written down.
-- Dropping only the three named in the migration history would have left two
-- ALL/true policies standing and the hole exactly as open as before, while
-- looking fixed in the diff. Hence dropping by exact live name.
--
-- "Service role can manage email sends" is TO service_role and stays: the
-- service role bypasses RLS anyway and the webhook/cron paths rely on it.

-- ── email_replies ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view email replies"   ON email_replies;
DROP POLICY IF EXISTS "Users can insert email replies" ON email_replies;
DROP POLICY IF EXISTS "Users can update email replies" ON email_replies;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON email_replies;
DROP POLICY IF EXISTS "Allow authenticated access to email_replies" ON email_replies;

-- 101's versions, replaced below.
DROP POLICY IF EXISTS email_replies_select ON email_replies;
DROP POLICY IF EXISTS email_replies_insert ON email_replies;
DROP POLICY IF EXISTS email_replies_update ON email_replies;

-- Helpers are wrapped in a scalar subquery per migration 160: it makes the
-- planner evaluate them once per query rather than once per row, which is the
-- difference between a fast inbox and a statement timeout.
CREATE POLICY email_replies_select ON email_replies FOR SELECT TO authenticated
  USING (
    CASE WHEN source = 'outlook'
      THEN mailbox_user_id = auth.uid()
           OR ((SELECT public.is_admin()) AND contact_id IS NOT NULL)
      ELSE (SELECT public.is_staff())
    END
  );

-- Staff may write (marking read, spam, matching by hand). Service role, which
-- every ingest path uses, bypasses RLS entirely.
CREATE POLICY email_replies_insert ON email_replies FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_staff()));

CREATE POLICY email_replies_update ON email_replies FOR UPDATE TO authenticated
  USING (
    CASE WHEN source = 'outlook'
      THEN mailbox_user_id = auth.uid() OR (SELECT public.is_admin())
      ELSE (SELECT public.is_staff())
    END
  )
  WITH CHECK (
    CASE WHEN source = 'outlook'
      THEN mailbox_user_id = auth.uid() OR (SELECT public.is_admin())
      ELSE (SELECT public.is_staff())
    END
  );

-- email_replies_delete from 101 is admin-only and intentionally untouched.

-- ── email_sends ──────────────────────────────────────────────────────────
-- Same shape, and the same restraint. email_sends is read by campaign stats,
-- automation outcomes, automation email stats, deal activities and Reports —
-- all of which count across the whole business. Scoping campaign/automation
-- sends by mailbox would quietly zero those numbers, so bulk sends stay
-- team-wide and only Outlook's personal mail is scoped.
DROP POLICY IF EXISTS "Users can view email sends" ON email_sends;
DROP POLICY IF EXISTS "Allow authenticated access to email_sends" ON email_sends;
DROP POLICY IF EXISTS email_sends_select ON email_sends;

CREATE POLICY email_sends_select ON email_sends FOR SELECT TO authenticated
  USING (
    CASE WHEN source = 'outlook'
      THEN mailbox_user_id = auth.uid()
           OR ((SELECT public.is_admin()) AND recipient_contact_id IS NOT NULL)
      ELSE (SELECT public.is_staff())
    END
  );

COMMENT ON POLICY email_replies_select ON email_replies IS
  'Bulk (Resend) replies: all staff, as before. Outlook replies: mailbox owner, plus admins only where a CRM contact is involved.';
COMMENT ON POLICY email_sends_select ON email_sends IS
  'Bulk sends stay team-wide so Reports/Analytics keep counting. Outlook sends are scoped to the sending mailbox.';
