-- UNDO migration 267 (personal mail never enters the CRM).
--
-- Kept out of supabase/migrations on purpose so nothing runs it by accident.
--   node scripts/apply-migration.mjs supabase/rollbacks/267_down.sql
--
-- Puts back exactly what 267 changed, from the live definitions captured
-- immediately before it was applied (27 Oct 2026):
--   - every row 267 re-filed as 'personal' gets its previous category back
--   - the 'personal' category is removed from both constraints
--   - v_scout_communications includes Outlook mail again (249's definition)
--   - email_sends_select regains the admin exception (248's definition)
--   - outlook_filtered_messages and reclassified_personal_267 are dropped
--
-- The APPLICATION half is separate: revert the Outlook filter commits too, or
-- the app keeps filtering new mail (and logging to a table that no longer
-- exists — harmless, it only logs an error).

BEGIN;

-- 1. rows back to what they were
UPDATE email_threads t SET category = r.previous_value
FROM reclassified_personal_267 r
WHERE r.source_table = 'email_threads' AND r.row_id = t.id AND t.category = 'personal';

UPDATE email_replies e SET sender_kind = r.previous_value
FROM reclassified_personal_267 r
WHERE r.source_table = 'email_replies' AND r.row_id = e.id AND e.sender_kind = 'personal';

-- 2. constraints as they were before 267
ALTER TABLE email_threads DROP CONSTRAINT IF EXISTS email_threads_category_check;
ALTER TABLE email_threads ADD CONSTRAINT email_threads_category_check
  CHECK (category = ANY (ARRAY['player','parent','secondary','internal','external','vendor','unknown']));

ALTER TABLE email_replies DROP CONSTRAINT IF EXISTS email_replies_sender_kind_check;
ALTER TABLE email_replies ADD CONSTRAINT email_replies_sender_kind_check
  CHECK (sender_kind = ANY (ARRAY['player','parent','secondary','internal','external','vendor','unknown']));

-- 3. Scout's view as 249 left it
CREATE OR REPLACE VIEW public.v_scout_communications AS
SELECT 'email_send'::text AS channel,
    es.id::text AS id,
    es.recipient_contact_id AS contact_id,
    es.recipient_email AS counterpart,
    es.subject,
    NULL::text AS body_preview,
    es.status,
    NULL::text AS intent,
    es.campaign_id,
    NULL::uuid AS deal_id,
    NULL::uuid AS pipeline_id,
    es.sent_at AS occurred_at,
    es.created_at
   FROM email_sends es
UNION ALL
 SELECT 'email_reply'::text AS channel,
    er.id::text AS id,
    er.contact_id,
    er.from_email AS counterpart,
    er.subject,
    er.body_preview,
    er.status,
    er.ai_intent AS intent,
    er.campaign_id,
    er.deal_id,
    er.pipeline_id,
    er.received_at AS occurred_at,
    er.created_at
   FROM email_replies er;

-- 4. sent-mail policy as 248 left it
DROP POLICY IF EXISTS email_sends_select ON email_sends;
CREATE POLICY email_sends_select ON email_sends FOR SELECT TO authenticated
  USING (
    CASE WHEN source = 'outlook'
      THEN mailbox_user_id = auth.uid()
           OR ((SELECT public.is_admin()) AND recipient_contact_id IS NOT NULL)
      ELSE (SELECT public.is_staff())
    END
  );
COMMENT ON POLICY email_sends_select ON email_sends IS
  'Bulk sends stay team-wide so Reports/Analytics keep counting. Outlook sends are scoped to the sending mailbox.';

-- 5. tables 267 created
DROP TABLE IF EXISTS outlook_filtered_messages;
DROP TABLE IF EXISTS reclassified_personal_267;

COMMIT;
