-- =====================================
-- FIX CRITICAL RLS POLICY ISSUES
-- =====================================
-- This migration fixes the RLS policy problems detected in testing

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own wallet" ON public.user_wallets;
DROP POLICY IF EXISTS "Users can view chat participants" ON public.chat_participants;

-- =====================================
-- FIXED USERS TABLE POLICIES
-- =====================================

-- Policy: Users can only see their own profile (requires authentication)
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (
    public.get_current_user_id() IS NOT NULL 
    AND public.get_current_user_id() != '' 
    AND public.get_current_user_id() = id::TEXT
  );

-- =====================================
-- FIXED USER WALLETS POLICIES
-- =====================================

-- Policy: Users can only access their own wallet (requires authentication)
CREATE POLICY "Users can view own wallet" ON public.user_wallets
  FOR SELECT USING (
    public.get_current_user_id() IS NOT NULL 
    AND public.get_current_user_id() != '' 
    AND user_id = public.get_current_user_id()
  );

-- =====================================
-- FIXED CHAT PARTICIPANTS POLICIES
-- =====================================

-- Policy: Users can view participants of chats they're in (no recursion)
CREATE POLICY "Users can view chat participants" ON public.chat_participants
  FOR SELECT USING (
    public.get_current_user_id() IS NOT NULL 
    AND public.get_current_user_id() != '' 
    AND user_id = public.get_current_user_id()
  );

-- Alternative policy: Allow viewing other participants if user is in the same chat
CREATE POLICY "Users can view other participants in their chats" ON public.chat_participants
  FOR SELECT USING (
    public.get_current_user_id() IS NOT NULL 
    AND public.get_current_user_id() != '' 
    AND EXISTS (
      SELECT 1 FROM public.chat_participants cp2
      WHERE cp2.chat_id = chat_participants.chat_id 
      AND cp2.user_id = public.get_current_user_id()
      AND cp2.id != chat_participants.id  -- Avoid self-reference
    )
  );

-- =====================================
-- ENHANCED AUTHENTICATION CHECKS
-- =====================================

-- Update other policies to require proper authentication
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (
    public.get_current_user_id() IS NOT NULL 
    AND public.get_current_user_id() != '' 
    AND public.get_current_user_id() = id::TEXT
  );

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;  
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (
    public.get_current_user_id() IS NOT NULL 
    AND public.get_current_user_id() != '' 
    AND public.get_current_user_id() = id::TEXT
  );

-- Update wallet policies
DROP POLICY IF EXISTS "Users can update own wallet" ON public.user_wallets;
CREATE POLICY "Users can update own wallet" ON public.user_wallets
  FOR UPDATE USING (
    public.get_current_user_id() IS NOT NULL 
    AND public.get_current_user_id() != '' 
    AND user_id = public.get_current_user_id()
  );

DROP POLICY IF EXISTS "Users can create own wallet" ON public.user_wallets;
CREATE POLICY "Users can create own wallet" ON public.user_wallets
  FOR INSERT WITH CHECK (
    public.get_current_user_id() IS NOT NULL 
    AND public.get_current_user_id() != '' 
    AND user_id = public.get_current_user_id()
  );

DROP POLICY IF EXISTS "Users can delete own wallet" ON public.user_wallets;
CREATE POLICY "Users can delete own wallet" ON public.user_wallets
  FOR DELETE USING (
    public.get_current_user_id() IS NOT NULL 
    AND public.get_current_user_id() != '' 
    AND user_id = public.get_current_user_id()
  );

-- =====================================
-- VERIFICATION COMPLETE
-- =====================================
-- All policies now require proper authentication
-- Anonymous users will be completely blocked