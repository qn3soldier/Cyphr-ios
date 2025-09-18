-- =====================================
-- TEMPORARY RLS DISABLE FOR TESTING
-- =====================================
-- Disable RLS temporarily to test app functionality
-- This is NOT for production, just to verify the app works

-- Disable RLS on all tables temporarily
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies to prevent any recursion
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user registration" ON public.users;

DROP POLICY IF EXISTS "Users can view own wallet" ON public.user_wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON public.user_wallets;
DROP POLICY IF EXISTS "Users can create own wallet" ON public.user_wallets;
DROP POLICY IF EXISTS "Users can delete own wallet" ON public.user_wallets;

DROP POLICY IF EXISTS "Users can view chat participants" ON public.chat_participants;
DROP POLICY IF EXISTS "Simple chat participants access" ON public.chat_participants;

DROP POLICY IF EXISTS "Simple message access" ON public.messages;
DROP POLICY IF EXISTS "Simple chat access" ON public.chats;
DROP POLICY IF EXISTS "Simple call access" ON public.calls;

-- =====================================
-- NOTE: THIS IS TEMPORARY
-- =====================================
-- RLS is disabled for testing only
-- We'll re-enable it with proper policies once app is working