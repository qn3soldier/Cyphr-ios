#!/usr/bin/env node

import { readFileSync } from 'fs';

async function executeEnhancedSQL() {
  try {
    console.log('🚀 EXECUTING ENHANCED USER WALLETS SQL...\n');
    
    const sql = readFileSync('user-wallets-enhanced.sql', 'utf8');
    console.log('📄 SQL loaded:', sql.length, 'characters');
    
    const supabaseUrl = 'http://127.0.0.1:54321';
    const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
    
    // First create the SQL execution function
    console.log('🔧 Step 1: Creating SQL execution function...');
    
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION public.execute_enhanced_sql(sql_text text)
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql_text;
        RETURN 'SUCCESS';
      EXCEPTION
        WHEN others THEN
          RETURN 'ERROR: ' || SQLERRM;
      END;
      $$;
    `;
    
    // Try to execute the function creation via HTTP POST
    const functionResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_enhanced_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      },
      body: JSON.stringify({ sql_text: createFunctionSQL })
    });
    
    if (functionResponse.ok) {
      const result = await functionResponse.text();
      console.log('✅ Function creation result:', result);
    } else {
      console.log('⚠️ Function creation status:', functionResponse.status, functionResponse.statusText);
    }
    
    // Execute the main SQL
    console.log('\n🏗️ Step 2: Executing user_wallets schema...');
    
    const sqlResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_enhanced_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      },
      body: JSON.stringify({ sql_text: sql })
    });
    
    if (sqlResponse.ok) {
      const result = await sqlResponse.text();
      console.log('✅ Schema execution result:', result);
    } else {
      const errorText = await sqlResponse.text();
      console.log('❌ Schema execution failed:', sqlResponse.status, errorText);
    }
    
    // Verify tables were created
    console.log('\n🔍 Step 3: Verifying table creation...');
    
    const tables = ['user_wallets', 'wallet_balance_cache', 'wallet_transaction_cache'];
    let successCount = 0;
    
    for (const tableName of tables) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?limit=1`, {
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey
          }
        });
        
        if (response.ok) {
          console.log(`✅ ${tableName}: Table accessible`);
          successCount++;
        } else {
          console.log(`❌ ${tableName}: ${response.status} ${response.statusText}`);
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err.message}`);
      }
    }
    
    if (successCount === tables.length) {
      console.log('\n🎉 SUCCESS: All user_wallets tables deployed!');
      console.log('✅ UserWalletService can now function properly');
      console.log('✅ Lobstr-like wallet architecture is ready');
      return true;
    } else {
      console.log(`\n⚠️ PARTIAL SUCCESS: ${successCount}/${tables.length} tables created`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ EXECUTION FAILED:', error.message);
    
    // Provide fallback instructions
    console.log('\n📋 MANUAL EXECUTION REQUIRED:');
    console.log('1. Open: http://127.0.0.1:54321/project/default/sql/new');
    console.log('2. Copy contents of: user-wallets-enhanced.sql');
    console.log('3. Paste and execute in SQL editor');
    console.log('4. Verify tables are created');
    
    return false;
  }
}

executeEnhancedSQL().then(success => {
  process.exit(success ? 0 : 1);
});