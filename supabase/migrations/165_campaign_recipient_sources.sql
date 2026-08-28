-- Campaigns can already be *composed* against lists, tags and pipeline stages
-- in the UI, but only `recipient_list_ids` was ever persisted. Tag and stage
-- selections were silently dropped on save, so a campaign built from tags went
-- out to nobody. These two columns close that gap; the send path (API route +
-- process-campaigns edge function) unions all three sources and de-duplicates.
--
-- Additive and nullable — existing list-only campaigns keep working untouched.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS recipient_tag_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recipient_stage_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN campaigns.recipient_tag_ids IS
  'Tags whose contacts receive this campaign. Unioned with recipient_list_ids and recipient_stage_ids, then de-duplicated.';
COMMENT ON COLUMN campaigns.recipient_stage_ids IS
  'Pipeline stages whose active deals'' contacts receive this campaign. Unioned with recipient_list_ids and recipient_tag_ids, then de-duplicated.';
