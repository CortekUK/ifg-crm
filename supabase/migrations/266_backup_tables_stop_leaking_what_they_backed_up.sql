-- The backup tables had no row-level security, so every one of them was
-- readable by any signed-in user straight through PostgREST. Supabase grants
-- anon/authenticated on public tables by default; RLS is what takes it back,
-- and `CREATE TABLE AS` does not enable it.
--
-- deleted_test_mail_261 is the worst of the three: it holds 49 rows of deleted
-- Outlook mail, and a recruiter could select all of them. That is the same
-- exposure 265 just closed on email_threads, through a door nobody had looked
-- at — the backup of the mail was less protected than the mail.
--
-- RLS on with no policy at all means: nothing reaches anyone through the API,
-- while migrations and the service role (which bypass RLS) can still read them
-- to undo their change. That keeps what these tables are FOR and removes what
-- they were leaking. Dropping them is a separate decision, once nobody wants
-- the undo any more.

ALTER TABLE deleted_test_mail_261       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reclassified_internal_262   ENABLE ROW LEVEL SECURITY;
ALTER TABLE discarded_hero_override_264 ENABLE ROW LEVEL SECURITY;
