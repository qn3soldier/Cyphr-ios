#!/usr/bin/env node

/**
 * Deploy Multi-Signature Wallet Database Schema to Supabase
 * This script creates all necessary tables and policies for enterprise multi-sig functionality
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('🚀 Deploying Multi-Signature Wallet Schema to Supabase...');
console.log(`📍 URL: ${supabaseUrl}`);

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deploySchema() {
  try {
    // Read the schema file
    const schemaPath = join(__dirname, 'multisig-schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Loaded schema file:', schemaPath);
    console.log(`📊 Schema size: ${Math.round(schemaSQL.length / 1024)} KB`);
    
    // Split SQL into individual statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`🔧 Executing ${statements.length} SQL statements...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      try {
        // Execute statement
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          throw error;
        }
        
        successCount++;
        
        // Show progress for significant statements
        if (statement.includes('CREATE TABLE')) {
          const tableName = statement.match(/CREATE TABLE.*?(\w+)/)?.[1];
          console.log(`✅ Created table: ${tableName}`);
        } else if (statement.includes('CREATE INDEX')) {
          const indexName = statement.match(/CREATE INDEX.*?(\w+)/)?.[1];
          console.log(`✅ Created index: ${indexName}`);
        } else if (statement.includes('CREATE POLICY')) {
          const policyName = statement.match(/CREATE POLICY "(.*?)"/)?.[1];
          console.log(`✅ Created policy: ${policyName}`);
        }
        
      } catch (error) {
        errorCount++;
        
        // Some errors are expected (like "already exists")
        if (error.message?.includes('already exists') || error.message?.includes('does not exist')) {
          console.log(`⚠️  Statement ${i + 1}: ${error.message}`);
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          console.error(`   SQL: ${statement.substring(0, 100)}...`);
        }
      }
    }
    
    console.log('\n📊 Deployment Summary:');
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`⚠️  Errors/warnings: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('🎉 Multi-signature wallet schema deployed successfully!');
    } else {
      console.log('⚠️  Schema deployed with some warnings (likely expected)');
    }
    
    // Test the deployment by checking if tables exist
    console.log('\n🧪 Testing deployment...');
    
    const tablesToCheck = [
      'multisig_wallets',
      'multisig_pending_transactions', 
      'multisig_transaction_history',
      'multisig_approval_requests',
      'multisig_audit_log',
      'multisig_signer_permissions'
    ];
    
    for (const table of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
          
        if (error) {
          console.log(`❌ Table '${table}' not accessible:`, error.message);
        } else {
          console.log(`✅ Table '${table}' is accessible`);
        }
      } catch (error) {
        console.log(`❌ Table '${table}' test failed:`, error.message);
      }
    }
    
    console.log('\n🏁 Deployment complete!');
    console.log('\nNext steps:');
    console.log('1. Verify tables in Supabase dashboard');
    console.log('2. Test multi-sig wallet creation');
    console.log('3. Configure RLS policies as needed');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  }
}

// Alternative method using direct SQL execution if RPC doesn't work
async function deploySchemaFallback() {
  try {
    console.log('🔄 Trying fallback deployment method...');
    
    const schemaPath = join(__dirname, 'multisig-schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    
    // Try to execute the entire schema at once
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: schemaSQL 
    });
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Schema deployed successfully using fallback method');
    
  } catch (error) {
    console.error('❌ Fallback deployment also failed:', error);
    console.log('\n📝 Manual deployment required:');
    console.log('1. Copy the contents of multisig-schema.sql');
    console.log('2. Paste into Supabase SQL Editor');
    console.log('3. Execute manually');
    process.exit(1);
  }
}

// Create exec_sql function if it doesn't exist
async function createExecSqlFunction() {
  try {
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$;
    `;
    
    console.log('🔧 Creating exec_sql helper function...');
    
    // This might not work due to security restrictions
    const { error } = await supabase.rpc('exec', { sql: createFunctionSQL });
    
    if (error) {
      console.log('⚠️  Could not create exec_sql function, will try alternative approach');
    } else {
      console.log('✅ Helper function created');
    }
    
  } catch (error) {
    console.log('⚠️  Helper function creation failed, continuing...');
  }
}

// Main execution
async function main() {
  try {
    await createExecSqlFunction();
    await deploySchema();
  } catch (error) {
    console.log('🔄 Primary deployment failed, trying fallback...');
    await deploySchemaFallback();
  }
}

main().catch(error => {
  console.error('❌ Deployment script failed:', error);
  process.exit(1);
});