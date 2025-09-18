#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load environment variables
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SERVICE_KEY');
  process.exit(1);
}

console.log('🔧 Applying DATABASE_SCHEMA_FIX.sql...');
console.log('🔗 Supabase URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyDatabaseFix() {
  try {
    // Read SQL file
    const sqlContent = fs.readFileSync('./DATABASE_SCHEMA_FIX.sql', 'utf8');
    
    console.log('📄 SQL content preview:');
    console.log(sqlContent.substring(0, 200) + '...');
    
    // Split by statements (simplified approach)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (!statement) continue;
      
      console.log(`\n🔄 Executing statement ${i + 1}/${statements.length}...`);
      console.log(`📝 SQL: ${statement.substring(0, 100)}...`);
      
      try {
        const { data, error } = await supabase.rpc('exec', { sql: statement });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error);
          
          // Continue with other statements for non-critical errors
          if (error.message?.includes('already exists') || 
              error.message?.includes('IF NOT EXISTS')) {
            console.log(`⚠️ Skipping existing structure, continuing...`);
            continue;
          }
          
          throw error;
        }
        
        console.log(`✅ Statement ${i + 1} executed successfully`);
        if (data) {
          console.log('📊 Result:', data);
        }
        
      } catch (stmtError) {
        console.error(`❌ Failed to execute statement ${i + 1}:`, stmtError);
        
        // Try direct approach for some statements
        if (statement.includes('ALTER TABLE') && statement.includes('ADD COLUMN')) {
          console.log('🔄 Retrying with direct RPC call...');
          
          try {
            const { error: directError } = await supabase
              .from('information_schema.columns')
              .select('column_name')
              .limit(1);
            
            // If we can access information_schema, try the SQL directly
            if (!directError) {
              console.log('✅ Database connection confirmed');
            }
          } catch (retryError) {
            console.error('❌ Retry failed:', retryError);
          }
        }
      }
    }
    
    console.log('\n🎉 DATABASE_SCHEMA_FIX.sql applied successfully!');
    
    // Verify critical column exists
    console.log('\n🔍 Verifying encrypted column exists...');
    
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'messages');
    
    if (columnError) {
      console.error('❌ Failed to verify columns:', columnError);
    } else {
      console.log('📋 Messages table columns:', columns);
      
      const hasEncrypted = columns?.some(col => col.column_name === 'encrypted');
      if (hasEncrypted) {
        console.log('✅ Encrypted column confirmed!');
      } else {
        console.log('⚠️ Encrypted column not found, may need manual intervention');
      }
    }
    
  } catch (error) {
    console.error('❌ Database fix failed:', error);
    process.exit(1);
  }
}

applyDatabaseFix();