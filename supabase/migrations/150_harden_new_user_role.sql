-- Harden handle_new_user against privilege escalation.
--
-- Previously the trigger blindly trusted `raw_user_meta_data->>'role'`. Because
-- auth.signUp is callable with the public anon key and accepts arbitrary
-- user_metadata, anyone could self-register requesting role='super_admin' and
-- the trigger would create a super_admin profile.
--
-- Defense in depth (public signups are also disabled at the project level):
-- staff roles (recruiter/admin/super_admin) may ONLY be created for an email on
-- a verified professional domain. Legitimate staff invites already use these
-- domains; players/guardians (role 'player') may use any domain. Anything else
-- aborts the signup.
--
-- Keep the domain list in sync with lib/config/email-domain.ts.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_role   text := COALESCE(NEW.raw_user_meta_data->>'role', 'recruiter');
  v_domain text := lower(split_part(COALESCE(NEW.email, ''), '@', 2));
BEGIN
  IF v_role IN ('recruiter', 'admin', 'super_admin')
     AND v_domain NOT IN ('theinternationalfootballgroup.com', 'macclesfieldfc.com') THEN
    RAISE EXCEPTION 'Staff accounts must use a professional domain email (got %)', NEW.email;
  END IF;

  INSERT INTO public.profiles (
    id, email, full_name, role, sport, title, phone, calendly_url, zoom_url,
    contact_id, guardian_for_contact_id
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'sport', 'football'),
    NEW.raw_user_meta_data->>'title',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'calendly_url',
    NEW.raw_user_meta_data->>'zoom_url',
    (NEW.raw_user_meta_data->>'contact_id')::UUID,
    (NEW.raw_user_meta_data->>'guardian_for_contact_id')::UUID
  );
  RETURN NEW;
END;
$function$;
