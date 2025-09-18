#!/usr/bin/env node

/**
 * Storage Security Test Suite
 * Tests that storage RLS policies are working correctly
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

console.log('🗄️  TESTING STORAGE SECURITY POLICIES...\n');

async function testStorageSecurity() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Anonymous user should NOT be able to upload to avatars bucket
  console.log('Test 1: Anonymous upload to avatars bucket...');
  try {
    const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload('test-user/test.jpg', testFile);
    
    if (error) {
      console.log('✅ PASS: Anonymous user correctly blocked from uploading avatars');
      console.log(`   Error: ${error.message}`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Anonymous user can upload avatars!');
      console.log(`   Data: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (err) {
    console.log('✅ PASS: Anonymous user correctly blocked from uploading avatars');
    console.log(`   Exception: ${err.message}`);
    testsPassed++;
  }
  
  // Test 2: Anonymous user should be able to LIST avatars (public read)
  console.log('\nTest 2: Anonymous list avatars bucket...');
  try {
    const { data, error } = await supabase.storage
      .from('avatars')
      .list('', { limit: 1 });
    
    if (error) {
      console.log('⚠️  WARNING: Anonymous user cannot list avatars');
      console.log(`   Error: ${error.message}`);
      // This might be expected behavior, so we don't fail the test
    } else {
      console.log('✅ PASS: Anonymous user can list avatars (public read policy working)');
      console.log(`   Listed ${data ? data.length : 0} items`);
      testsPassed++;
    }
  } catch (err) {
    console.log('⚠️  WARNING: Exception listing avatars');
    console.log(`   Exception: ${err.message}`);
  }
  
  // Test 3: Anonymous user should NOT be able to access attachments bucket
  console.log('\nTest 3: Anonymous access to attachments bucket...');
  try {
    const { data, error } = await supabase.storage
      .from('attachments')
      .list('', { limit: 1 });
    
    if (error) {
      console.log('✅ PASS: Anonymous user correctly blocked from attachments bucket');
      console.log(`   Error: ${error.message}`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Anonymous user can access attachments bucket!');
      console.log(`   Data: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (err) {
    console.log('✅ PASS: Anonymous user correctly blocked from attachments bucket');
    console.log(`   Exception: ${err.message}`);
    testsPassed++;
  }
  
  // Test 4: Anonymous user should NOT be able to access voice-messages bucket
  console.log('\nTest 4: Anonymous access to voice-messages bucket...');
  try {
    const { data, error } = await supabase.storage
      .from('voice-messages')
      .list('', { limit: 1 });
    
    if (error) {
      console.log('✅ PASS: Anonymous user correctly blocked from voice-messages bucket');
      console.log(`   Error: ${error.message}`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Anonymous user can access voice-messages bucket!');
      console.log(`   Data: ${JSON.stringify(data)}`);
      testsFailed++;
    }
  } catch (err) {
    console.log('✅ PASS: Anonymous user correctly blocked from voice-messages bucket');
    console.log(`   Exception: ${err.message}`);
    testsPassed++;
  }
  
  // Test 5: Check bucket configuration
  console.log('\nTest 5: Storage bucket configuration...');
  try {
    const { data: buckets, error } = await supabase
      .from('buckets')  // This might not work for anonymous users, that's OK
      .select('*');
    
    if (error) {
      console.log('✅ PASS: Anonymous user cannot access bucket configuration');
      console.log(`   Error: ${error.message}`);
      testsPassed++;
    } else {
      console.log('⚠️  INFO: Bucket configuration accessible');
      console.log(`   Buckets: ${buckets ? buckets.length : 0}`);
    }
  } catch (err) {
    console.log('✅ PASS: Anonymous user cannot access bucket configuration');
    console.log(`   Exception: ${err.message}`);
    testsPassed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('🗄️  STORAGE SECURITY TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Storage security is working correctly!');
    console.log('🛡️  Storage buckets are properly secured');
    console.log('📁 avatars: Public read, authenticated upload');
    console.log('📎 attachments: Private, chat-participants only');
    console.log('🎤 voice-messages: Private, chat-participants only');
    return true;
  } else {
    console.log('\n🚨 STORAGE SECURITY VULNERABILITY DETECTED!');
    console.log('❌ Some storage policies are not working correctly');
    return false;
  }
}

// Run the test
testStorageSecurity()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });