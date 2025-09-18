import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Supabase connection with service role for admin operations
const supabaseUrl = 'http://127.0.0.1:54321';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZn35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deploySchema() {
  try {
    console.log('🚀 Deploying user_wallets database schema...');
    
    // Read the SQL schema file
    const sqlContent = fs.readFileSync('user-wallets-schema.sql', 'utf8');
    console.log('📄 SQL schema loaded, length:', sqlContent.length);
    
    // Split into individual statements and execute them
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('COMMENT'));
    
    console.log(`🔧 Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`\n📋 Executing statement ${i + 1}/${statements.length}:`);
        console.log(statement.substring(0, 100) + '...');
        
        try {
          // Use the rpc function to execute raw SQL
          const { data, error } = await supabase.rpc('exec', { 
            sql: statement + ';' 
          });
          
          if (error) {
            console.error(`❌ Error in statement ${i + 1}:`, error);
            // Don't throw, continue with next statement
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`❌ Exception in statement ${i + 1}:`, err.message);
          // Continue with next statement
        }
      }
    }
    
    // Verify tables were created
    console.log('\n🔍 Verifying table creation...');
    
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['user_wallets', 'wallet_balance_cache', 'wallet_transaction_cache']);
      
    if (tableError) {
      console.error('❌ Error checking tables:', tableError);
    } else {
      console.log('✅ Tables found:', tables?.map(t => t.table_name) || []);
    }
    
    console.log('\n🎉 Schema deployment completed!');
    
  } catch (error) {
    console.error('❌ Schema deployment failed:', error);
    process.exit(1);
  }
}

deploySchema();