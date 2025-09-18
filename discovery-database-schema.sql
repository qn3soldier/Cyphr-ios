-- 🚀 CYPHR DISCOVERY DATABASE SCHEMA
-- Revolutionary user discovery system database updates
-- Supporting all 6 discovery methods with zero-knowledge privacy

-- =============================================================================
-- USERS TABLE ENHANCEMENTS
-- =============================================================================

-- Add discovery-related columns to existing users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS cyphr_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS phone_discovery_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS nearby_discovery_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS share_link_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS cyphr_id_changed_at TIMESTAMP WITH TIME ZONE;

-- Create unique index for cyphr_id (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cyphr_id_unique 
ON public.users (LOWER(cyphr_id)) 
WHERE cyphr_id IS NOT NULL;

-- Create index for faster cyphr_id lookups
CREATE INDEX IF NOT EXISTS idx_users_cyphr_id_lookup 
ON public.users (cyphr_id) 
WHERE cyphr_id IS NOT NULL;

-- =============================================================================
-- DISCOVERY TOKENS TABLE
-- =============================================================================

-- Temporary tokens for QR codes, share links, etc.
CREATE TABLE IF NOT EXISTS public.discovery_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_type TEXT NOT NULL CHECK (token_type IN ('qr', 'share_link', 'nearby', 'handshake')),
  token_value TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for discovery_tokens
CREATE INDEX IF NOT EXISTS idx_discovery_tokens_user_id ON public.discovery_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_discovery_tokens_type ON public.discovery_tokens (token_type);
CREATE INDEX IF NOT EXISTS idx_discovery_tokens_value ON public.discovery_tokens (token_value);
CREATE INDEX IF NOT EXISTS idx_discovery_tokens_expires ON public.discovery_tokens (expires_at);

-- Auto-cleanup trigger for expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_discovery_tokens()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.discovery_tokens 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run cleanup on insert
DROP TRIGGER IF EXISTS trigger_cleanup_expired_tokens ON public.discovery_tokens;
CREATE TRIGGER trigger_cleanup_expired_tokens
  AFTER INSERT ON public.discovery_tokens
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_expired_discovery_tokens();

-- =============================================================================
-- PHONE HASHES TABLE
-- =============================================================================

-- Phone number hashes for optional phone discovery
CREATE TABLE IF NOT EXISTS public.phone_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_hash TEXT NOT NULL UNIQUE, -- Triple-hashed phone number
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for phone_hashes
CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_hashes_user_id_unique ON public.phone_hashes (user_id);
CREATE INDEX IF NOT EXISTS idx_phone_hashes_hash_lookup ON public.phone_hashes (phone_hash);

-- =============================================================================
-- NEARBY DISCOVERY TABLE
-- =============================================================================

-- Temporary nearby user visibility
CREATE TABLE IF NOT EXISTS public.nearby_discovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  region_hash TEXT NOT NULL, -- Approximate location hash (not exact GPS)
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for nearby_discovery
CREATE INDEX IF NOT EXISTS idx_nearby_discovery_user_id ON public.nearby_discovery (user_id);
CREATE INDEX IF NOT EXISTS idx_nearby_discovery_region ON public.nearby_discovery (region_hash);
CREATE INDEX IF NOT EXISTS idx_nearby_discovery_expires ON public.nearby_discovery (expires_at);
CREATE INDEX IF NOT EXISTS idx_nearby_discovery_active ON public.nearby_discovery (region_hash, expires_at) 
WHERE expires_at > NOW();

-- Auto-cleanup trigger for expired nearby discoveries
CREATE OR REPLACE FUNCTION cleanup_expired_nearby_discovery()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.nearby_discovery 
  WHERE expires_at < NOW() - INTERVAL '30 minutes';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run cleanup on insert
DROP TRIGGER IF EXISTS trigger_cleanup_expired_nearby ON public.nearby_discovery;
CREATE TRIGGER trigger_cleanup_expired_nearby
  AFTER INSERT ON public.nearby_discovery
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_expired_nearby_discovery();

-- =============================================================================
-- QUANTUM HANDSHAKE SESSIONS TABLE
-- =============================================================================

-- P2P handshake sessions for quantum handshake method
CREATE TABLE IF NOT EXISTS public.handshake_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  responder_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  handshake_seed TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'expired', 'failed')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for handshake_sessions
CREATE INDEX IF NOT EXISTS idx_handshake_sessions_initiator ON public.handshake_sessions (initiator_user_id);
CREATE INDEX IF NOT EXISTS idx_handshake_sessions_responder ON public.handshake_sessions (responder_user_id);
CREATE INDEX IF NOT EXISTS idx_handshake_sessions_token ON public.handshake_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_handshake_sessions_status ON public.handshake_sessions (status);
CREATE INDEX IF NOT EXISTS idx_handshake_sessions_expires ON public.handshake_sessions (expires_at);

-- =============================================================================
-- DISCOVERY ANALYTICS TABLE (PRIVACY-COMPLIANT)
-- =============================================================================

-- Anonymized discovery method usage analytics
CREATE TABLE IF NOT EXISTS public.discovery_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method_type TEXT NOT NULL CHECK (method_type IN ('cyphr_id', 'qr_code', 'share_link', 'quantum_handshake', 'nearby', 'phone')),
  action_type TEXT NOT NULL CHECK (action_type IN ('search', 'generate', 'scan', 'enable', 'disable')),
  success BOOLEAN NOT NULL,
  region_hash TEXT, -- General region only, no exact location
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- NO user_id or personal data - completely anonymous
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for discovery_analytics
CREATE INDEX IF NOT EXISTS idx_discovery_analytics_method ON public.discovery_analytics (method_type);
CREATE INDEX IF NOT EXISTS idx_discovery_analytics_action ON public.discovery_analytics (action_type);
CREATE INDEX IF NOT EXISTS idx_discovery_analytics_created ON public.discovery_analytics (created_at);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all discovery tables
ALTER TABLE public.discovery_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nearby_discovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handshake_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_analytics ENABLE ROW LEVEL SECURITY;

-- Discovery tokens policies
CREATE POLICY IF NOT EXISTS "Users can manage their own discovery tokens"
ON public.discovery_tokens
FOR ALL
USING (auth.uid() = user_id);

-- Phone hashes policies
CREATE POLICY IF NOT EXISTS "Users can manage their own phone hashes"
ON public.phone_hashes
FOR ALL
USING (auth.uid() = user_id);

-- Nearby discovery policies
CREATE POLICY IF NOT EXISTS "Users can manage their own nearby discovery"
ON public.nearby_discovery
FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can view nearby users in same region"
ON public.nearby_discovery
FOR SELECT
USING (expires_at > NOW());

-- Handshake sessions policies
CREATE POLICY IF NOT EXISTS "Users can manage handshake sessions they initiated"
ON public.handshake_sessions
FOR ALL
USING (auth.uid() = initiator_user_id OR auth.uid() = responder_user_id);

-- Discovery analytics policies (read-only, anonymous)
CREATE POLICY IF NOT EXISTS "Analytics are read-only and anonymous"
ON public.discovery_analytics
FOR SELECT
USING (true);

-- =============================================================================
-- FUNCTIONS FOR DISCOVERY OPERATIONS
-- =============================================================================

-- Function to generate secure random tokens
CREATE OR REPLACE FUNCTION generate_discovery_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check cyphr_id availability
CREATE OR REPLACE FUNCTION check_cyphr_id_available(cyphr_id_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  clean_id TEXT;
  existing_count INTEGER;
BEGIN
  -- Clean and validate input
  clean_id := LOWER(TRIM(REPLACE(cyphr_id_input, '@', '')));
  
  -- Check format (3-20 characters, alphanumeric + underscore)
  IF clean_id !~ '^[a-z0-9_]{3,20}$' THEN
    RETURN FALSE;
  END IF;
  
  -- Check if already exists
  SELECT COUNT(*) INTO existing_count
  FROM public.users
  WHERE cyphr_id = clean_id;
  
  RETURN existing_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search users by cyphr_id with privacy protection
CREATE OR REPLACE FUNCTION search_by_cyphr_id(cyphr_id_input TEXT)
RETURNS TABLE (
  user_id UUID,
  cyphr_id TEXT,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  status TEXT
) AS $$
DECLARE
  clean_id TEXT;
BEGIN
  clean_id := LOWER(TRIM(REPLACE(cyphr_id_input, '@', '')));
  
  RETURN QUERY
  SELECT 
    u.id,
    '@' || u.cyphr_id,
    u.full_name,
    u.avatar_url,
    u.bio,
    u.status
  FROM public.users u
  WHERE u.cyphr_id = clean_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired records
CREATE OR REPLACE FUNCTION cleanup_expired_discovery_data()
RETURNS INTEGER AS $$
DECLARE
  cleaned_count INTEGER := 0;
BEGIN
  -- Clean up expired discovery tokens
  DELETE FROM public.discovery_tokens 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Clean up expired nearby discovery
  DELETE FROM public.nearby_discovery 
  WHERE expires_at < NOW() - INTERVAL '30 minutes';
  
  GET DIAGNOSTICS cleaned_count = cleaned_count + ROW_COUNT;
  
  -- Clean up expired handshake sessions
  DELETE FROM public.handshake_sessions 
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS cleaned_count = cleaned_count + ROW_COUNT;
  
  -- Clean up old analytics (keep 30 days)
  DELETE FROM public.discovery_analytics 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS cleaned_count = cleaned_count + ROW_COUNT;
  
  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SCHEDULED CLEANUP JOB
-- =============================================================================

-- Create extension if not exists (requires superuser)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup job to run every 15 minutes
-- This would typically be done by a database administrator
/*
SELECT cron.schedule(
  'cleanup-discovery-data',
  '*/15 * * * *', -- Every 15 minutes
  'SELECT cleanup_expired_discovery_data();'
);
*/

-- =============================================================================
-- VIEWS FOR ANALYTICS (PRIVACY-SAFE)
-- =============================================================================

-- Discovery method usage statistics (no personal data)
CREATE OR REPLACE VIEW discovery_usage_stats AS
SELECT 
  method_type,
  action_type,
  COUNT(*) as usage_count,
  COUNT(*) FILTER (WHERE success = true) as success_count,
  ROUND(COUNT(*) FILTER (WHERE success = true) * 100.0 / COUNT(*), 2) as success_rate,
  DATE_TRUNC('day', created_at) as usage_date
FROM public.discovery_analytics
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY method_type, action_type, DATE_TRUNC('day', created_at)
ORDER BY usage_date DESC, usage_count DESC;

-- Active discovery features summary
CREATE OR REPLACE VIEW active_discovery_summary AS
SELECT 
  COUNT(*) FILTER (WHERE cyphr_id IS NOT NULL) as users_with_cyphr_id,
  COUNT(*) FILTER (WHERE phone_discovery_enabled = true) as phone_discovery_enabled,
  COUNT(*) FILTER (WHERE nearby_discovery_enabled = true) as nearby_discovery_enabled,
  COUNT(*) FILTER (WHERE share_link_enabled = true) as share_link_enabled,
  (SELECT COUNT(*) FROM public.discovery_tokens WHERE expires_at > NOW()) as active_tokens,
  (SELECT COUNT(*) FROM public.nearby_discovery WHERE expires_at > NOW()) as active_nearby_sessions
FROM public.users;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_hashes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nearby_discovery TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.handshake_sessions TO authenticated;
GRANT SELECT, INSERT ON public.discovery_analytics TO authenticated;

-- Grant permissions on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION generate_discovery_token() TO authenticated;
GRANT EXECUTE ON FUNCTION check_cyphr_id_available(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_by_cyphr_id(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_discovery_data() TO authenticated;

-- =============================================================================
-- SAMPLE DATA FOR TESTING
-- =============================================================================

-- Insert sample Cyphr IDs for testing (only in development)
/*
INSERT INTO public.users (id, cyphr_id, full_name, share_link_enabled, nearby_discovery_enabled, phone_discovery_enabled)
VALUES 
  (gen_random_uuid(), 'alice_quantum', 'Alice Quantum', true, true, false),
  (gen_random_uuid(), 'bob_crypto', 'Bob Crypto', true, false, true),
  (gen_random_uuid(), 'charlie_secure', 'Charlie Secure', false, true, true)
ON CONFLICT (cyphr_id) DO NOTHING;
*/

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify schema creation
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'discovery_tokens', 'phone_hashes', 'nearby_discovery', 'handshake_sessions', 'discovery_analytics')
ORDER BY table_name, ordinal_position;

-- Verify indexes
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename LIKE '%discovery%' OR tablename = 'users'
ORDER BY tablename, indexname;

-- Verify functions
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%discovery%' OR routine_name LIKE '%cyphr%'
ORDER BY routine_name;

-- =============================================================================
-- FINALIZATION
-- =============================================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '🚀 CYPHR DISCOVERY DATABASE SCHEMA INSTALLATION COMPLETE!';
  RAISE NOTICE '✅ Tables created: discovery_tokens, phone_hashes, nearby_discovery, handshake_sessions, discovery_analytics';
  RAISE NOTICE '✅ Users table enhanced with discovery columns';
  RAISE NOTICE '✅ Indexes, triggers, and RLS policies configured';
  RAISE NOTICE '✅ Helper functions and views created';
  RAISE NOTICE '🎯 Ready for revolutionary 6-method user discovery system!';
END $$;