-- QA-51 Issue 2: the bell's unread count had stopped meaning anything.
--
-- The super admin accounts showed 1,167 unread. Every CRM event for every
-- player is added to the bell — which the Notifications screen says plainly
-- and QA confirmed is intended — but nothing ever marked them read, so the
-- number only ever grew and a genuinely new event was indistinguishable from
-- one from August.
--
-- Ghulam's decision (9 Oct): auto-clear anything older than 30 days. The bell
-- still LISTS every event, so the on-screen promise stays true; what changes is
-- that "unread" goes back to meaning "recent and unseen". Scoping the bell to
-- each person's own players was the alternative and was not taken, because it
-- would contradict that text.
--
-- A plain UPDATE, not a delete: the history stays readable in the bell and
-- anything still unread inside the window is left alone.

CREATE OR REPLACE FUNCTION mark_stale_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE is_read = false
    AND created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION mark_stale_notifications_read() IS
  'QA-51 Issue 2: clears notifications older than 30 days from the unread count '
  'so the bell badge reflects recent activity. Rows are kept and still listed.';

-- Daily at 04:00 UTC, in the quiet hours. pg_cron is already how this project
-- schedules work (see the process-automations job), and this needs no HTTP call
-- or secret, so it stays in the database rather than taking a Vercel cron slot
-- — Vercel's Hobby plan allows only a handful and three are already used.
SELECT cron.unschedule('mark-stale-notifications-read')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mark-stale-notifications-read');

SELECT cron.schedule(
  'mark-stale-notifications-read',
  '0 4 * * *',
  $$SELECT mark_stale_notifications_read();$$
);

-- Clear the existing backlog once, now.
SELECT mark_stale_notifications_read();
