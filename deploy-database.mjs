#!/usr/bin/env node
/**
 * DATABASE DEPLOYMENT SCRIPT
 * Deploys user_wallets schema to Supabase with proper error handling
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY;

console.log('🚀 DEPLOYING DATABASE SCHEMA TO SUPABASE...');
console.log('URL:', SUPABASE_URL);
console.log('Service Key Length:', SUPABASE_SERVICE_KEY?.length);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials!');
  process.exit(1);
}

// Create service role client (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testConnection() {
  console.log('\n🔍 TESTING DATABASE CONNECTION...');
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.error('❌ Connection test failed:', error.message);
      return false;
    }
    console.log('✅ Database connection successful');
    return true;
  } catch (err) {
    console.error('❌ Connection exception:', err.message);
    return false;
  }
}

async function createUserWalletsTable() {
  console.log('\n📊 ENHANCING DATABASE WITH user_wallets TABLE...');
  
  // First, create the SQL execution function if it doesn't exist
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION public.execute_sql(sql_text text)
    RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql_text;
      RETURN 'SUCCESS';
    EXCEPTION
      WHEN others THEN
        RETURN SQLERRM;
    END;
    $$;
  `;
  
  console.log('🔧 Creating SQL execution function...');
  try {
    // Try to create the function using direct SQL via HTTP
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ sql_text: createFunctionSQL })
    });
    
    if (response.ok) {
      console.log('✅ SQL execution function created');
    }
  } catch (err) {
    console.log('⚠️ Function creation attempt:', err.message);
  }
  
  const createTableSQL = `
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
    
    -- Disable RLS for development (matching existing pattern)
    ALTER TABLE public.user_wallets DISABLE ROW LEVEL SECURITY;
    
    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON public.user_wallets(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_wallets_stellar_address ON public.user_wallets(stellar_address);
    CREATE INDEX IF NOT EXISTS idx_user_wallets_type ON public.user_wallets(wallet_type);
  `;
  
  try {
    // Try multiple approaches to execute SQL
    console.log('📊 Attempting to create user_wallets table...');
    
    // Method 1: Try with our function
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY
        },
        body: JSON.stringify({ sql_text: createTableSQL })
      });
      
      const result = await response.text();
      if (response.ok && result.includes('SUCCESS')) {
        console.log('✅ user_wallets table created via function');
        return true;
      }
    } catch (funcErr) {
      console.log('⚠️ Function method failed:', funcErr.message);
    }
    
    // Method 2: Try direct table access to check if it exists
    const { data, error } = await supabase.from('user_wallets').select('count').limit(1);
    if (!error) {
      console.log('✅ user_wallets table already exists');
      return true;
    }
    
    console.log('⚠️ user_wallets table needs manual creation');
    console.log('📋 SQL to execute in Supabase Studio:');
    console.log(createTableSQL);
    return false;
    
  } catch (err) {
    console.log('⚠️ user_wallets table creation failed:', err.message);
    return false;
  }
}

async function createBalanceCacheTable() {
  console.log('\n💾 ENHANCING WITH wallet_balance_cache TABLE...');
  
  const createCacheSQL = `
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
    
    -- Disable RLS for development (matching existing pattern)
    ALTER TABLE public.wallet_balance_cache DISABLE ROW LEVEL SECURITY;
    
    -- Performance indexes for cache queries
    CREATE INDEX IF NOT EXISTS idx_wallet_cache_expires ON public.wallet_balance_cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_wallet_cache_address ON public.wallet_balance_cache(stellar_address);
    CREATE INDEX IF NOT EXISTS idx_wallet_cache_wallet_id ON public.wallet_balance_cache(wallet_id);
  `;
  
  try {
    // Try with enhanced function approach
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY
        },
        body: JSON.stringify({ sql_text: createCacheSQL })
      });
      
      const result = await response.text();
      if (response.ok && result.includes('SUCCESS')) {
        console.log('✅ wallet_balance_cache table created via function');
        return true;
      }
    } catch (funcErr) {
      console.log('⚠️ Function method failed:', funcErr.message);
    }
    
    // Check if table exists
    const { data, error } = await supabase.from('wallet_balance_cache').select('count').limit(1);
    if (!error) {
      console.log('✅ wallet_balance_cache table already exists');
      return true;
    }
    
    console.log('⚠️ wallet_balance_cache table needs manual creation');
    return false;
    
  } catch (err) {
    console.log('⚠️ wallet_balance_cache creation failed:', err.message);
    return false;
  }
}

async function createTransactionCacheTable() {
  console.log('\n🔄 ENHANCING WITH wallet_transaction_cache TABLE...');
  
  const createTxCacheSQL = `
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
    
    -- Disable RLS for development (matching existing pattern)
    ALTER TABLE public.wallet_transaction_cache DISABLE ROW LEVEL SECURITY;
    
    -- Indexes for transaction cache performance
    CREATE INDEX IF NOT EXISTS idx_tx_cache_expires ON public.wallet_transaction_cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_tx_cache_address ON public.wallet_transaction_cache(stellar_address);
    CREATE INDEX IF NOT EXISTS idx_tx_cache_wallet_id ON public.wallet_transaction_cache(wallet_id);
  `;
  
  try {
    // Try with enhanced function approach
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY
        },
        body: JSON.stringify({ sql_text: createTxCacheSQL })
      });
      
      const result = await response.text();
      if (response.ok && result.includes('SUCCESS')) {
        console.log('✅ wallet_transaction_cache table created via function');
        return true;
      }
    } catch (funcErr) {
      console.log('⚠️ Function method failed:', funcErr.message);
    }
    
    // Check if table exists
    const { data, error } = await supabase.from('wallet_transaction_cache').select('count').limit(1);
    if (!error) {
      console.log('✅ wallet_transaction_cache table already exists');
      return true;
    }
    
    console.log('⚠️ wallet_transaction_cache table needs manual creation');
    return false;
    
  } catch (err) {
    console.log('⚠️ wallet_transaction_cache creation failed:', err.message);
    return false;
  }
}

async function createIndexes() {
  console.log('\n📈 CREATING PERFORMANCE INDEXES...');
  
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_user_wallets_stellar_address ON user_wallets(stellar_address);',
    'CREATE INDEX IF NOT EXISTS idx_wallet_cache_expires ON wallet_balance_cache(expires_at);',
    'CREATE INDEX IF NOT EXISTS idx_wallet_cache_address ON wallet_balance_cache(stellar_address);'
  ];
  
  let successCount = 0;
  for (const indexSQL of indexes) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: indexSQL });
      if (!error) successCount++;
    } catch (err) {
      console.log('⚠️ Index creation failed:', err.message);
    }
  }
  
  console.log(`✅ ${successCount}/${indexes.length} indexes created`);
  return successCount > 0;
}

async function verifyDeployment() {
  console.log('\n🔍 VERIFYING DEPLOYMENT...');
  
  const tables = ['user_wallets', 'wallet_balance_cache', 'wallet_transaction_cache'];
  const results = {};
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('count').limit(1);
      results[table] = !error;
      console.log(`${!error ? '✅' : '❌'} ${table}: ${!error ? 'EXISTS' : error.message}`);
    } catch (err) {
      results[table] = false;
      console.log(`❌ ${table}: ${err.message}`);
    }
  }
  
  const successCount = Object.values(results).filter(Boolean).length;
  console.log(`\n📊 DEPLOYMENT RESULT: ${successCount}/${tables.length} tables deployed`);
  
  return successCount === tables.length;
}

async function main() {
  try {
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to database. Aborting deployment.');
      process.exit(1);
    }
    
    // Deploy schema
    let success = true;
    success &= await createUserWalletsTable();
    success &= await createBalanceCacheTable();
    success &= await createTransactionCacheTable();
    success &= await createIndexes();
    
    // Verify deployment
    const verified = await verifyDeployment();
    
    if (verified) {
      console.log('\n🎉 DATABASE SCHEMA DEPLOYMENT SUCCESSFUL!');
      console.log('✅ All user_wallets tables are ready for Lobstr-like wallet functionality');
      process.exit(0);
    } else {
      console.log('\n⚠️ PARTIAL DEPLOYMENT - Some tables may need manual creation');
      console.log('📋 Check Supabase dashboard: http://127.0.0.1:54321/project/default/sql/new');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ DEPLOYMENT FAILED:', error.message);
    process.exit(1);
  }
}

main();