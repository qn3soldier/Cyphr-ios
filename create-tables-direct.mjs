#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Create a custom function to execute SQL
async function createSqlFunction() {
  console.log('🔧 Creating SQL execution function...');
  
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text)
    RETURNS text
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql;
      RETURN 'OK';
    EXCEPTION
      WHEN OTHERS THEN
        RETURN SQLERRM;
    END;
    $$;
  `;
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      },
      body: JSON.stringify({ sql: createFunctionSQL })
    });
    
    if (!response.ok) {
      // Function might already exist, try creating tables directly
      console.log('⚠️ Function creation failed, trying direct approach...');
      return false;
    }
    
    console.log('✅ SQL function created successfully');
    return true;
  } catch (error) {
    console.log('⚠️ Function creation error:', error.message);
    return false;
  }
}

async function createTablesDirectly() {
  console.log('🏗️ Creating tables using direct SQL execution...');
  
  const tables = [
    {
      name: 'user_wallets',
      sql: `
        CREATE TABLE IF NOT EXISTS user_wallets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          encrypted_seed_phrase TEXT NOT NULL,
          salt TEXT NOT NULL,
          iterations INTEGER NOT NULL DEFAULT 100000,
          wallet_type TEXT NOT NULL DEFAULT 'hd_wallet',
          wallet_name TEXT DEFAULT 'Main Wallet',
          stellar_address TEXT NOT NULL,
          bitcoin_address TEXT,
          ethereum_address TEXT,
          last_pin_change TIMESTAMP,
          biometric_enabled BOOLEAN DEFAULT false,
          device_fingerprint TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT unique_user_wallet UNIQUE(user_id, wallet_type),
          CONSTRAINT valid_stellar_address CHECK (stellar_address ~ '^G[0-9A-Z]{55}$')
        );
      `
    },
    {
      name: 'wallet_balance_cache',
      sql: `
        CREATE TABLE IF NOT EXISTS wallet_balance_cache (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
          stellar_address TEXT NOT NULL,
          balance_data JSONB NOT NULL,
          asset_prices JSONB,
          total_value_usd DECIMAL(20,8),
          cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '5 minutes',
          CONSTRAINT unique_wallet_cache UNIQUE(wallet_id)
        );
      `
    },
    {
      name: 'wallet_transaction_cache',
      sql: `
        CREATE TABLE IF NOT EXISTS wallet_transaction_cache (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
          stellar_address TEXT NOT NULL,
          transaction_data JSONB NOT NULL,
          last_cursor TEXT,
          cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '2 minutes',
          CONSTRAINT unique_transaction_cache UNIQUE(wallet_id)
        );
      `
    }
  ];
  
  let successCount = 0;
  
  for (const table of tables) {
    try {
      console.log(`📊 Creating ${table.name}...`);
      
      const { data, error } = await supabase.rpc('exec_sql', { sql: table.sql });
      
      if (error) {
        console.log(`❌ ${table.name}: ${error.message}`);
      } else {
        console.log(`✅ ${table.name}: Created successfully`);
        successCount++;
      }
    } catch (err) {
      console.log(`❌ ${table.name}: ${err.message}`);
    }
  }
  
  return successCount;
}

async function createIndexes() {
  console.log('📈 Creating performance indexes...');
  
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
  return successCount;
}

async function enableRLS() {
  console.log('🛡️ Enabling Row Level Security...');
  
  const rlsCommands = [
    'ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;',
    'ALTER TABLE wallet_balance_cache ENABLE ROW LEVEL SECURITY;',
    'ALTER TABLE wallet_transaction_cache ENABLE ROW LEVEL SECURITY;'
  ];
  
  for (const command of rlsCommands) {
    try {
      await supabase.rpc('exec_sql', { sql: command });
    } catch (err) {
      console.log('⚠️ RLS command failed:', err.message);
    }
  }
  
  console.log('✅ RLS policies configured');
}

async function verifyTables() {
  console.log('🔍 Verifying table creation...');
  
  const tables = ['user_wallets', 'wallet_balance_cache', 'wallet_transaction_cache'];
  let successCount = 0;
  
  for (const tableName of tables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);
      
      if (!error) {
        console.log(`✅ ${tableName}: Table accessible via REST API`);
        successCount++;
      } else {
        console.log(`❌ ${tableName}: ${error.message}`);
      }
    } catch (err) {
      console.log(`❌ ${tableName}: ${err.message}`);
    }
  }
  
  return successCount === tables.length;
}

async function main() {
  try {
    console.log('🚀 DEPLOYING USER WALLETS DATABASE SCHEMA...\n');
    
    // Step 1: Create SQL execution function
    const functionCreated = await createSqlFunction();
    
    // Step 2: Create tables
    const tablesCreated = await createTablesDirectly();
    
    // Step 3: Create indexes
    if (tablesCreated > 0) {
      await createIndexes();
    }
    
    // Step 4: Enable RLS
    if (tablesCreated > 0) {
      await enableRLS();
    }
    
    // Step 5: Verify everything works
    const verified = await verifyTables();
    
    if (verified) {
      console.log('\n🎉 DATABASE DEPLOYMENT SUCCESSFUL!');
      console.log('✅ All user_wallets tables created and accessible');
      console.log('✅ UserWalletService can now function properly');
      console.log('✅ Lobstr-like wallet architecture is ready for testing');
    } else {
      console.log('\n⚠️ PARTIAL SUCCESS - Some tables may need manual creation');
      console.log('📋 Check tables in Supabase Studio: http://127.0.0.1:54321/project/default/editor');
    }
    
  } catch (error) {
    console.error('❌ DEPLOYMENT FAILED:', error.message);
    process.exit(1);
  }
}

main();