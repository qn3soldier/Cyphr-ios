#!/usr/bin/env node

/**
 * 🔄 CYPHR MESSENGER - RDS ROLLBACK UTILITY
 * 
 * Emergency rollback and cleanup utility for RDS migration
 * Use this if migration fails and you need to clean up
 */

import fs from 'fs/promises';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';
import readline from 'readline';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// RDS Configuration (same as migration script)
const RDS_CONFIG = {
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

function createInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

async function askQuestion(question) {
    const rl = createInterface();
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function backupCurrentData() {
    console.log('💾 BACKING UP CURRENT RDS DATA...');
    
    const pool = new Pool(RDS_CONFIG);
    
    try {
        const client = await pool.connect();
        
        // Get list of tables
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        const tables = tablesResult.rows.map(row => row.table_name);
        
        if (tables.length === 0) {
            console.log('ℹ️  No tables found to backup');
            client.release();
            return null;
        }
        
        // Create backup directory
        const backupDir = path.join(__dirname, 'rds-backup', new Date().toISOString().split('T')[0]);
        await fs.mkdir(backupDir, { recursive: true });
        
        const backup = {
            timestamp: new Date().toISOString(),
            tables: {},
            totalRows: 0
        };
        
        for (const table of tables) {
            try {
                const result = await client.query(`SELECT * FROM ${table}`);
                backup.tables[table] = {
                    rowCount: result.rows.length,
                    data: result.rows
                };
                backup.totalRows += result.rows.length;
                console.log(`💾 ${table}: ${result.rows.length} rows backed up`);
            } catch (error) {
                console.warn(`⚠️  Failed to backup ${table}:`, error.message);
            }
        }
        
        // Save backup
        const backupFile = path.join(backupDir, 'rds-backup.json');
        await fs.writeFile(backupFile, JSON.stringify(backup, null, 2));
        
        console.log(`✅ Backup saved to: ${backupFile}`);
        console.log(`📊 Total rows backed up: ${backup.totalRows}`);
        
        client.release();
        return backupFile;
        
    } catch (error) {
        console.error('❌ Backup failed:', error.message);
        return null;
    } finally {
        await pool.end();
    }
}

async function dropAllTables() {
    console.log('🗑️  DROPPING ALL TABLES...');
    
    const pool = new Pool(RDS_CONFIG);
    
    try {
        const client = await pool.connect();
        
        // Get all tables
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        const tables = tablesResult.rows.map(row => row.table_name);
        
        if (tables.length === 0) {
            console.log('ℹ️  No tables to drop');
            client.release();
            return;
        }
        
        await client.query('BEGIN');
        
        // Drop tables in reverse order to handle dependencies
        for (const table of tables.reverse()) {
            try {
                await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
                console.log(`🗑️  Dropped ${table}`);
            } catch (error) {
                console.warn(`⚠️  Failed to drop ${table}:`, error.message);
            }
        }
        
        await client.query('COMMIT');
        console.log('✅ All tables dropped successfully');
        
        client.release();
        
    } catch (error) {
        console.error('❌ Drop tables failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

async function cleanupDatabase() {
    console.log('🧹 CLEANING UP DATABASE...');
    
    const pool = new Pool(RDS_CONFIG);
    
    try {
        const client = await pool.connect();
        
        // Clean up sequences
        const sequencesResult = await client.query(`
            SELECT sequence_name 
            FROM information_schema.sequences 
            WHERE sequence_schema = 'public'
        `);
        
        for (const row of sequencesResult.rows) {
            await client.query(`DROP SEQUENCE IF EXISTS ${row.sequence_name} CASCADE`);
            console.log(`🔢 Dropped sequence: ${row.sequence_name}`);
        }
        
        // Clean up functions
        const functionsResult = await client.query(`
            SELECT routine_name 
            FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_type = 'FUNCTION'
        `);
        
        for (const row of functionsResult.rows) {
            await client.query(`DROP FUNCTION IF EXISTS ${row.routine_name}() CASCADE`);
            console.log(`🔧 Dropped function: ${row.routine_name}`);
        }
        
        console.log('✅ Database cleaned up');
        client.release();
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
    } finally {
        await pool.end();
    }
}

async function showCurrentState() {
    console.log('📊 CURRENT DATABASE STATE');
    console.log('=========================');
    
    const pool = new Pool(RDS_CONFIG);
    
    try {
        const client = await pool.connect();
        
        // Show connection info
        const versionResult = await client.query('SELECT version()');
        console.log(`🐘 PostgreSQL: ${versionResult.rows[0].version.split(' ')[0]}`);
        
        const sslResult = await client.query('SELECT ssl_is_used()');
        console.log(`🔒 SSL: ${sslResult.rows[0].ssl_is_used ? '✅' : '❌'}`);
        
        // Show tables
        const tablesResult = await client.query(`
            SELECT table_name, 
                   (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
            FROM information_schema.tables t 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        if (tablesResult.rows.length === 0) {
            console.log('📋 Tables: None (empty database)');
        } else {
            console.log('📋 Tables:');
            let totalRows = 0;
            
            for (const row of tablesResult.rows) {
                try {
                    const countResult = await client.query(`SELECT COUNT(*) as count FROM ${row.table_name}`);
                    const rowCount = parseInt(countResult.rows[0].count);
                    totalRows += rowCount;
                    console.log(`  • ${row.table_name}: ${rowCount} rows, ${row.columns} columns`);
                } catch (error) {
                    console.log(`  • ${row.table_name}: Error reading rows`);
                }
            }
            
            console.log(`📈 Total rows: ${totalRows}`);
        }
        
        client.release();
        
    } catch (error) {
        console.error('❌ Failed to show state:', error.message);
    } finally {
        await pool.end();
    }
}

async function runRollback() {
    console.log('🔄 CYPHR MESSENGER - RDS ROLLBACK UTILITY');
    console.log('==========================================');
    
    try {
        // Show current state
        await showCurrentState();
        
        console.log('\n🚨 ROLLBACK OPTIONS:');
        console.log('1. 💾 Backup current data (recommended before any changes)');
        console.log('2. 🗑️  Drop all tables (clean slate)');
        console.log('3. 🧹 Full cleanup (tables + sequences + functions)');
        console.log('4. 📊 Show current state only');
        console.log('5. ❌ Exit');
        
        const choice = await askQuestion('\n🔢 Enter your choice (1-5): ');
        
        switch (choice) {
            case '1':
                const backupFile = await backupCurrentData();
                if (backupFile) {
                    console.log('\n✅ Backup completed successfully');
                    console.log(`📁 Backup location: ${backupFile}`);
                } else {
                    console.log('\n❌ Backup failed');
                }
                break;
                
            case '2':
                const confirmDrop = await askQuestion('\n⚠️  Are you sure you want to DROP ALL TABLES? This cannot be undone! (yes/no): ');
                if (confirmDrop.toLowerCase() === 'yes') {
                    await dropAllTables();
                    console.log('\n✅ All tables dropped');
                } else {
                    console.log('❌ Operation cancelled');
                }
                break;
                
            case '3':
                const confirmClean = await askQuestion('\n⚠️  Are you sure you want to COMPLETELY CLEAN the database? This cannot be undone! (yes/no): ');
                if (confirmClean.toLowerCase() === 'yes') {
                    await dropAllTables();
                    await cleanupDatabase();
                    console.log('\n✅ Database completely cleaned');
                } else {
                    console.log('❌ Operation cancelled');
                }
                break;
                
            case '4':
                // Already showed state above
                break;
                
            case '5':
                console.log('👋 Goodbye!');
                return;
                
            default:
                console.log('❌ Invalid choice');
                return;
        }
        
        // Show final state
        console.log('\n📊 FINAL STATE AFTER OPERATION:');
        await showCurrentState();
        
    } catch (error) {
        console.error('\n💥 Rollback utility failed:', error);
    }
}

// Execute rollback utility
if (import.meta.url === `file://${__filename}`) {
    runRollback()
        .then(() => {
            console.log('\n🏁 Rollback utility completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Rollback utility failed:', error);
            process.exit(1);
        });
}

export { runRollback };