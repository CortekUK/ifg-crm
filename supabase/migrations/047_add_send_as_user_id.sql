ALTER TABLE automation_enrollments
  ADD COLUMN IF NOT EXISTS send_as_user_id UUID REFERENCES profiles(id);
