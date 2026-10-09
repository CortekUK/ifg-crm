-- QA-57 Issue 2: changing a player's parent email left the OLD parent holding
-- portal access.
--
-- The guardian login is a profiles row with guardian_for_contact_id pointing
-- at the player. Changing contacts.parent_email did nothing to it, so the
-- previous parent kept a working account showing the player's invoices and
-- details. app/api/portal/invite does remove the stale guardian — but only
-- when staff next press Invite or Resend. Until somebody did, the old parent
-- still had access, and nothing on screen said so.
--
-- Editing the parent email IS the revocation. It is the only signal we get
-- that the previous parent should no longer be able to see the player.
--
-- Deactivating rather than deleting, deliberately:
--   * is_active = false locks them out on their very next request — the
--     middleware signs out a deactivated account and bounces it to the login
--     page (lib/supabase/middleware.ts), so access ends immediately
--   * the row and its guardian_for_contact_id survive, so the invite route
--     can still find it and clean up the auth user properly on the next
--     invite. Nulling the link here would orphan the auth user instead, which
--     is the bug QA-56 Issue 2 is about.
--
-- Only ever touches guardian rows (guardian_for_contact_id = the edited
-- contact, role 'player'). The player's own login is keyed on contact_id and
-- is not affected by their parent's email changing.
--
-- Idempotent.

CREATE OR REPLACE FUNCTION revoke_guardian_on_parent_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Nothing to do when the address did not really change. Compared
  -- case-insensitively and with NULLs normalised so re-saving the form
  -- unchanged, or a capitalisation edit, does not lock a parent out.
  IF lower(COALESCE(NEW.parent_email, '')) = lower(COALESCE(OLD.parent_email, '')) THEN
    RETURN NEW;
  END IF;

  UPDATE profiles
  SET is_active = false
  WHERE guardian_for_contact_id = NEW.id
    AND role = 'player'
    AND is_active IS DISTINCT FROM false
    -- Only the parent who is no longer the parent. If the new address already
    -- belongs to this guardian row (staff corrected a typo back), leave it.
    AND lower(COALESCE(email, '')) <> lower(COALESCE(NEW.parent_email, ''));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_parent_email_change_revoke_guardian ON contacts;
CREATE TRIGGER on_parent_email_change_revoke_guardian
  AFTER UPDATE OF parent_email ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION revoke_guardian_on_parent_email_change();
