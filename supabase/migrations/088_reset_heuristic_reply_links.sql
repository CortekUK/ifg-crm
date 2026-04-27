-- Migration 087's heuristic phase set email_send_id / pipeline_id on every
-- pre-existing reply by guessing it was a reply to the contact's most recent
-- send. That breaks down when a contact is in multiple pipelines: every
-- reply gets bucketed into whichever programme sent the latest email, which
-- is wrong for the older replies and misleading on the Replies page.
--
-- Reset the heuristic-set rows so they show as "—" (unknown) until a real
-- threading match exists. Genuine matches — set by the inbound webhook from
-- a verified VERP / Message-ID lookup — keep their values because at insert
-- time `email_send_id` was already known.
--
-- Detection rule: a row was heuristic-backfilled iff `in_reply_to` is NULL
-- (no header was extracted at insert time), since 087's heuristic only ran
-- on rows where email_send_id was NULL — and those rows also had in_reply_to
-- NULL (the inbound code that populates in_reply_to was deployed at the same
-- time as the threading work). Conservative: anything with in_reply_to set
-- has at least had a real header parsed.

UPDATE email_replies
SET email_send_id = NULL,
    pipeline_id   = NULL,
    campaign_id   = NULL
WHERE in_reply_to IS NULL
  AND email_send_id IS NOT NULL;
