// DEBUG ENVIRONMENT VARIABLES
console.log('🔍 DEBUGGING ENVIRONMENT VARIABLES...');

// Node.js environment
console.log('\n📋 NODE.JS PROCESS.ENV:');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY);
console.log('VITE_SUPABASE_SERVICE_KEY:', process.env.VITE_SUPABASE_SERVICE_KEY);

// Load .env manually
import fs from 'fs';
console.log('\n📋 .ENV FILE CONTENTS:');
const envContent = fs.readFileSync('.env', 'utf8');
const envLines = envContent.split('\n').filter(line => line.includes('SUPABASE'));
envLines.forEach(line => console.log(line));

// Load with dotenv
import dotenv from 'dotenv';
dotenv.config();

console.log('\n📋 AFTER DOTENV.CONFIG():');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY);
console.log('VITE_SUPABASE_SERVICE_KEY:', process.env.VITE_SUPABASE_SERVICE_KEY);

// Test Supabase connection
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_KEY;

console.log('\n🔧 CREATING SUPABASE CLIENTS...');
console.log('URL:', url);
console.log('ANON_KEY length:', anonKey?.length);
console.log('SERVICE_KEY length:', serviceKey?.length);

if (url && anonKey) {
  console.log('✅ Creating anon client...');
  const anonClient = createClient(url, anonKey);
  
  try {
    const { data, error } = await anonClient.from('users').select('count').limit(1);
    console.log('✅ Anon client works:', data);
  } catch (err) {
    console.log('❌ Anon client error:', err.message);
  }
}

if (url && serviceKey) {
  console.log('✅ Creating service client...');
  const serviceClient = createClient(url, serviceKey);
  
  try {
    const { data, error } = await serviceClient.from('users').select('count').limit(1);
    console.log('✅ Service client works:', data);
  } catch (err) {
    console.log('❌ Service client error:', err.message);
  }
} else {
  console.log('❌ Missing URL or SERVICE_KEY for service client');
  console.log('URL present:', !!url);
  console.log('SERVICE_KEY present:', !!serviceKey);
}