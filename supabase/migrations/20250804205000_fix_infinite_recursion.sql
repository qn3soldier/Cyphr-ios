-- =====================================
-- FIX INFINITE RECURSION IN CHAT_PARTICIPANTS
-- =====================================
-- The policy "Users can view other participants in their chats" causes
-- infinite recursion because it queries chat_participants from within
-- a policy on chat_participants

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view other participants in their chats" ON public.chat_participants;

-- Keep only the simple, non-recursive policy
-- This allows users to see their own participant records
-- Which is sufficient for most use cases

-- For viewing other participants, we'll handle this at the application level
-- or create a separate view/function that doesn't cause recursion

-- =====================================
-- ALTERNATIVE: Simple message access without complex chat logic
-- =====================================

-- Ensure messages table has proper non-recursive policies
DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
CREATE POLICY "Users can view messages" ON public.messages
  FOR SELECT USING (
    public.get_current_user_id() IS NOT NULL 
    AND public.get_current_user_id() != '' 
    AND sender_id = public.get_current_user_id()
  );

-- Allow users to insert their own messages
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
CREATE POLICY "Users can insert messages" ON public.messages
  FOR INSERT WITH CHECK (
    public.get_current_user_id() IS NOT NULL 
    AND public.get_current_user_id() != '' 
    AND sender_id = public.get_current_user_id()
  );

-- =====================================
-- AUDIT LOG
-- =====================================
-- This migration:
-- 1. Removes the recursive chat_participants policy
-- 2. Keeps simple, working policies for messages
-- 3. Prevents infinite recursion errors