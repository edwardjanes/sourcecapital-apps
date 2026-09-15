-- Restore RLS policies for deck_submissions table
-- These ensure proper access control for admin and regular users

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can see own submissions" ON deck_submissions;
DROP POLICY IF EXISTS "Admin can see all submissions" ON deck_submissions;
DROP POLICY IF EXISTS "Users can insert own submissions" ON deck_submissions;
DROP POLICY IF EXISTS "Users can update own submissions" ON deck_submissions;

-- Enable RLS if not already enabled
ALTER TABLE deck_submissions ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can see their own submissions
CREATE POLICY "Users can see own submissions"
  ON deck_submissions FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Admins can see all submissions
CREATE POLICY "Admin can see all submissions"
  ON deck_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.sc_admin = true
    )
  );

-- Policy 3: Users can insert their own submissions
CREATE POLICY "Users can insert own submissions"
  ON deck_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can update their own submissions
CREATE POLICY "Users can update own submissions"
  ON deck_submissions FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy 5: Admins can update any submission
CREATE POLICY "Admin can update any submission"
  ON deck_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.sc_admin = true
    )
  );
