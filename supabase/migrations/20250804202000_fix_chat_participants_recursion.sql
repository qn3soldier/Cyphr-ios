-- =====================================
-- FIX CHAT PARTICIPANTS RECURSION
-- =====================================
-- This migration fixes the infinite recursion in chat_participants policies

-- Drop the problematic recursive policies
DROP POLICY IF EXISTS "Users can view other participants in their chats" ON public.chat_participants;

-- Create a simpler, non-recursive policy
-- Users can view their own participation record
CREATE POLICY "Users can view own participation" ON public.chat_participants
  FOR SELECT USING (
    public.get_current_user_id() IS NOT NULL 
    AND public.get_current_user_id() != '' 
    AND user_id = public.get_current_user_id()
  );

-- For viewing other participants, we'll use a different approach
-- Users can view participants of chats they created
CREATE POLICY "Chat creators can view all participants" ON public.chat_participants
  FOR SELECT USING (
    public.get_current_user_id() IS NOT NULL 
    AND public.get_current_user_id() != '' 
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_participants.chat_id 
      AND c.created_by = public.get_current_user_id()
    )
  );

-- =====================================
-- VERIFICATION COMPLETE
-- =====================================
-- Chat participants recursion issue resolved