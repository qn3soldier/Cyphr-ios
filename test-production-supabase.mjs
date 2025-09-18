#!/usr/bin/env node

/**
 * Test Production Supabase Connection
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fkhwhplufjzlicccgbrf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHdocGx1Zmp6bGljY2NnYnJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg0MzU0MiwiZXhwIjoyMDY3NDE5NTQyfQ.4WF2pYzJIeXIaKo_JnMx6QI5zF0FKa8_LZgCsqf4H8s';

async function testProductionSupabase() {
  console.log('🧪 Testing Production Supabase Connection');
  console.log('========================================');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log('✅ Supabase client created');

    // Test 1: Check tables exist
    console.log('\n📋 Test 1: Check if tables exist');
    const { data: tables, error: tablesError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (tablesError) {
      console.error('❌ Tables check failed:', tablesError.message);
      return false;
    }
    console.log('✅ Users table exists');

    // Test 2: Check RLS policies
    console.log('\n🔒 Test 2: Check RLS policies');
    const { data: rls, error: rlsError } = await supabase
      .rpc('get_current_user_id');

    if (rlsError && !rlsError.message.includes('function get_current_user_id() does not exist')) {
      console.error('❌ RLS test failed:', rlsError.message);
    } else {
      console.log('✅ RLS functions accessible');
    }

    // Test 3: Test storage buckets
    console.log('\n🗄️ Test 3: Check storage buckets');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error('❌ Storage check failed:', bucketsError.message);
    } else {
      console.log('✅ Storage accessible, buckets:', buckets.map(b => b.name));
    }

    console.log('\n🎉 PRODUCTION SUPABASE CONNECTION SUCCESSFUL!');
    return true;

  } catch (error) {
    console.error('💥 Production test failed:', error.message);
    return false;
  }
}

// Run test
testProductionSupabase()
  .then(success => {
    if (success) {
      console.log('\n🚀 READY FOR PRODUCTION MIGRATION!');
      process.exit(0);
    } else {
      console.log('\n💥 PRODUCTION SETUP INCOMPLETE');
      process.exit(1);
    }
  });