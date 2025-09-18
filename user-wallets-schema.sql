-- User Wallets Schema for Cyphr Messenger
-- Binds HD wallets to user accounts with encrypted seed storage

-- User wallets table
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
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

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_stellar_address ON user_wallets(stellar_address);

-- RLS policies
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;

-- Users can only access their own wallets
CREATE POLICY "Users can access own wallets" ON user_wallets
  FOR ALL USING (
    auth.uid() = user_id OR 
    user_id IN (
      SELECT id FROM users WHERE phone = auth.jwt() ->> 'phone'
    )
  );

-- Service role can manage all wallets (for admin operations)
CREATE POLICY "Service role full access" ON user_wallets
  FOR ALL USING (auth.role() = 'service_role');

-- Balance cache table for performance
CREATE TABLE IF NOT EXISTS wallet_balance_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  stellar_address TEXT NOT NULL,
  
  -- Cached balance data
  balance_data JSONB NOT NULL,
  asset_prices JSONB,
  total_value_usd DECIMAL(20,8),
  
  -- Cache metadata
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '5 minutes',
  
  CONSTRAINT unique_wallet_cache UNIQUE(wallet_id)
);

-- Index for cache performance
CREATE INDEX IF NOT EXISTS idx_wallet_cache_expires ON wallet_balance_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_wallet_cache_address ON wallet_balance_cache(stellar_address);

-- RLS for cache
ALTER TABLE wallet_balance_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own balance cache" ON wallet_balance_cache
  FOR ALL USING (
    wallet_id IN (
      SELECT id FROM user_wallets WHERE user_id = auth.uid()
    )
  );

-- Transaction history cache (for performance)
CREATE TABLE IF NOT EXISTS wallet_transaction_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  stellar_address TEXT NOT NULL,
  
  -- Transaction data
  transaction_data JSONB NOT NULL,
  last_cursor TEXT,
  
  -- Cache metadata
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '2 minutes',
  
  CONSTRAINT unique_transaction_cache UNIQUE(wallet_id)
);

-- RLS for transaction cache
ALTER TABLE wallet_transaction_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own transaction cache" ON wallet_transaction_cache
  FOR ALL USING (
    wallet_id IN (
      SELECT id FROM user_wallets WHERE user_id = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON TABLE user_wallets IS 'HD wallets bound to user accounts with encrypted seed storage';
COMMENT ON COLUMN user_wallets.encrypted_seed_phrase IS 'ChaCha20 encrypted BIP39 seed phrase';
COMMENT ON COLUMN user_wallets.salt IS 'PBKDF2 salt for key derivation';
COMMENT ON COLUMN user_wallets.device_fingerprint IS 'Device identification for multi-device security';

COMMENT ON TABLE wallet_balance_cache IS 'Cached balance data for performance optimization';
COMMENT ON TABLE wallet_transaction_cache IS 'Cached transaction history for faster loading';