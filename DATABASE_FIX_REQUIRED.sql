-- 🚨 CRITICAL DATABASE SCHEMA FIXES FOR CYPHR MESSENGER
-- Execute in Supabase SQL Editor immediately
-- Date: August 26, 2025
-- Purpose: Enable email authentication, @cyphr_id system, and discovery features

-- =====================================================
-- PART 1: CRITICAL FIXES FOR USERS TABLE
-- =====================================================

-- 1. Make phone column nullable (allows email-only users)
ALTER TABLE public.users 
ALTER COLUMN phone DROP NOT NULL;

-- 2. Add cyphr_id column for username-based discovery (@alice_quantum style)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS cyphr_id TEXT UNIQUE;

-- 3. Add auth_method column to track registration type
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS auth_method TEXT DEFAULT 'phone';

-- 4. Add email_hash for zero-knowledge email storage (SHA-256 hashed)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS email_hash TEXT UNIQUE;

-- 5. Add discovery-related columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS phone_discovery_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS nearby_discovery_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS share_link_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cyphr_id_changed_at TIMESTAMP WITH TIME ZONE;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_cyphr_id ON public.users(cyphr_id);
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON public.users(email_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cyphr_id_unique 
ON public.users (LOWER(cyphr_id)) WHERE cyphr_id IS NOT NULL;

-- =====================================================
-- PART 2: DISCOVERY TOKENS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.discovery_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_type TEXT NOT NULL CHECK (token_type IN ('qr', 'share_link', 'nearby')),
  token_value TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_discovery_tokens_user_id ON public.discovery_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_discovery_tokens_value ON public.discovery_tokens(token_value);
CREATE INDEX IF NOT EXISTS idx_discovery_tokens_expires ON public.discovery_tokens(expires_at);

-- =====================================================
-- PART 3: PHONE HASHES TABLE (for optional phone discovery)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.phone_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_hashes_user_id_unique ON public.phone_hashes(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_hashes_hash_lookup ON public.phone_hashes(phone_hash);

-- =====================================================
-- PART 4: NEARBY DISCOVERY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.nearby_discovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  region_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_nearby_discovery_user_id ON public.nearby_discovery(user_id);
CREATE INDEX IF NOT EXISTS idx_nearby_discovery_region ON public.nearby_discovery(region_hash);
CREATE INDEX IF NOT EXISTS idx_nearby_discovery_expires ON public.nearby_discovery(expires_at);

-- =====================================================
-- PART 5: HELPER FUNCTIONS
-- =====================================================

-- Function to check cyphr_id availability
CREATE OR REPLACE FUNCTION check_cyphr_id_available(cyphr_id_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  clean_id TEXT;
  existing_count INTEGER;
BEGIN
  clean_id := LOWER(TRIM(REPLACE(cyphr_id_input, '@', '')));
  
  IF clean_id !~ '^[a-z0-9_]{3,20}$' THEN
    RETURN FALSE;
  END IF;
  
  SELECT COUNT(*) INTO existing_count
  FROM public.users
  WHERE cyphr_id = clean_id;
  
  RETURN existing_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate secure tokens
CREATE OR REPLACE FUNCTION generate_discovery_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 6: ROW LEVEL SECURITY (keep existing settings)
-- =====================================================

-- Keep RLS disabled as per existing schema
ALTER TABLE public.discovery_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_hashes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.nearby_discovery DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- PART 7: VERIFY ALL CHANGES
-- =====================================================

-- Check users table modifications
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
    AND column_name IN ('phone', 'cyphr_id', 'email_hash', 'auth_method', 
                        'phone_discovery_enabled', 'nearby_discovery_enabled', 
                        'share_link_enabled')
ORDER BY column_name;

-- Check new tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('discovery_tokens', 'phone_hashes', 'nearby_discovery');

-- Expected results:
-- ✅ phone column is nullable (YES)
-- ✅ cyphr_id column exists
-- ✅ email_hash column exists  
-- ✅ auth_method column exists with default 'phone'
-- ✅ discovery settings columns exist
-- ✅ discovery_tokens table exists
-- ✅ phone_hashes table exists
-- ✅ nearby_discovery table exists