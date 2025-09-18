#!/usr/bin/env node

// Test RDS integration safely
const RDSService = require('./rds-service.cjs');
const { createClient } = require('@supabase/supabase-js');

async function testRDSIntegration() {
  console.log('🧪 TESTING RDS INTEGRATION...\n');

  // Initialize RDS service
  const rdsService = new RDSService();
  
  try {
    // Test 1: RDS Connection
    console.log('📡 Test 1: RDS Connection...');
    const connected = await rdsService.initialize();
    if (!connected) {
      throw new Error('Failed to connect to RDS');
    }
    console.log('✅ RDS Connection successful\n');

    // Test 2: Schema Creation
    console.log('🏗️ Test 2: Schema Creation...');
    const schemaCreated = await rdsService.createSchema();
    if (!schemaCreated) {
      throw new Error('Failed to create RDS schema');
    }
    console.log('✅ Schema created successfully\n');

    // Test 3: Health Check
    console.log('❤️ Test 3: Health Check...');
    const healthy = await rdsService.healthCheck();
    if (!healthy) {
      throw new Error('RDS health check failed');
    }
    console.log('✅ Health check passed\n');

    // Test 4: Basic Query
    console.log('📊 Test 4: Basic Query Test...');
    const result = await rdsService.query('SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = $1', ['public']);
    console.log(`✅ Found ${result.rows[0].table_count} tables in public schema\n`);

    // Test 5: Data Migration Preparation
    console.log('🔄 Test 5: Supabase Data Check...');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fkhwhplufjzlicccgbrf.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: users } = await supabase.from('users').select('*');
      const { data: chats } = await supabase.from('chats').select('*');
      
      console.log(`✅ Supabase data ready: ${users?.length || 0} users, ${chats?.length || 0} chats\n`);
      
      // Optional: Test data migration (comment out for safety)
      // console.log('🔄 Test 6: Data Migration...');
      // const migrated = await rdsService.migrateDataFromSupabase(supabase);
      // console.log(migrated ? '✅ Data migration test successful' : '❌ Data migration failed');
    }

    console.log('🎉 ALL RDS INTEGRATION TESTS PASSED!\n');
    console.log('🚀 Ready for production migration');
    
    return true;
  } catch (error) {
    console.error('❌ RDS Integration Test Failed:', error.message);
    return false;
  } finally {
    await rdsService.close();
  }
}

// Run tests
if (require.main === module) {
  testRDSIntegration()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = testRDSIntegration;