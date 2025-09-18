#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const CORRECT_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHdocGx1Zmp6bGljY2NnYnJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg0MzU0MiwiZXhwIjoyMDY3NDE5NTQyfQ.u1uPwT4fD1-hl0n2pegF9UNuwDKje2PKzFKYyD57smM';

console.log('🔧 Final schema check and messaging test...');

const supabase = createClient(SUPABASE_URL, CORRECT_SERVICE_KEY);

async function testMessageInsert() {
  try {
    console.log('🔍 Testing message insertion...');
    
    // Create a test chat first
    const chatId = crypto.randomUUID();
    const userId = '4f6d8a49-4505-4003-bf27-441a6bfcaef4'; // From previous test
    
    console.log('📝 Creating test chat...');
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .insert({
        id: chatId,
        name: 'Test Chat',
        type: 'private',
        created_by: userId
      })
      .select()
      .single();
      
    if (chatError) {
      console.error('❌ Chat creation failed:', chatError);
      return false;
    }
    
    console.log('✅ Test chat created:', chat.id);
    
    // Add user as participant
    const { error: participantError } = await supabase
      .from('chat_participants')
      .insert({
        chat_id: chatId,
        user_id: userId,
        role: 'admin'
      });
      
    if (participantError) {
      console.error('❌ Participant addition failed:', participantError);
      return false;
    }
    
    console.log('✅ User added as participant');
    
    // Now test message insertion with encrypted field
    console.log('📨 Testing message insertion...');
    
    const testMessage = {
      chat_id: chatId,
      sender_id: userId,
      content: 'Test message content',
      type: 'text',
      encrypted: false,
      metadata: {}
    };
    
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert(testMessage)
      .select()
      .single();
      
    if (messageError) {
      console.error('❌ Message insertion failed:', messageError);
      
      if (messageError.message.includes("encrypted")) {
        console.log('🎯 CONFIRMED: encrypted column is missing!');
        return false;
      }
    } else {
      console.log('✅ Message inserted successfully!');
      console.log('📊 Message:', message);
      
      // Clean up
      await supabase.from('messages').delete().eq('id', message.id);
      await supabase.from('chat_participants').delete().eq('chat_id', chatId);
      await supabase.from('chats').delete().eq('id', chatId);
      
      console.log('🧹 Test data cleaned up');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Message test failed:', error);
    return false;
  }
}

async function testDirectQuery() {
  try {
    console.log('\n🔍 Testing direct query with encrypted column...');
    
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, encrypted')
      .limit(1);
      
    if (error) {
      console.error('❌ Direct query failed:', error);
      
      if (error.message.includes("encrypted") || error.code === 'PGRST118') {
        console.log('🎯 CONFIRMED: encrypted column does NOT exist');
        return false;
      }
    } else {
      console.log('✅ Direct query successful - encrypted column exists!');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Direct query test failed:', error);
    return false;
  }
}

async function main() {
  const directQueryWorks = await testDirectQuery();
  
  if (!directQueryWorks) {
    console.log('\n❌ DATABASE SCHEMA ISSUE CONFIRMED');
    console.log('📋 The "encrypted" column is missing from the messages table');
    console.log('🔧 REQUIRED ACTION: Add encrypted column to messages table');
    console.log('\n💡 SQL needed:');
    console.log('   ALTER TABLE public.messages ADD COLUMN encrypted BOOLEAN DEFAULT false;');
    console.log('   ALTER TABLE public.messages ADD COLUMN metadata JSONB DEFAULT \'{}\';');
    
    // Try alternative approach
    console.log('\n🔄 Testing message insertion approach...');
    await testMessageInsert();
  } else {
    console.log('\n✅ DATABASE SCHEMA IS OK');
    console.log('📊 The messages table has all required columns');
    
    console.log('\n🔄 Testing message insertion...');
    const insertWorks = await testMessageInsert();
    
    if (insertWorks) {
      console.log('\n🎉 MESSAGING SCHEMA IS READY!');
      console.log('📋 Next step: Test real-time messaging between users');
    }
  }
}

main();