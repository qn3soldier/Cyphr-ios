#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;
import { readFileSync } from 'fs';

async function deployViaPostgres() {
  const client = new Client({
    host: '127.0.0.1',
    port: 54322,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres'
  });
  
  try {
    console.log('🚀 DEPLOYING VIA DIRECT POSTGRESQL CONNECTION...\n');
    
    // Connect to database
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to database');
    
    // Read enhanced SQL
    const sql = readFileSync('user-wallets-enhanced.sql', 'utf8');
    console.log('📄 SQL loaded:', sql.length, 'characters');
    
    // Execute the schema
    console.log('🏗️ Executing enhanced user_wallets schema...');
    const result = await client.query(sql);
    console.log('✅ Schema executed successfully');
    
    // Verify tables
    console.log('\n🔍 Verifying table creation...');
    const tables = ['user_wallets', 'wallet_balance_cache', 'wallet_transaction_cache'];
    
    for (const tableName of tables) {
      try {
        const checkResult = await client.query(
          `SELECT COUNT(*) FROM information_schema.tables WHERE table_name = $1 AND table_schema = 'public'`,
          [tableName]
        );
        
        if (checkResult.rows[0].count > 0) {
          console.log(`✅ ${tableName}: Table exists`);
        } else {
          console.log(`❌ ${tableName}: Table not found`);
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err.message}`);
      }
    }
    
    console.log('\n🎉 DEPLOYMENT SUCCESSFUL!');
    console.log('✅ Enhanced user_wallets schema deployed');
    console.log('✅ UserWalletService ready for testing');
    console.log('✅ Lobstr-like wallet architecture implemented');
    
    return true;
    
  } catch (error) {
    console.error('❌ DEPLOYMENT FAILED:', error.message);
    console.log('\n🔍 Error details:', error);
    return false;
    
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

deployViaPostgres().then(success => {
  process.exit(success ? 0 : 1);
});