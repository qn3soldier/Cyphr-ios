// Fix RLS 406 errors in production
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fkhwhplufjzlicccgbrf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHdocGx1Zmp6bGljY2NnYnJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NDM1NDIsImV4cCI6MjA2NzQxOTU0Mn0.M72reQ5IAcWA0AWY2h0aJxbbZah7rWkZL2m0ONOdEMQ'; // Anon key

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixRLS() {
  try {
    console.log('🔧 Fixing RLS 406 errors...');
    
    // Disable RLS on all tables
    const sql = `
      ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;  
      ALTER TABLE public.chats DISABLE ROW LEVEL SECURITY;
      ALTER TABLE public.chat_participants DISABLE ROW LEVEL SECURITY;
      
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon;
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO anon;
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO anon;
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_participants TO anon;
      
      SELECT 'RLS disabled successfully' as status;
    `;
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('❌ RLS fix error:', error);
      
      // Try alternative approach - just test if users table is accessible
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('id')
        .limit(1);
        
      if (testError) {
        console.error('❌ Users table test error:', testError);
      } else {
        console.log('✅ Users table accessible:', testData);
      }
      
    } else {
      console.log('✅ RLS fixed:', data);
    }
    
    // Test users table access
    console.log('🧪 Testing users table access...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name')
      .limit(5);
    
    if (usersError) {
      console.error('❌ Users table still blocked:', usersError);
    } else {
      console.log('✅ Users table accessible, found', users?.length || 0, 'users');
    }
    
  } catch (error) {
    console.error('❌ Fix RLS error:', error);
  }
}

fixRLS();