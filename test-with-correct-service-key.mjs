#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const CORRECT_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHdocGx1Zmp6bGljY2NnYnJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg0MzU0MiwiZXhwIjoyMDY3NDE5NTQyfQ.u1uPwT4fD1-hl0n2pegF9UNuwDKje2PKzFKYyD57smM';

console.log('🔧 Testing with correct service key...');

const supabase = createClient(SUPABASE_URL, CORRECT_SERVICE_KEY);

async function testServiceKey() {
  try {
    // Test admin access
    console.log('🔍 Testing service key access...');
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('❌ Service key test failed:', error);
      return false;
    } else {
      console.log('✅ Service key works!');
      console.log('📊 Data sample:', data);
      return true;
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return false;
  }
}

async function checkMessagesSchema() {
  try {
    console.log('\n🔍 Checking messages table schema...');
    
    // Use information_schema to get column info
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', 'messages')
      .order('ordinal_position');
      
    if (error) {
      console.error('❌ Schema check failed:', error);
      return false;
    } else {
      console.log('✅ Messages table schema:');
      data.forEach(col => {
        const status = col.column_name === 'encrypted' ? '🎯' : '📋';
        console.log(`${status} ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      const hasEncrypted = data.some(col => col.column_name === 'encrypted');
      if (hasEncrypted) {
        console.log('✅ encrypted column exists!');
        return true;
      } else {
        console.log('❌ encrypted column missing!');
        return false;
      }
    }
    
  } catch (error) {
    console.error('❌ Schema check failed:', error);
    return false;
  }
}

async function addEncryptedColumn() {
  try {
    console.log('\n🔧 Adding encrypted column...');
    
    // Use SQL through RPC
    const { data, error } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE public.messages 
        ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT false;
        
        ALTER TABLE public.messages 
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
      `
    });
    
    if (error) {
      console.error('❌ Failed to add columns:', error);
      return false;
    } else {
      console.log('✅ Columns added successfully!');
      return true;
    }
    
  } catch (error) {
    console.error('❌ Column addition failed:', error);
    return false;
  }
}

async function main() {
  const serviceKeyWorks = await testServiceKey();
  
  if (!serviceKeyWorks) {
    console.log('❌ Cannot proceed without working service key');
    return;
  }
  
  const schemaOK = await checkMessagesSchema();
  
  if (!schemaOK) {
    console.log('🔧 Need to add missing columns...');
    const columnsAdded = await addEncryptedColumn();
    
    if (columnsAdded) {
      console.log('🔄 Re-checking schema...');
      await checkMessagesSchema();
    }
  }
  
  console.log('\n🎯 Schema check complete!');
}

main();