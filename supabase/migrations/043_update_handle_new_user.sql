-- Update handle_new_user() to copy invite metadata into profiles
-- When inviteUserByEmail() is called, Supabase creates the auth.users row immediately
-- with raw_user_meta_data containing the fields we passed. This trigger copies them to profiles.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, sport, title, phone, calendly_url, zoom_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'recruiter'),
    COALESCE(NEW.raw_user_meta_data->>'sport', 'football'),
    NEW.raw_user_meta_data->>'title',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'calendly_url',
    NEW.raw_user_meta_data->>'zoom_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
