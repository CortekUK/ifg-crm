-- Fix: Add ON DELETE SET NULL to all FK constraints referencing profiles(id)
-- that are missing it, so users can be deleted without FK violations.
-- For NOT NULL columns, we first drop the NOT NULL constraint.

-- deals.deal_owner_id (NOT NULL) — allow null, set null on delete
ALTER TABLE deals ALTER COLUMN deal_owner_id DROP NOT NULL;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_deal_owner_id_fkey;
ALTER TABLE deals ADD CONSTRAINT deals_deal_owner_id_fkey
  FOREIGN KEY (deal_owner_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- deals.owner_id — set null on delete
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_owner_id_fkey;
ALTER TABLE deals ADD CONSTRAINT deals_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- deal_activities.performed_by_id — set null on delete
ALTER TABLE deal_activities DROP CONSTRAINT IF EXISTS deal_activities_performed_by_id_fkey;
ALTER TABLE deal_activities ADD CONSTRAINT deal_activities_performed_by_id_fkey
  FOREIGN KEY (performed_by_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- campaigns.from_user_id (NOT NULL) — allow null, set null on delete
ALTER TABLE campaigns ALTER COLUMN from_user_id DROP NOT NULL;
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_from_user_id_fkey;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_from_user_id_fkey
  FOREIGN KEY (from_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- campaigns.created_by_id (NOT NULL) — allow null, set null on delete
ALTER TABLE campaigns ALTER COLUMN created_by_id DROP NOT NULL;
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_created_by_id_fkey;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_created_by_id_fkey
  FOREIGN KEY (created_by_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- contacts.owner_id — set null on delete
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_owner_id_fkey;
ALTER TABLE contacts ADD CONSTRAINT contacts_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- invoices.created_by_id (NOT NULL) — allow null, set null on delete
ALTER TABLE invoices ALTER COLUMN created_by_id DROP NOT NULL;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_created_by_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_created_by_id_fkey
  FOREIGN KEY (created_by_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- payments.recorded_by_id (NOT NULL) — allow null, set null on delete
ALTER TABLE payments ALTER COLUMN recorded_by_id DROP NOT NULL;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_recorded_by_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_recorded_by_id_fkey
  FOREIGN KEY (recorded_by_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- user_invites.invited_by — set null on delete
ALTER TABLE user_invites DROP CONSTRAINT IF EXISTS user_invites_invited_by_fkey;
ALTER TABLE user_invites ADD CONSTRAINT user_invites_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- automation_enrollments.send_as_user_id — set null on delete
ALTER TABLE automation_enrollments DROP CONSTRAINT IF EXISTS automation_enrollments_send_as_user_id_fkey;
ALTER TABLE automation_enrollments ADD CONSTRAINT automation_enrollments_send_as_user_id_fkey
  FOREIGN KEY (send_as_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
