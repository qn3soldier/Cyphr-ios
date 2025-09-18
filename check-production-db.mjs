// Проверяем PRODUCTION Supabase schema
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://fkhwhplufjzlicccgbrf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHdocGx1Zmp6bGljY2NnYnJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NDM1NDIsImV4cCI6MjA2NzQxOTU0Mn0.M72reQ5IAcWA0AWY2h0aJxbbZah7rWkZL2m0ONOdEMQ'
);

async function checkSchema() {
  console.log('🔍 Checking PRODUCTION Supabase schema...');
  console.log('📍 URL:', 'https://fkhwhplufjzlicccgbrf.supabase.co');
  
  // Test a simple insert to see if encrypted column exists
  const testId = crypto.randomUUID();
  
  const { data, error } = await supabase
    .from('messages')
    .insert({
      id: testId,
      content: 'TEST_MESSAGE_SCHEMA_CHECK',
      chat_id: '00000000-0000-0000-0000-000000000001',
      sender_id: '00000000-0000-0000-0000-000000000001',
      type: 'text',
      encrypted: true  // ⬅️ This will fail if column doesn't exist
    })
    .select();
    
  if (error) {
    console.log('❌ ERROR:', error.message);
    if (error.message.includes('encrypted')) {
      console.log('🚨 ENCRYPTED COLUMN MISSING IN PRODUCTION!');
      return false;
    }
    if (error.message.includes('foreign key')) {
      console.log('✅ Encrypted column exists! (foreign key error is expected)');
      return true;
    }
  } else {
    console.log('✅ SUCCESS! Encrypted column exists and working');
    // Clean up test message
    await supabase.from('messages').delete().eq('id', testId);
    return true;
  }
  
  return false;
}

checkSchema().then(exists => {
  if (exists) {
    console.log('\n✅ PRODUCTION DB STATUS: READY FOR MESSAGING!');
  } else {
    console.log('\n❌ PRODUCTION DB STATUS: NEEDS ENCRYPTED COLUMN!');
  }
}).catch(console.error);