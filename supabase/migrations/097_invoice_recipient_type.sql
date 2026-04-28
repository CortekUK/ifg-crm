-- Migration: who receives the invoice email — player (contact.email) or
-- guardian (contact.parent_email). Resolution happens at send time so updates
-- to the contact's email/parent_email are always picked up. Either party can
-- still pay the invoice; this only governs the recipient address.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS recipient_type TEXT NOT NULL DEFAULT 'player'
  CHECK (recipient_type IN ('player', 'guardian'));
