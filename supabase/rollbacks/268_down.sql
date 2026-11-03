-- UNDO scripts/refilter-stored-outlook.mjs and migration 268.
--
-- Kept out of supabase/migrations on purpose so nothing runs it by accident.
--   node scripts/apply-migration.mjs supabase/rollbacks/268_down.sql
--
-- Every row the script hid gets its previous value back, unless something has
-- since claimed it. A contact reply widens a hidden thread to 'player', and
-- that newer answer is left alone.

BEGIN;

UPDATE email_threads t SET category = r.previous_value
FROM reclassified_personal_268 r
WHERE r.source_table = 'email_threads' AND r.row_id = t.id AND t.category = 'personal';

UPDATE email_replies e SET sender_kind = r.previous_value
FROM reclassified_personal_268 r
WHERE r.source_table = 'email_replies' AND r.row_id = e.id AND e.sender_kind = 'personal';

DROP TABLE reclassified_personal_268;

COMMIT;
