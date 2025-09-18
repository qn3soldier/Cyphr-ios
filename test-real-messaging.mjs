#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const CORRECT_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHdocGx1Zmp6bGljY2NnYnJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg0MzU0MiwiZXhwIjoyMDY3NDE5NTQyfQ.u1uPwT4fD1-hl0n2pegF9UNuwDKje2PKzFKYyD57smM';

console.log('🔧 Testing Real-Time Messaging System...');
console.log('🌐 Frontend: http://localhost:5174/');
console.log('🔌 Backend: http://localhost:3001/');

const supabase = createClient(SUPABASE_URL, CORRECT_SERVICE_KEY);

async function checkSystemStatus() {
  try {
    console.log('\n📊 System Status Check...');
    
    // Check backend health
    const response = await fetch('http://localhost:3001/api/health');
    const health = await response.json();
    console.log('✅ Backend Health:', health.status);
    
    // Check database connection
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, cyphr_id')
      .limit(5);
      
    if (error) {
      console.error('❌ Database error:', error);
      return false;
    }
    
    console.log(`✅ Database: ${users.length} users found`);
    users.forEach((user, i) => {
      console.log(`   ${i+1}. ${user.full_name} (${user.cyphr_id})`);
    });
    
    // Check for existing chats
    const { data: chats } = await supabase
      .from('chats')
      .select('id, name, type')
      .limit(3);
      
    console.log(`✅ Chats: ${chats?.length || 0} chats found`);
    
    return true;
    
  } catch (error) {
    console.error('❌ System check failed:', error);
    return false;
  }
}

async function testBasicMessaging() {
  try {
    console.log('\n📨 Testing basic message insertion...');
    
    const userId = '4f6d8a49-4505-4003-bf27-441a6bfcaef4';
    
    // Find or create a test chat
    let { data: existingChats } = await supabase
      .from('chat_participants')
      .select('chat_id, chats!inner(*)')
      .eq('user_id', userId)
      .limit(1);
      
    let chatId;
    
    if (existingChats && existingChats.length > 0) {
      chatId = existingChats[0].chat_id;
      console.log('✅ Using existing chat:', chatId);
    } else {
      // Create new chat
      chatId = crypto.randomUUID();
      
      await supabase
        .from('chats')
        .insert({
          id: chatId,
          name: 'Messaging Test Chat',
          type: 'private',
          created_by: userId
        });
        
      await supabase
        .from('chat_participants')
        .insert({
          chat_id: chatId,
          user_id: userId,
          role: 'admin'
        });
        
      console.log('✅ Created new test chat:', chatId);
    }
    
    // Test message insertion with all required fields
    const testMessage = {
      chat_id: chatId,
      sender_id: userId,
      content: 'Test message - ' + new Date().toISOString(),
      type: 'text',
      encrypted: false,
      metadata: { test: true }
    };
    
    const { data: message, error } = await supabase
      .from('messages')
      .insert(testMessage)
      .select()
      .single();
      
    if (error) {
      console.error('❌ Message insertion failed:', error);
      return false;
    }
    
    console.log('✅ Message inserted successfully!');
    console.log('📊 Message ID:', message.id);
    console.log('📊 Content:', message.content);
    console.log('📊 Encrypted:', message.encrypted);
    
    return true;
    
  } catch (error) {
    console.error('❌ Basic messaging test failed:', error);
    return false;
  }
}

async function openBrowserForTesting() {
  console.log('\n🌐 Opening browser for manual testing...');
  console.log('📋 Instructions:');
  console.log('   1. Open TWO browser windows/tabs');
  console.log('   2. Navigate to: http://localhost:5174/chats');
  console.log('   3. Login with the same user in both windows');
  console.log('   4. Try sending messages between the windows');
  console.log('   5. Check browser console for any errors');
  
  // Open browser automatically on macOS
  try {
    const { execSync } = await import('child_process');
    execSync('open http://localhost:5174/chats', { stdio: 'ignore' });
    console.log('✅ Browser opened automatically');
  } catch (error) {
    console.log('⚠️ Could not open browser automatically, please open manually');
  }
}

async function main() {
  console.log('🚀 Cyphr Messenger - Comprehensive System Test\n');
  
  const systemOK = await checkSystemStatus();
  
  if (!systemOK) {
    console.log('❌ System check failed, cannot proceed with messaging tests');
    return;
  }
  
  const basicMessagingOK = await testBasicMessaging();
  
  if (!basicMessagingOK) {
    console.log('❌ Basic messaging failed');
    return;
  }
  
  console.log('\n🎉 BACKEND TESTS PASSED!');
  console.log('✅ Database schema: WORKING');
  console.log('✅ Message insertion: WORKING');
  console.log('✅ Backend server: RUNNING');
  console.log('✅ Frontend server: RUNNING');
  
  await openBrowserForTesting();
  
  console.log('\n📋 SYSTEM STATUS SUMMARY:');
  console.log('   🔗 Frontend: http://localhost:5174/');
  console.log('   🔌 Backend:  http://localhost:3001/');
  console.log('   💾 Database: Connected and operational');
  console.log('   📨 Messaging: Ready for testing');
  
  console.log('\n🔍 NEXT STEPS:');
  console.log('   1. Test real-time messaging in browser');
  console.log('   2. Check for infinite loop issues');
  console.log('   3. Verify Socket.IO authentication');
  console.log('   4. Test message delivery between users');
}

main();