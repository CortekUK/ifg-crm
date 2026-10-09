-- QA-03 Bug 1: moving a deal back to Initial Lead never re-contacted the
-- player, because a weeks-old reply killed the restarted sequence.
--
-- QA retested on 9 Oct: the backward move was confirmed at 20:50:16, the
-- INITIAL CONTACT MAP sequence re-enrolled at 20:50:16, and it was stopped at
-- the same second with reason "Contact replied". The only replies on that deal
-- were from 7 Oct. No email was sent, and the card was moved straight back to
-- Contact Response — while the confirmation dialog had just promised the
-- recruiter that automations on Initial Lead would "re-trigger from the start".
--
-- Migration 206 fixed this for ONE of the three code paths that stop a
-- sequence on reply: stop_enrollments_on_reply_match, the trigger on
-- email_replies. It added the rule that matters —
--
--   a reply can only stop an enrolment that already existed when it arrived
--
-- — but the other two paths never got it:
--
--   1. this view, read by the check-replies function
--   2. checkReplies() in the process-automations function (fixed in the
--      function source; needs a deploy)
--
-- Both find the enrolment through the automation_log chain and stop it with
-- "Contact replied" (note: no "to email" — that string is how the three paths
-- can be told apart in stopped_reason, and it is what QA saw).
--
-- Adding the guard here fixes path 1 immediately, with no function deploy.
--
-- er.received_at is the arrival time and ae.enrolled_at the moment the player
-- joined; COALESCE keeps a row with either value missing behaving as it does
-- today rather than silently dropping out of the view.
--
-- Idempotent.

CREATE OR REPLACE VIEW pending_reply_stops AS
 SELECT er.id AS reply_id,
    er.contact_id,
    ae.id AS enrollment_id,
    ae.automation_id,
    a.name AS automation_name,
    (c.first_name || ' '::text) || c.last_name AS contact_name
   FROM email_replies er
     JOIN email_sends es ON er.email_send_id = es.id
     JOIN automation_logs al ON es.automation_log_id = al.id
     JOIN automation_steps ast ON al.step_id = ast.id
     JOIN automations a ON ast.automation_id = a.id
     JOIN automation_enrollments ae ON ae.automation_id = a.id AND ae.deal_id = al.deal_id
     JOIN deals d ON ae.deal_id = d.id
     JOIN contacts c ON d.contact_id = c.id
  WHERE ae.status = 'active'::text
    AND er.processed = false
    AND (a.exit_on_reply = true OR ((a.config ->> 'exit_on_reply'::text)::boolean) = true)
    -- The sequence must predate the reply.
    AND COALESCE(ae.enrolled_at, '-infinity'::timestamptz)
          <= COALESCE(er.received_at, now());
