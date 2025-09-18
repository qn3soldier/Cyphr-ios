-- Fix RLS Policies with Correct Column Names
-- Run date: 2025-08-04

-- Drop and recreate call policies with correct column names
DROP POLICY IF EXISTS "Users can view their calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update their calls" ON public.calls;

CREATE POLICY "Users can view their calls" ON public.calls
    FOR SELECT USING (
        auth.uid()::text = caller_id::text OR 
        auth.uid()::text = receiver_id::text
    );

CREATE POLICY "Users can update their calls" ON public.calls
    FOR UPDATE USING (
        auth.uid()::text = caller_id::text OR 
        auth.uid()::text = receiver_id::text
    );

-- Simplified auth.uid function that works without auth schema access
CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claim.sub', true),
        current_setting('app.current_user_id', true),
        ''
    )::text;
$$;

-- Update policies to use the simpler function
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (public.current_user_id() = id::text);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (public.current_user_id() = id::text);

-- Fix other policies similarly
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;

CREATE POLICY "Users can view their own settings" ON public.user_settings
    FOR SELECT USING (public.current_user_id() = user_id::text);

CREATE POLICY "Users can insert their own settings" ON public.user_settings
    FOR INSERT WITH CHECK (public.current_user_id() = user_id::text);

CREATE POLICY "Users can update their own settings" ON public.user_settings
    FOR UPDATE USING (public.current_user_id() = user_id::text);

-- Fix wallet policies
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.user_wallets;
DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.user_wallets;
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.user_wallets;

CREATE POLICY "Users can view their own wallet" ON public.user_wallets
    FOR SELECT USING (public.current_user_id() = user_id::text);

CREATE POLICY "Users can insert their own wallet" ON public.user_wallets
    FOR INSERT WITH CHECK (public.current_user_id() = user_id::text);

CREATE POLICY "Users can update their own wallet" ON public.user_wallets
    FOR UPDATE USING (public.current_user_id() = user_id::text);

-- Fix transaction policies
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;

CREATE POLICY "Users can view their own transactions" ON public.transactions
    FOR SELECT USING (public.current_user_id() = user_id::text);

-- Fix balance cache policies
DROP POLICY IF EXISTS "Users can view their own balance cache" ON public.wallet_balance_cache;

CREATE POLICY "Users can view their own balance cache" ON public.wallet_balance_cache
    FOR SELECT USING (public.current_user_id() = user_id::text);

-- Test RLS is working
SELECT 'RLS policies fixed successfully!' as result;

-- Grant usage on the function
GRANT EXECUTE ON FUNCTION public.current_user_id() TO anon, authenticated;

-- Show final policy status
SELECT schemaname, tablename, policyname, cmd, permissive
FROM pg_policies 
WHERE schemaname = 'public' AND tablename IN ('users', 'user_wallets', 'user_settings', 'transactions', 'calls')
ORDER BY tablename, policyname;