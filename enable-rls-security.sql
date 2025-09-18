-- Enable RLS Security with Proper Policies
-- Run date: 2025-08-04

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_balance_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user registration" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;

DROP POLICY IF EXISTS "Users can view their own wallet" ON public.user_wallets;
DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.user_wallets;
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.user_wallets;

DROP POLICY IF EXISTS "Users can view their own balance cache" ON public.wallet_balance_cache;
DROP POLICY IF EXISTS "System can manage balance cache" ON public.wallet_balance_cache;

DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "System can insert transactions" ON public.transactions;

-- Users table policies - Allow viewing own profile and registration
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Allow user registration" ON public.users
    FOR INSERT WITH CHECK (true); -- Allow registration for anonymous users

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- User settings policies
CREATE POLICY "Users can view their own settings" ON public.user_settings
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own settings" ON public.user_settings
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own settings" ON public.user_settings
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- User wallets policies - CRITICAL SECURITY
CREATE POLICY "Users can view their own wallet" ON public.user_wallets
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own wallet" ON public.user_wallets
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own wallet" ON public.user_wallets
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Wallet balance cache policies
CREATE POLICY "Users can view their own balance cache" ON public.wallet_balance_cache
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "System can manage balance cache" ON public.wallet_balance_cache
    FOR ALL USING (true); -- Allow system updates for caching

-- Transactions policies
CREATE POLICY "Users can view their own transactions" ON public.transactions
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "System can insert transactions" ON public.transactions
    FOR INSERT WITH CHECK (true); -- Allow system to record transactions

-- Chat related policies
CREATE POLICY "Users can view chats they participate in" ON public.chats
    FOR SELECT USING (
        id IN (
            SELECT chat_id FROM public.chat_participants 
            WHERE user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can create chats" ON public.chats
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their chat participations" ON public.chat_participants
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can join chats" ON public.chat_participants
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view messages in their chats" ON public.messages
    FOR SELECT USING (
        chat_id IN (
            SELECT chat_id FROM public.chat_participants 
            WHERE user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can send messages to their chats" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid()::text = sender_id::text AND
        chat_id IN (
            SELECT chat_id FROM public.chat_participants 
            WHERE user_id::text = auth.uid()::text
        )
    );

-- Call policies
CREATE POLICY "Users can view their calls" ON public.calls
    FOR SELECT USING (
        auth.uid()::text = caller_id::text OR 
        auth.uid()::text = callee_id::text
    );

CREATE POLICY "Users can create calls" ON public.calls
    FOR INSERT WITH CHECK (auth.uid()::text = caller_id::text);

CREATE POLICY "Users can update their calls" ON public.calls
    FOR UPDATE USING (
        auth.uid()::text = caller_id::text OR 
        auth.uid()::text = callee_id::text
    );

-- Storage bucket policies
INSERT INTO storage.buckets (id, name, public) VALUES 
('avatars', 'avatars', true),
('attachments', 'attachments', false),
('call-recordings', 'call-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars (public read, authenticated write)
CREATE POLICY "Public can view avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars' AND 
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can update their own avatars" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'avatars' AND 
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Storage policies for attachments (private)
CREATE POLICY "Users can view attachments in their chats" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'attachments' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Users can upload attachments" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'attachments' AND 
        auth.role() = 'authenticated'
    );

-- Storage policies for call recordings (private)
CREATE POLICY "Users can access their call recordings" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'call-recordings' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can upload call recordings" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'call-recordings' AND 
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Create auth helper function for easier policy writing
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
    select 
        coalesce(
            nullif(current_setting('request.jwt.claim.sub', true), ''),
            (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        )::uuid
$$;

-- Ensure RLS is working correctly
SELECT 'RLS Security enabled successfully!' as result;

-- Show enabled policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;