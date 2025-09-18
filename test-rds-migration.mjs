#!/usr/bin/env node

/**
 * 🧪 CYPHR MESSENGER - RDS MIGRATION TEST SCRIPT
 * 
 * Pre-migration validation and post-migration verification
 */

import fs from 'fs/promises';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration (update with your actual RDS endpoint)
const TEST_CONFIG = {
    host: 'cyphr-messenger-db.c123abc456def.us-east-1.rds.amazonaws.com', // Replace with actual
    port: 5432,
    database: 'cyphr_messenger',
    user: 'postgres',
    password: 'Cyphr2025EnterpriseSecurePassword123',
    ssl: {
        rejectUnauthorized: true,
        ca: await fs.readFile(path.join(__dirname, 'global-bundle.pem'), 'utf8')
    }
};

async function testConnection() {
    console.log('🔗 Testing RDS Connection...');
    
    const pool = new Pool(TEST_CONFIG);
    
    try {
        const client = await pool.connect();
        
        // Test basic connection
        const result = await client.query('SELECT NOW() as current_time, version()');
        console.log('✅ Connection successful!');
        console.log(`⏰ Server time: ${result.rows[0].current_time}`);
        console.log(`🐘 PostgreSQL: ${result.rows[0].version.split(' ')[0]}`);
        
        // Test SSL connection
        const sslResult = await client.query('SELECT ssl_is_used()');
        console.log(`🔒 SSL enabled: ${sslResult.rows[0].ssl_is_used ? '✅' : '❌'}`);
        
        client.release();
        return true;
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        return false;
        
    } finally {
        await pool.end();
    }
}

async function validateSchema() {
    console.log('\n🔍 Validating Database Schema...');
    
    const pool = new Pool(TEST_CONFIG);
    
    try {
        const client = await pool.connect();
        
        // Check if all required tables exist
        const expectedTables = [
            'users', 'chats', 'messages', 'chat_participants',
            'phone_hashes', 'device_registrations', 'user_wallets',
            'transactions', 'message_status', 'calls',
            'nearby_discovery', 'discovery_tokens', 'waitlist', 'waitlist_stats'
        ];
        
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        const existingTables = result.rows.map(row => row.table_name);
        
        console.log('📋 Table validation:');
        let allTablesExist = true;
        
        for (const table of expectedTables) {
            if (existingTables.includes(table)) {
                console.log(`  ✅ ${table}`);
            } else {
                console.log(`  ❌ ${table} - MISSING`);
                allTablesExist = false;
            }
        }
        
        client.release();
        return allTablesExist;
        
    } catch (error) {
        console.error('❌ Schema validation failed:', error.message);
        return false;
        
    } finally {
        await pool.end();
    }
}

async function validateData() {
    console.log('\n📊 Validating Migrated Data...');
    
    const pool = new Pool(TEST_CONFIG);
    
    try {
        const client = await pool.connect();
        
        // Check row counts for key tables
        const tables = ['users', 'chats', 'waitlist', 'device_registrations'];
        const counts = {};
        
        for (const table of tables) {
            try {
                const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
                counts[table] = parseInt(result.rows[0].count);
                console.log(`📈 ${table}: ${counts[table]} rows`);
            } catch (error) {
                console.log(`❌ ${table}: Error - ${error.message}`);
                counts[table] = -1;
            }
        }
        
        // Validate users table structure
        const userResult = await client.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            ORDER BY ordinal_position
        `);
        
        console.log('\n👤 Users table schema:');
        userResult.rows.forEach(col => {
            console.log(`  • ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(required)' : '(optional)'}`);
        });
        
        client.release();
        return Object.values(counts).every(count => count >= 0);
        
    } catch (error) {
        console.error('❌ Data validation failed:', error.message);
        return false;
        
    } finally {
        await pool.end();
    }
}

async function runTests() {
    console.log('🧪 CYPHR MESSENGER - RDS MIGRATION TESTS');
    console.log('=========================================');
    
    const results = {
        connection: false,
        schema: false,
        data: false
    };
    
    try {
        // Test 1: Connection
        results.connection = await testConnection();
        
        if (!results.connection) {
            console.log('\n❌ Connection test failed. Please check your RDS configuration.');
            return false;
        }
        
        // Test 2: Schema validation
        results.schema = await validateSchema();
        
        // Test 3: Data validation (only if schema exists)
        if (results.schema) {
            results.data = await validateData();
        }
        
        // Final report
        console.log('\n📊 TEST RESULTS');
        console.log('===============');
        console.log(`🔗 Connection: ${results.connection ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`🔍 Schema: ${results.schema ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`📊 Data: ${results.data ? '✅ PASS' : '❌ FAIL'}`);
        
        const allPassed = Object.values(results).every(result => result === true);
        console.log(`\n🎯 Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
        
        if (allPassed) {
            console.log('\n🎉 RDS DATABASE IS READY FOR PRODUCTION!');
            console.log('📍 You can now update your backend to use RDS connection strings');
        } else {
            console.log('\n⚠️  Please address the failed tests before proceeding');
        }
        
        return allPassed;
        
    } catch (error) {
        console.error('\n💥 Test execution failed:', error.message);
        return false;
    }
}

// Execute tests
if (import.meta.url === `file://${__filename}`) {
    runTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Tests failed:', error);
            process.exit(1);
        });
}

export { runTests };