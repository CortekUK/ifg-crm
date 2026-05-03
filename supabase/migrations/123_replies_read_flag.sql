-- Mark-as-read for the Replies inbox.
--
-- email_replies already has a `read` boolean column (left over from an
-- earlier iteration); this migration adds the matching column to
-- sms_messages so Email and SMS share a UX. The Matched tab filters
-- on read=false by default so once you ack a reply it disappears
-- from Matched and only re-surfaces in the All tab.

ALTER TABLE public.sms_messages
  ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.sms_messages.read IS
  'TRUE once the user marks the reply as read (per-message ack). Matched view hides read messages by default.';
