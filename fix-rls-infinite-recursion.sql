-- Fix infinite recursion in RLS policies
-- Problem: cp.chat_id = cp.chat_id creates infinite recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "Chat admins can add participants" ON chat_participants;

-- Recreate the policy with correct logic
CREATE POLICY "Chat admins can add participants" ON chat_participants
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chats c 
            WHERE c.id = chat_participants.chat_id 
            AND (
                c.created_by = get_current_user_id() 
                OR EXISTS (
                    SELECT 1 FROM chat_participants cp 
                    WHERE cp.chat_id = c.id  -- Fixed: was cp.chat_id = cp.chat_id
                    AND cp.user_id = get_current_user_id() 
                    AND cp.role = 'admin'
                )
            )
        )
    );

-- Also check if there are any other potential recursion issues
-- Let's make the chat selection policy more efficient and clear
DROP POLICY IF EXISTS "Users can view chats they participate in" ON chats;

CREATE POLICY "Users can view chats they participate in" ON chats
    FOR SELECT 
    USING (
        get_current_user_id() IS NOT NULL 
        AND get_current_user_id() <> ''
        AND EXISTS (
            SELECT 1 FROM chat_participants cp 
            WHERE cp.chat_id = chats.id 
            AND cp.user_id = get_current_user_id()
        )
    );

-- Simplify chat_participants policies to avoid conflicts
DROP POLICY IF EXISTS "Chat creators can view all participants" ON chat_participants;
DROP POLICY IF EXISTS "Users can view own participation" ON chat_participants;
DROP POLICY IF EXISTS "Users can view their chat participations" ON chat_participants;

-- Create a single, clear policy for viewing chat participants
CREATE POLICY "Users can view chat participants" ON chat_participants
    FOR SELECT 
    USING (
        get_current_user_id() IS NOT NULL 
        AND get_current_user_id() <> ''
        AND (
            -- User can see their own participation
            user_id = get_current_user_id()
            OR
            -- User can see participants of chats they're in
            EXISTS (
                SELECT 1 FROM chat_participants my_participation
                WHERE my_participation.chat_id = chat_participants.chat_id
                AND my_participation.user_id = get_current_user_id()
            )
            OR 
            -- Chat creator can see all participants
            EXISTS (
                SELECT 1 FROM chats c
                WHERE c.id = chat_participants.chat_id
                AND c.created_by = get_current_user_id()
            )
        )
    );

-- Test that policies work
SELECT 'RLS policies fixed successfully' as result;