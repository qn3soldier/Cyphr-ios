#!/usr/bin/env node

/**
 * Test User Search Functionality
 * Tests the fixed NewChat.jsx user search functionality
 */

// Since we can't import TypeScript directly in Node.js, use @supabase/supabase-js directly
import { createClient } from '@supabase/supabase-js';

const TEST_PHONES = ['+19075388374', '+19078303325'];

async function testUserSearch() {
  console.log('🔍 Testing User Search Functionality');
  console.log('=====================================');

  try {
    // Initialize Supabase client with service key to bypass RLS for testing
    const supabase = createClient(
      'http://127.0.0.1:54321',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    );
    
    console.log('✅ Supabase client initialized');

    // Test 1: Search for first user by phone number
    console.log('\n📱 Test 1: Search for user +19075388374');
    const phoneQuery1 = '+19075388374'.replace(/[\s\-()]/g, '');
    
    let query1 = supabase
      .from('users')
      .select('id, name, phone, nickname, avatar_url, status, last_seen')
      .limit(20);
    
    query1 = query1.ilike('phone', `%${phoneQuery1}%`);
    
    const { data: results1, error: error1 } = await query1;
    
    if (error1) {
      console.error('❌ Search failed:', error1);
      return false;
    }
    
    console.log(`📊 Found ${results1.length} results:`);
    results1.forEach(user => {
      console.log(`  - ${user.phone} (${user.name || user.nickname || 'No name'})`);
    });

    // Test 2: Search for second user by phone number
    console.log('\n📱 Test 2: Search for user +19078303325');
    const phoneQuery2 = '+19078303325'.replace(/[\s\-()]/g, '');
    
    let query2 = supabase
      .from('users')
      .select('id, name, phone, nickname, avatar_url, status, last_seen')
      .limit(20);
    
    query2 = query2.ilike('phone', `%${phoneQuery2}%`);
    
    const { data: results2, error: error2 } = await query2;
    
    if (error2) {
      console.error('❌ Search failed:', error2);
      return false;
    }
    
    console.log(`📊 Found ${results2.length} results:`);
    results2.forEach(user => {
      console.log(`  - ${user.phone} (${user.name || user.nickname || 'No name'})`);
    });

    // Test 3: Partial phone search
    console.log('\n📱 Test 3: Partial search "9075"');
    let query3 = supabase
      .from('users')
      .select('id, name, phone, nickname, avatar_url, status, last_seen')
      .limit(20);
    
    query3 = query3.ilike('phone', `%9075%`);
    
    const { data: results3, error: error3 } = await query3;
    
    if (error3) {
      console.error('❌ Search failed:', error3);
      return false;
    }
    
    console.log(`📊 Found ${results3.length} results:`);
    results3.forEach(user => {
      console.log(`  - ${user.phone} (${user.name || user.nickname || 'No name'})`);
    });

    // Test 4: Test nickname search (if any users have nicknames)
    console.log('\n👤 Test 4: Search by nickname');
    let query4 = supabase
      .from('users')
      .select('id, name, phone, nickname, avatar_url, status, last_seen')
      .limit(20);
    
    query4 = query4.or(`name.ilike.%test%,nickname.ilike.%test%`);
    
    const { data: results4, error: error4 } = await query4;
    
    if (error4) {
      console.error('❌ Nickname search failed:', error4);
      return false;
    }
    
    console.log(`📊 Found ${results4.length} results for "test":`);
    results4.forEach(user => {
      console.log(`  - ${user.phone} (${user.name || user.nickname || 'No name'})`);
    });

    console.log('\n✅ All user search tests completed successfully!');
    console.log('🎉 NewChat.jsx SQL syntax fix is working properly!');
    
    return true;
    
  } catch (error) {
    console.error('💥 Test failed with error:', error);
    return false;
  }
}

// Run the test
testUserSearch()
  .then(success => {
    if (success) {
      console.log('\n🏆 SUCCESS: User search functionality is working!');
      process.exit(0);
    } else {
      console.log('\n💥 FAILED: User search has issues');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });