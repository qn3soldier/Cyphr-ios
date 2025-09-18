-- =====================================
-- SECURE STORAGE PERMISSIONS
-- =====================================
-- This migration secures file storage with proper RLS policies

-- Note: RLS is already enabled on storage.objects by default in Supabase

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;

-- =====================================
-- AVATAR STORAGE POLICIES
-- =====================================

-- Policy: Users can upload their own avatars (folder structure: user_id/filename)
CREATE POLICY "Users can upload own avatars" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    public.get_current_user_id() IS NOT NULL AND
    public.get_current_user_id() != '' AND
    -- Check that the file path starts with user's ID
    (storage.foldername(name))[1] = public.get_current_user_id()
  );

-- Policy: Anyone can view avatars (public read for profile pictures)
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Policy: Users can update their own avatars
CREATE POLICY "Users can update own avatars" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND
    public.get_current_user_id() IS NOT NULL AND
    public.get_current_user_id() != '' AND
    (storage.foldername(name))[1] = public.get_current_user_id()
  );

-- Policy: Users can delete their own avatars
CREATE POLICY "Users can delete own avatars" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND
    public.get_current_user_id() IS NOT NULL AND
    public.get_current_user_id() != '' AND
    (storage.foldername(name))[1] = public.get_current_user_id()
  );

-- =====================================
-- CREATE ADDITIONAL SECURE BUCKETS
-- =====================================

-- Create bucket for message attachments (private)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attachments', 'attachments', false) 
ON CONFLICT (id) DO NOTHING;

-- Create bucket for voice messages (private)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('voice-messages', 'voice-messages', false) 
ON CONFLICT (id) DO NOTHING;

-- =====================================
-- ATTACHMENTS STORAGE POLICIES
-- =====================================

-- Policy: Users can upload attachments to chats they participate in
CREATE POLICY "Users can upload chat attachments" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'attachments' AND
    public.get_current_user_id() IS NOT NULL AND
    public.get_current_user_id() != '' AND
    -- File path should be: chat_id/user_id/filename
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id::TEXT = (storage.foldername(name))[1]
      AND cp.user_id = public.get_current_user_id()
    )
  );

-- Policy: Users can view attachments in chats they participate in
CREATE POLICY "Users can view chat attachments" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'attachments' AND
    public.get_current_user_id() IS NOT NULL AND
    public.get_current_user_id() != '' AND
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id::TEXT = (storage.foldername(name))[1]
      AND cp.user_id = public.get_current_user_id()
    )
  );

-- Policy: Users can delete their own attachments
CREATE POLICY "Users can delete own attachments" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'attachments' AND
    public.get_current_user_id() IS NOT NULL AND
    public.get_current_user_id() != '' AND
    (storage.foldername(name))[2] = public.get_current_user_id()
  );

-- =====================================
-- VOICE MESSAGES STORAGE POLICIES
-- =====================================

-- Policy: Users can upload voice messages to chats they participate in
CREATE POLICY "Users can upload voice messages" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'voice-messages' AND
    public.get_current_user_id() IS NOT NULL AND
    public.get_current_user_id() != '' AND
    -- File path should be: chat_id/user_id/filename
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id::TEXT = (storage.foldername(name))[1]
      AND cp.user_id = public.get_current_user_id()
    )
  );

-- Policy: Users can view voice messages in chats they participate in
CREATE POLICY "Users can view voice messages" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'voice-messages' AND
    public.get_current_user_id() IS NOT NULL AND
    public.get_current_user_id() != '' AND
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id::TEXT = (storage.foldername(name))[1]
      AND cp.user_id = public.get_current_user_id()
    )
  );

-- Policy: Users can delete their own voice messages
CREATE POLICY "Users can delete own voice messages" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'voice-messages' AND
    public.get_current_user_id() IS NOT NULL AND
    public.get_current_user_id() != '' AND
    (storage.foldername(name))[2] = public.get_current_user_id()
  );

-- =====================================
-- STORAGE SECURITY VERIFICATION
-- =====================================
-- All storage buckets now have proper RLS policies
-- - avatars: Public read, users can manage their own
-- - attachments: Private, only chat participants can access
-- - voice-messages: Private, only chat participants can access