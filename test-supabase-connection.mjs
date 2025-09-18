#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY;

console.log('🔧 Testing Supabase connection...');
console.log('🔗 URL:', SUPABASE_URL);
console.log('🔑 ANON KEY:', ANON_KEY?.substring(0, 20) + '...');
console.log('🔑 SERVICE KEY:', SERVICE_KEY?.substring(0, 20) + '...');

// Test with service key
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function testConnection() {
  try {
    console.log('\n🔍 Testing with Service Key...');
    
    // Try to fetch users table structure (should work with service key)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('❌ Service key test failed:', error);
      
      // Try with anon key
      console.log('\n🔍 Testing with Anon Key...');
      const anonSupabase = createClient(SUPABASE_URL, ANON_KEY);
      
      const { data: anonData, error: anonError } = await anonSupabase
        .from('users')
        .select('*')
        .limit(1);
        
      if (anonError) {
        console.error('❌ Anon key test failed:', anonError);
      } else {
        console.log('✅ Anon key works!');
        console.log('📊 Data:', anonData);
      }
    } else {
      console.log('✅ Service key works!');
      console.log('📊 Data:', data);
      
      // Now try to check messages table structure
      console.log('\n🔍 Checking messages table structure...');
      
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .limit(1);
        
      if (msgError) {
        console.error('❌ Messages table error:', msgError);
        
        if (msgError.message.includes("encrypted")) {
          console.log('🎯 CONFIRMED: encrypted column is missing!');
          console.log('📝 We need to add it to the messages table');
        }
      } else {
        console.log('✅ Messages table accessible');
        console.log('📊 Sample message:', messages);
      }
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
  }
}

testConnection();