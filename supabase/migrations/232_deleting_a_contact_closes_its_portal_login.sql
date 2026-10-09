-- QA-56 Issue 2: deleting a contact left the player's portal login behind,
-- linked to nothing.
--
-- profiles.contact_id is ON DELETE SET NULL, so removing a contact leaves the
-- account alive with no player attached. Everything the portal shows is found
-- through that link, so the person can still sign in to a portal with nothing
-- in it. QA found this while deleting a contact by mistake, and it is the
-- likely cause of the "loading skeletons that never fill in" the ticket was
-- opened for.
--
-- Twelve active player logins are in this state right now.
--
-- Deactivating rather than deleting is deliberate:
--   * migration 224 already makes is_active = false revoke every portal policy
--     in the database, so a deactivated login can read nothing even with a
--     token it already holds;
--   * the middleware signs it out on the next request;
--   * and the account can be put back by relinking it, which matters when the
--     contact was deleted in error — a hard delete would make that
--     unrecoverable and would need the auth user removed too.
--
-- Guardians are covered by the same trigger: profiles.guardian_for_contact_id
-- is ON DELETE CASCADE, so the row would vanish before this runs — hence the
-- BEFORE DELETE on contacts, which can see both links while they still exist.

CREATE OR REPLACE FUNCTION close_portal_logins_for_deleted_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
  SET is_active = false
  WHERE role = 'player'
    AND is_active IS DISTINCT FROM false
    AND (contact_id = OLD.id OR guardian_for_contact_id = OLD.id);

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION close_portal_logins_for_deleted_contact() IS
  'QA-56 Issue 2: a contact delete closes the player and guardian portal '
  'logins that pointed at it, instead of leaving them active and unlinked.';

DROP TRIGGER IF EXISTS contact_delete_closes_portal_logins ON contacts;
CREATE TRIGGER contact_delete_closes_portal_logins
BEFORE DELETE ON contacts
FOR EACH ROW
EXECUTE FUNCTION close_portal_logins_for_deleted_contact();

-- Repair the existing orphans. Checked first: none of them can read any data
-- (migration 224 already returns NULL for an unlinked profile), so this only
-- stops them signing in to an empty portal. Reversible — relink the profile to
-- a contact and set is_active back to true.
UPDATE profiles
SET is_active = false
WHERE role = 'player'
  AND is_active
  AND contact_id IS NULL
  AND guardian_for_contact_id IS NULL;
