-- Enhanced User Wallets Schema for Cyphr Messenger
-- Adds Lobstr-like wallet architecture to existing sophisticated database

-- Create the enhanced user_wallets table
CREATE TABLE IF NOT EXISTS public.user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Encrypted seed phrase storage (ChaCha20 + PBKDF2)
  encrypted_seed_phrase TEXT NOT NULL,
  salt TEXT NOT NULL,
  iterations INTEGER NOT NULL DEFAULT 100000,
  
  -- Wallet metadata
  wallet_type TEXT NOT NULL DEFAULT 'hd_wallet',
  wallet_name TEXT DEFAULT 'Main Wallet',
  
  -- Cached addresses for quick access
  stellar_address TEXT NOT NULL,
  bitcoin_address TEXT,  -- Future: BTC support
  ethereum_address TEXT, -- Future: ETH support
  
  -- Security and sync
  last_pin_change TIMESTAMP,
  biometric_enabled BOOLEAN DEFAULT false,
  device_fingerprint TEXT, -- For multi-device security
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_user_wallet UNIQUE(user_id, wallet_type),
  CONSTRAINT valid_stellar_address CHECK (stellar_address ~ '^G[0-9A-Z]{55}$')
);

-- Create wallet_balance_cache table for 5-minute performance caching
CREATE TABLE IF NOT EXISTS public.wallet_balance_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.user_wallets(id) ON DELETE CASCADE,
  stellar_address TEXT NOT NULL,
  
  -- Cached balance data (JSONB for performance)
  balance_data JSONB NOT NULL,
  asset_prices JSONB,
  total_value_usd DECIMAL(20,8),
  
  -- Cache metadata with 5-minute TTL
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '5 minutes',
  
  CONSTRAINT unique_wallet_cache UNIQUE(wallet_id)
);

-- Create wallet_transaction_cache table for transaction history caching
CREATE TABLE IF NOT EXISTS public.wallet_transaction_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.user_wallets(id) ON DELETE CASCADE,
  stellar_address TEXT NOT NULL,
  
  -- Transaction data (JSONB for complex transaction objects)
  transaction_data JSONB NOT NULL,
  last_cursor TEXT, -- Stellar API cursor for pagination
  
  -- Cache metadata with 2-minute TTL (transactions change frequently)
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '2 minutes',
  
  CONSTRAINT unique_transaction_cache UNIQUE(wallet_id)
);

-- Disable RLS for development (matching existing database pattern)
ALTER TABLE public.user_wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_balance_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transaction_cache DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies (matching existing pattern)
DROP POLICY IF EXISTS "Allow all user_wallets operations" ON public.user_wallets;
DROP POLICY IF EXISTS "Allow all wallet_balance_cache operations" ON public.wallet_balance_cache;
DROP POLICY IF EXISTS "Allow all wallet_transaction_cache operations" ON public.wallet_transaction_cache;

-- Create performance indexes for user_wallets
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON public.user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_stellar_address ON public.user_wallets(stellar_address);
CREATE INDEX IF NOT EXISTS idx_user_wallets_type ON public.user_wallets(wallet_type);
CREATE INDEX IF NOT EXISTS idx_user_wallets_last_accessed ON public.user_wallets(last_accessed);

-- Create performance indexes for wallet_balance_cache
CREATE INDEX IF NOT EXISTS idx_wallet_cache_expires ON public.wallet_balance_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_wallet_cache_address ON public.wallet_balance_cache(stellar_address);
CREATE INDEX IF NOT EXISTS idx_wallet_cache_wallet_id ON public.wallet_balance_cache(wallet_id);

-- Create performance indexes for wallet_transaction_cache
CREATE INDEX IF NOT EXISTS idx_tx_cache_expires ON public.wallet_transaction_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_tx_cache_address ON public.wallet_transaction_cache(stellar_address);
CREATE INDEX IF NOT EXISTS idx_tx_cache_wallet_id ON public.wallet_transaction_cache(wallet_id);

-- Create the update_updated_at_column function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create updated_at trigger for user_wallets (matching existing pattern)
CREATE TRIGGER update_user_wallets_updated_at BEFORE UPDATE ON public.user_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create updated_at trigger for cache tables
CREATE TRIGGER update_wallet_balance_cache_updated_at BEFORE UPDATE ON public.wallet_balance_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_transaction_cache_updated_at BEFORE UPDATE ON public.wallet_transaction_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.user_wallets IS 'HD wallets bound to user accounts with Lobstr-like encrypted seed storage';
COMMENT ON COLUMN public.user_wallets.encrypted_seed_phrase IS 'ChaCha20 encrypted BIP39 seed phrase';
COMMENT ON COLUMN public.user_wallets.salt IS 'PBKDF2 salt for key derivation';
COMMENT ON COLUMN public.user_wallets.device_fingerprint IS 'Device identification for multi-device security';

COMMENT ON TABLE public.wallet_balance_cache IS 'Cached balance data for 5-minute performance optimization';
COMMENT ON TABLE public.wallet_transaction_cache IS 'Cached transaction history for 2-minute faster loading';

-- Success message
SELECT 'SUCCESS: Enhanced user_wallets schema deployed for Lobstr-like wallet architecture' AS deployment_status;