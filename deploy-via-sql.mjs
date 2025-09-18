#!/usr/bin/env node
/**
 * Direct SQL deployment via PostgreSQL connection
 */

import { readFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function deployViaPsql() {
  try {
    console.log('🚀 Deploying schema via direct PostgreSQL connection...\n');
    
    // Read schema file
    const sqlContent = readFileSync('user-wallets-schema.sql', 'utf8');
    console.log('📄 Schema loaded:', sqlContent.length, 'characters');
    
    // Write to temp file for psql execution
    const tempFile = '/tmp/user_wallets_schema.sql';
    require('fs').writeFileSync(tempFile, sqlContent);
    console.log('📝 Schema written to temp file:', tempFile);
    
    // Execute via psql (Supabase local default connection)
    const psqlCommand = `psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f ${tempFile}`;
    console.log('🔧 Executing:', psqlCommand);
    console.log('⏳ This may take a few seconds...\n');
    
    const { stdout, stderr } = await execAsync(psqlCommand, {
      env: { ...process.env, PGPASSWORD: 'postgres' }
    });
    
    if (stdout) {
      console.log('✅ SQL Output:');
      console.log(stdout);
    }
    
    if (stderr) {
      console.log('⚠️ Warnings/Messages:');
      console.log(stderr);
    }
    
    // Verify tables via REST API
    console.log('\n🔍 Verifying tables via REST API...');
    
    const tables = ['user_wallets', 'wallet_balance_cache', 'wallet_transaction_cache'];
    const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
    
    for (const table of tables) {
      try {
        const response = await fetch(`http://127.0.0.1:54321/rest/v1/${table}?limit=1`, {
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey
          }
        });
        
        if (response.ok) {
          console.log(`✅ ${table}: Table exists and accessible`);
        } else {
          console.log(`❌ ${table}: ${response.status} ${response.statusText}`);
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`);
      }
    }
    
    console.log('\n🎉 Schema deployment completed!');
    console.log('💾 User wallet tables should now be available');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    
    // Alternative: Manual instruction
    console.log('\n📋 MANUAL DEPLOYMENT INSTRUCTIONS:');
    console.log('1. Open Supabase Studio: http://127.0.0.1:54321/project/default/sql/new');
    console.log('2. Copy the contents of user-wallets-schema.sql');
    console.log('3. Paste and execute in the SQL editor');
    console.log('4. Verify tables are created');
    
    process.exit(1);
  }
}

deployViaPsql();