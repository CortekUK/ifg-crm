-- Backfill email_replies.pipeline_id (and campaign_id where applicable) for
-- already-stored rows. From this migration on, the inbound webhook populates
-- both columns at insert time, but rows created before the threading-by-
-- Message-ID work landed have NULLs there.
--
-- Resolution paths mirror the runtime helper:
--   * Campaign blast:   email_send.campaign_id      → campaigns.pipeline_id
--   * Automation drip:  email_send.automation_log_id → … → automations.pipeline_id
--   * Last-resort match by recipient_contact_id when email_send_id is null —
--     pick the most recent send to that contact in the last 30 days.
--
-- Idempotent: only updates rows where the target column is NULL.

-- 1. Direct path via email_send_id when it exists.
UPDATE email_replies er
SET pipeline_id = COALESCE(er.pipeline_id, derived.pipeline_id),
    campaign_id = COALESCE(er.campaign_id, derived.campaign_id)
FROM (
  SELECT es.id AS email_send_id,
         COALESCE(c.pipeline_id, a.pipeline_id) AS pipeline_id,
         es.campaign_id
  FROM email_sends es
  LEFT JOIN campaigns c          ON c.id = es.campaign_id
  LEFT JOIN automation_logs al   ON al.id = es.automation_log_id
  LEFT JOIN automation_enrollments ae ON ae.id = al.enrollment_id
  LEFT JOIN automations a        ON a.id = ae.automation_id
) derived
WHERE er.email_send_id = derived.email_send_id
  AND (er.pipeline_id IS NULL OR er.campaign_id IS NULL);

-- 2. Heuristic path for rows missing email_send_id (most-recent-send-to-contact).
WITH recent_send AS (
  SELECT DISTINCT ON (es.recipient_contact_id)
         es.recipient_contact_id,
         es.id            AS email_send_id,
         es.campaign_id,
         COALESCE(c.pipeline_id, a.pipeline_id) AS pipeline_id
  FROM email_sends es
  LEFT JOIN campaigns c          ON c.id = es.campaign_id
  LEFT JOIN automation_logs al   ON al.id = es.automation_log_id
  LEFT JOIN automation_enrollments ae ON ae.id = al.enrollment_id
  LEFT JOIN automations a        ON a.id = ae.automation_id
  WHERE es.recipient_contact_id IS NOT NULL
    AND es.sent_at > now() - interval '30 days'
  ORDER BY es.recipient_contact_id, es.sent_at DESC
)
UPDATE email_replies er
SET pipeline_id = COALESCE(er.pipeline_id, rs.pipeline_id),
    campaign_id = COALESCE(er.campaign_id, rs.campaign_id),
    email_send_id = COALESCE(er.email_send_id, rs.email_send_id)
FROM recent_send rs
WHERE er.contact_id = rs.recipient_contact_id
  AND er.email_send_id IS NULL
  AND er.pipeline_id IS NULL;
