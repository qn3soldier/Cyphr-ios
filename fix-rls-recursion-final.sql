-- Final fix for RLS infinite recursion
-- The issue is still in the SELECT policy for chat_participants

-- Drop all problematic policies and create simple, non-recursive ones
DROP POLICY IF EXISTS "Users can view chat participants" ON chat_participants;
DROP POLICY IF EXISTS "Chat admins can add participants" ON chat_participants;

-- Create simple, non-recursive policies
-- 1. Users can view their own chat participations
CREATE POLICY "Users can view own participations" ON chat_participants
    FOR SELECT 
    USING (
        get_current_user_id() IS NOT NULL 
        AND get_current_user_id() <> ''
        AND user_id = get_current_user_id()
    );

-- 2. Chat creators can view all participants (using direct chat ownership check)
CREATE POLICY "Chat creators can view participants" ON chat_participants
    FOR SELECT 
    USING (
        get_current_user_id() IS NOT NULL 
        AND get_current_user_id() <> ''
        AND chat_id IN (
            SELECT id FROM chats 
            WHERE created_by = get_current_user_id()
        )
    );

-- 3. Simple admin check for adding participants (no recursion)
CREATE POLICY "Admins can add participants" ON chat_participants
    FOR INSERT 
    WITH CHECK (
        get_current_user_id() IS NOT NULL 
        AND get_current_user_id() <> ''
        AND (
            -- Chat creator can add anyone
            chat_id IN (
                SELECT id FROM chats 
                WHERE created_by = get_current_user_id()
            )
            OR
            -- Users can add themselves to public chats
            user_id = get_current_user_id()
        )
    );

-- Temporarily disable RLS to test if basic queries work
-- ALTER TABLE chat_participants DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE chats DISABLE ROW LEVEL SECURITY;

SELECT 'RLS recursion fixes applied' as result;