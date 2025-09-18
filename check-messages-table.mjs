#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Checking messages table structure...');

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function checkMessagesTable() {
  try {
    // Try to insert a test message to see what columns are expected
    console.log('🔍 Testing message insert...');
    
    const testMessage = {
      chat_id: 'test-chat-id',
      sender_id: '4f6d8a49-4505-4003-bf27-441a6bfcaef4',
      content: 'test message',
      type: 'text',
      // encrypted: false // This is the missing column!
    };
    
    const { data, error } = await supabase
      .from('messages')
      .insert(testMessage)
      .select();
    
    if (error) {
      console.error('❌ Insert failed:', error);
      
      if (error.message.includes("encrypted")) {
        console.log('🎯 CONFIRMED: encrypted column is missing!');
        console.log('📝 Need to add encrypted column to messages table');
        return false;
      }
    } else {
      console.log('✅ Insert successful, encrypted column exists!');
      console.log('📊 Inserted message:', data);
      
      // Clean up test message
      if (data && data[0]) {
        await supabase
          .from('messages')
          .delete()
          .eq('id', data[0].id);
        console.log('🧹 Test message cleaned up');
      }
      
      return true;
    }
    
  } catch (error) {
    console.error('❌ Table check failed:', error);
    return false;
  }
}

// Alternative approach: try to query with encrypted column
async function directColumnCheck() {
  try {
    console.log('\n🔍 Direct column check...');
    
    const { data, error } = await supabase
      .from('messages')
      .select('encrypted')
      .limit(1);
      
    if (error) {
      console.error('❌ Encrypted column does not exist:', error);
      return false;
    } else {
      console.log('✅ Encrypted column exists!');
      return true;
    }
  } catch (error) {
    console.error('❌ Direct check failed:', error);
    return false;
  }
}

async function main() {
  const insertTest = await checkMessagesTable();
  const directTest = await directColumnCheck();
  
  if (!insertTest && !directTest) {
    console.log('\n🚨 CONCLUSION: encrypted column is MISSING from messages table');
    console.log('📋 Need to add: ALTER TABLE messages ADD COLUMN encrypted BOOLEAN DEFAULT false;');
  } else {
    console.log('\n✅ CONCLUSION: encrypted column exists in messages table');
  }
}

main();