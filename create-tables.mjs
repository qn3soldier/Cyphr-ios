import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZn35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, serviceKey);

async function createTables() {
  console.log('🚀 Creating user_wallets tables manually...');
  
  // Test connection first
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.log('⚠️ Connection test result:', error.message);
    } else {
      console.log('✅ Supabase connection working');
    }
  } catch (err) {
    console.log('⚠️ Connection test failed:', err.message);
  }
  
  // Since we can't execute raw SQL easily, let's try a different approach
  // We'll test if we can at least insert test data to verify table structure
  
  console.log('\n🔍 Testing if user_wallets table exists by trying to read from it...');
  
  try {
    const { data, error } = await supabase
      .from('user_wallets')
      .select('id')
      .limit(1);
      
    if (error) {
      if (error.code === '42P01') {
        console.log('❌ user_wallets table does NOT exist');
        console.log('📋 Table needs to be created in Supabase dashboard SQL editor');
        console.log('\n💡 MANUAL STEPS REQUIRED:');
        console.log('1. Open http://127.0.0.1:54321/project/default/sql/new');
        console.log('2. Copy and paste the contents of user-wallets-schema.sql');
        console.log('3. Click "Run" to execute the SQL');
        console.log('4. Then re-run this test');
        return false;
      } else {
        console.log('⚠️ Other error:', error);
      }
    } else {
      console.log('✅ user_wallets table exists!');
      console.log('📊 Table data:', data);
      return true;
    }
  } catch (err) {
    console.log('❌ Error testing table:', err.message);
  }
  
  return false;
}

// Test all required tables
async function verifyAllTables() {
  const tables = ['user_wallets', 'wallet_balance_cache', 'wallet_transaction_cache'];
  const results = {};
  
  for (const table of tables) {
    console.log(`\n🔍 Testing ${table} table...`);
    try {
      const { data, error } = await supabase
        .from(table)
        .select('count')
        .limit(1);
        
      if (error) {
        if (error.code === '42P01') {
          console.log(`❌ ${table} table does NOT exist`);
          results[table] = false;
        } else {
          console.log(`⚠️ ${table} other error:`, error.message);
          results[table] = 'error';
        }
      } else {
        console.log(`✅ ${table} table exists!`);
        results[table] = true;
      }
    } catch (err) {
      console.log(`❌ ${table} exception:`, err.message);
      results[table] = 'exception';
    }
  }
  
  console.log('\n📊 TABLE VERIFICATION RESULTS:');
  console.log('================================');
  for (const [table, status] of Object.entries(results)) {
    const emoji = status === true ? '✅' : status === false ? '❌' : '⚠️';
    console.log(`${emoji} ${table}: ${status}`);
  }
  
  const allExist = Object.values(results).every(status => status === true);
  
  if (allExist) {
    console.log('\n🎉 ALL TABLES EXIST - READY FOR WALLET TESTING!');
  } else {
    console.log('\n📋 MANUAL ACTION REQUIRED:');
    console.log('1. Open Supabase dashboard: http://127.0.0.1:54321/project/default/sql/new');
    console.log('2. Execute the contents of user-wallets-schema.sql');
    console.log('3. Re-run this verification script');
  }
  
  return allExist;
}

// Run verification
verifyAllTables();