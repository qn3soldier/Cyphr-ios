-- Final fix for RLS infinite recursion - v2
-- Problem: Cross-references between chats and chat_participants create loops

-- Temporarily disable RLS to fix policies
ALTER TABLE chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start clean
DROP POLICY IF EXISTS "Users can view their chats" ON chats;
DROP POLICY IF EXISTS "Users can create chats" ON chats;
DROP POLICY IF EXISTS "Chat creators can update" ON chats;
DROP POLICY IF EXISTS "Users can view own participations" ON chat_participants;
DROP POLICY IF EXISTS "Chat creators can view participants" ON chat_participants;
DROP POLICY IF EXISTS "Admins can add participants" ON chat_participants;
DROP POLICY IF EXISTS "Users can join chats" ON chat_participants;
DROP POLICY IF EXISTS "Users can leave chats" ON chat_participants;

-- Create simple, non-recursive policies

-- CHATS TABLE - Simple policies without chat_participants references
CREATE POLICY "Users can view own chats" ON chats
    FOR SELECT 
    USING (
        get_current_user_id() IS NOT NULL 
        AND get_current_user_id() <> ''
        AND created_by = get_current_user_id()
    );

CREATE POLICY "Users can create chats" ON chats
    FOR INSERT 
    WITH CHECK (
        get_current_user_id() IS NOT NULL 
        AND get_current_user_id() <> ''
        AND created_by = get_current_user_id()
    );

CREATE POLICY "Chat creators can update" ON chats
    FOR UPDATE 
    USING (
        get_current_user_id() IS NOT NULL 
        AND get_current_user_id() <> ''
        AND created_by = get_current_user_id()
    );

-- CHAT_PARTICIPANTS TABLE - Simple policies without chats references
CREATE POLICY "Users can view own participations" ON chat_participants
    FOR SELECT 
    USING (
        get_current_user_id() IS NOT NULL 
        AND get_current_user_id() <> ''
        AND user_id = get_current_user_id()
    );

CREATE POLICY "Users can join public chats" ON chat_participants
    FOR INSERT 
    WITH CHECK (
        get_current_user_id() IS NOT NULL 
        AND get_current_user_id() <> ''
        AND user_id = get_current_user_id()
    );

CREATE POLICY "Users can leave chats" ON chat_participants
    FOR DELETE 
    USING (
        get_current_user_id() IS NOT NULL 
        AND get_current_user_id() <> ''
        AND user_id = get_current_user_id()
    );

-- Re-enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

SELECT 'Simple RLS policies created without recursion' as result;