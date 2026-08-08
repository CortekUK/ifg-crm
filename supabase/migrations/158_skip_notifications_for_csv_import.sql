-- Don't raise a "New lead" notification for CSV-imported contacts.
--
-- The trigger from migration 076 fires notify_all_users() on every contact
-- insert, which writes one notification row per active admin / super_admin /
-- recruiter. That is correct for a real enquiry, but the historic
-- ActiveCampaign migration inserts 105,463 contacts in one sitting — with a
-- staff of six that is well over half a million notification rows, and the
-- notification bell becomes unusable for everyone.
--
-- A bulk import is not a lead arriving, so it should not notify anyone. Real
-- leads (source 'website_form', 'sms_reply', 'email_reply', 'manual') are
-- unaffected.

CREATE OR REPLACE FUNCTION handle_new_contact_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Bulk CSV imports are a migration, not an event worth notifying about.
  IF NEW.source = 'csv_import' THEN
    RETURN NEW;
  END IF;

  PERFORM notify_all_users(
    'new_lead',
    'New lead',
    COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '') || COALESCE(' — ' || NEW.email, ''),
    '/contacts',
    jsonb_build_object('contact_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
