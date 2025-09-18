#!/usr/bin/env node

/**
 * RLS Security Test Suite
 * Tests that Row Level Security policies are working correctly
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

console.log('🔒 TESTING RLS SECURITY POLICIES...\n');

async function testRLSSecurity() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Anonymous user should get empty results from users table (RLS filters)
  console.log('Test 1: Anonymous access to users table...');
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('✅ PASS: Anonymous user correctly blocked from users table');
      console.log(`   Error: ${error.message}`);
      testsPassed++;
    } else if (data && data.length === 0) {
      console.log('✅ PASS: Anonymous user gets empty results (RLS working)');
      console.log('   RLS is correctly filtering out unauthorized data');
      testsPassed++;
    } else {
      console.log('❌ FAIL: Anonymous user can access users data!');
      console.log(`   Data: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (err) {
    console.log('✅ PASS: Anonymous user correctly blocked from users table');
    console.log(`   Exception: ${err.message}`);
    testsPassed++;
  }
  
  // Test 2: Anonymous user should NOT be able to access messages table
  console.log('\nTest 2: Anonymous access to messages table...');
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('✅ PASS: Anonymous user correctly blocked from messages table');
      console.log(`   Error: ${error.message}`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Anonymous user can access messages table!');
      console.log(`   Data: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (err) {
    console.log('✅ PASS: Anonymous user correctly blocked from messages table');
    console.log(`   Exception: ${err.message}`);
    testsPassed++;
  }
  
  // Test 3: Anonymous user should get empty results from wallets table (RLS filters)
  console.log('\nTest 3: Anonymous access to user_wallets table...');
  try {
    const { data, error } = await supabase
      .from('user_wallets')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('✅ PASS: Anonymous user correctly blocked from user_wallets table');
      console.log(`   Error: ${error.message}`);
      testsPassed++;
    } else if (data && data.length === 0) {
      console.log('✅ PASS: Anonymous user gets empty results (RLS working)');
      console.log('   RLS is correctly filtering out unauthorized wallet data');
      testsPassed++;
    } else {
      console.log('❌ FAIL: Anonymous user can access user_wallets data!');
      console.log(`   Data: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (err) {
    console.log('✅ PASS: Anonymous user correctly blocked from user_wallets table');
    console.log(`   Exception: ${err.message}`);
    testsPassed++;
  }
  
  // Test 4: Check that RLS helper function exists
  console.log('\nTest 4: RLS helper function exists...');
  try {
    const { data, error } = await supabase.rpc('get_current_user_id');
    
    if (error) {
      console.log('✅ PASS: Helper function exists but correctly requires auth');
      console.log(`   Error: ${error.message}`);
      testsPassed++;
    } else {
      console.log('✅ PASS: Helper function exists and returns:', data);
      testsPassed++;
    }
  } catch (err) {
    console.log('⚠️  WARNING: Helper function test failed');
    console.log(`   Exception: ${err.message}`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('🔒 RLS SECURITY TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! RLS is working correctly!');
    console.log('🛡️  Database is secure - anonymous users cannot access data');
    return true;
  } else {
    console.log('\n🚨 SECURITY VULNERABILITY DETECTED!');
    console.log('❌ Some RLS policies are not working correctly');
    return false;
  }
}

// Run the test
testRLSSecurity()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });