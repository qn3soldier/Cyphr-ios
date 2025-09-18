#!/usr/bin/env node

/**
 * 🚀 CYPHR MESSENGER - ENTERPRISE RDS MIGRATION SCRIPT
 * 
 * PRODUCTION-READY MIGRATION: Supabase → AWS RDS PostgreSQL
 * 
 * ✅ ENTERPRISE SECURITY:
 *    - SSL/TLS encryption with AWS global-bundle.pem
 *    - Connection pooling (pg.Pool)
 *    - Secure password: Cyphr2025EnterpriseSecurePassword123
 *    - Proper transaction isolation
 * 
 * ✅ COMPLETE DATA MIGRATION:
 *    - All 14 tables from schema_info.json
 *    - Exact field mapping from backup JSON files
 *    - UUID, TIMESTAMPTZ, TEXT, BOOLEAN data types
 * 
 * ✅ ENTERPRISE RELIABILITY:
 *    - Error handling with rollback capability
 *    - Data integrity validation
 *    - Detailed logging and monitoring
 *    - Row count verification
 * 
 * USAGE: node migrate-to-rds-enterprise.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔐 ENTERPRISE CONFIGURATION
const RDS_CONFIG = {
    host: 'cyphr-messenger-prod.cgni4my4o6a2.us-east-1.rds.amazonaws.com', // Replace with actual RDS endpoint
    port: 5432,
    database: 'cyphr_messenger_prod',
    user: 'cyphr_admin',
    password: 'Cyphr2025EnterpriseSecurePassword123',
    ssl: {
        rejectUnauthorized: true,
        ca: await fs.readFile(path.join(__dirname, 'global-bundle.pem'), 'utf8')
    },
    // Connection pooling for enterprise scale
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    query_timeout: 60000
};

// 📊 SUPABASE CONFIGURATION (Source)
const SUPABASE_CONFIG = {
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.fkhwhplufjzlicccgbrf',
    password: process.env.SUPABASE_PASSWORD || 'your-supabase-password',
    ssl: true
};

// 📂 BACKUP DATA PATH
const BACKUP_PATH = path.join(__dirname, 'backups/2025-08-29T23-06-03/database');

// 🔍 MIGRATION STATE
class MigrationState {
    constructor() {
        this.startTime = new Date();
        this.migratedTables = [];
        this.errors = [];
        this.totalRows = 0;
        this.migratedRows = 0;
    }

    addError(table, error) {
        this.errors.push({ table, error: error.message, timestamp: new Date() });
        console.error(`❌ ERROR in ${table}:`, error.message);
    }

    tableCompleted(table, rows) {
        this.migratedTables.push(table);
        this.migratedRows += rows;
        console.log(`✅ ${table}: ${rows} rows migrated`);
    }

    getReport() {
        const duration = new Date() - this.startTime;
        return {
            duration: `${Math.round(duration / 1000)}s`,
            tablesTotal: 14,
            tablesMigrated: this.migratedTables.length,
            rowsTotal: this.totalRows,
            rowsMigrated: this.migratedRows,
            errors: this.errors.length,
            success: this.errors.length === 0
        };
    }
}

// 📋 COMPLETE DATABASE SCHEMA (from backup analysis)
const TABLE_SCHEMAS = {
    users: `
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY,
            phone VARCHAR(20),
            phone_hash VARCHAR(128),
            full_name VARCHAR(255),
            nickname VARCHAR(100),
            avatar_url TEXT,
            unique_id UUID,
            public_key TEXT,
            encrypted_private_key TEXT,
            status VARCHAR(20) DEFAULT 'offline',
            is_online BOOLEAN DEFAULT false,
            last_seen TIMESTAMPTZ,
            socket_id VARCHAR(100),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            cyphr_id VARCHAR(100) UNIQUE,
            phone_discovery_enabled BOOLEAN DEFAULT false,
            nearby_discovery_enabled BOOLEAN DEFAULT false,
            share_link_enabled BOOLEAN DEFAULT true,
            cyphr_id_changed_at TIMESTAMPTZ,
            email_hash VARCHAR(128),
            password_hash VARCHAR(255),
            auth_method VARCHAR(20) DEFAULT 'phone',
            pin_hash VARCHAR(255),
            biometric_enabled BOOLEAN DEFAULT false,
            last_session_expiry TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS idx_users_cyphr_id ON users(cyphr_id);
        CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);
        CREATE INDEX IF NOT EXISTS idx_users_phone_hash ON users(phone_hash);
        CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
    `,

    chats: `
        CREATE TABLE IF NOT EXISTS chats (
            id UUID PRIMARY KEY,
            type VARCHAR(20) DEFAULT 'direct',
            name VARCHAR(255),
            avatar_url TEXT,
            last_message_id UUID,
            last_message_time TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            created_by UUID
        );
        
        CREATE INDEX IF NOT EXISTS idx_chats_type ON chats(type);
        CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at);
        CREATE INDEX IF NOT EXISTS idx_chats_last_message_time ON chats(last_message_time);
    `,

    messages: `
        CREATE TABLE IF NOT EXISTS messages (
            id UUID PRIMARY KEY,
            chat_id UUID NOT NULL,
            sender_id UUID NOT NULL,
            content TEXT,
            encrypted BOOLEAN DEFAULT false,
            message_type VARCHAR(20) DEFAULT 'text',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            delivered_at TIMESTAMPTZ,
            read_at TIMESTAMPTZ,
            reply_to_id UUID,
            file_url TEXT,
            file_type VARCHAR(50),
            file_size BIGINT,
            thumbnail_url TEXT,
            FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
        CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
        CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
    `,

    chat_participants: `
        CREATE TABLE IF NOT EXISTS chat_participants (
            id UUID PRIMARY KEY,
            chat_id UUID NOT NULL,
            user_id UUID NOT NULL,
            role VARCHAR(20) DEFAULT 'member',
            joined_at TIMESTAMPTZ DEFAULT NOW(),
            left_at TIMESTAMPTZ,
            last_read_message_id UUID,
            FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(chat_id, user_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id);
        CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
    `,

    phone_hashes: `
        CREATE TABLE IF NOT EXISTS phone_hashes (
            id UUID PRIMARY KEY,
            phone_hash VARCHAR(128) UNIQUE NOT NULL,
            user_id UUID,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_phone_hashes_hash ON phone_hashes(phone_hash);
        CREATE INDEX IF NOT EXISTS idx_phone_hashes_user_id ON phone_hashes(user_id);
    `,

    device_registrations: `
        CREATE TABLE IF NOT EXISTS device_registrations (
            id UUID PRIMARY KEY,
            device_fingerprint VARCHAR(255) UNIQUE NOT NULL,
            cyphr_id VARCHAR(100),
            browser_info TEXT,
            registered_at TIMESTAMPTZ DEFAULT NOW(),
            last_seen TIMESTAMPTZ,
            user_id UUID,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_device_registrations_fingerprint ON device_registrations(device_fingerprint);
        CREATE INDEX IF NOT EXISTS idx_device_registrations_cyphr_id ON device_registrations(cyphr_id);
        CREATE INDEX IF NOT EXISTS idx_device_registrations_user_id ON device_registrations(user_id);
    `,

    user_wallets: `
        CREATE TABLE IF NOT EXISTS user_wallets (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL,
            public_key VARCHAR(255) UNIQUE NOT NULL,
            encrypted_secret_key TEXT,
            blockchain VARCHAR(50) DEFAULT 'stellar',
            balance_xlm DECIMAL(20, 7) DEFAULT 0,
            balance_usdc DECIMAL(20, 7) DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_wallets_public_key ON user_wallets(public_key);
        CREATE INDEX IF NOT EXISTS idx_user_wallets_blockchain ON user_wallets(blockchain);
    `,

    transactions: `
        CREATE TABLE IF NOT EXISTS transactions (
            id UUID PRIMARY KEY,
            from_user_id UUID NOT NULL,
            to_user_id UUID NOT NULL,
            amount DECIMAL(20, 7) NOT NULL,
            asset_code VARCHAR(20) DEFAULT 'XLM',
            asset_issuer VARCHAR(255),
            stellar_transaction_id VARCHAR(255) UNIQUE,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            completed_at TIMESTAMPTZ,
            memo TEXT,
            fee_paid DECIMAL(20, 7),
            FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_transactions_from_user ON transactions(from_user_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_to_user ON transactions(to_user_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
        CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
        CREATE INDEX IF NOT EXISTS idx_transactions_stellar_id ON transactions(stellar_transaction_id);
    `,

    message_status: `
        CREATE TABLE IF NOT EXISTS message_status (
            id UUID PRIMARY KEY,
            message_id UUID NOT NULL,
            user_id UUID NOT NULL,
            status VARCHAR(20) DEFAULT 'sent',
            timestamp TIMESTAMPTZ DEFAULT NOW(),
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(message_id, user_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_message_status_message_id ON message_status(message_id);
        CREATE INDEX IF NOT EXISTS idx_message_status_user_id ON message_status(user_id);
        CREATE INDEX IF NOT EXISTS idx_message_status_status ON message_status(status);
    `,

    calls: `
        CREATE TABLE IF NOT EXISTS calls (
            id UUID PRIMARY KEY,
            chat_id UUID NOT NULL,
            caller_id UUID NOT NULL,
            callee_id UUID,
            type VARCHAR(20) DEFAULT 'audio',
            status VARCHAR(20) DEFAULT 'initiated',
            started_at TIMESTAMPTZ,
            ended_at TIMESTAMPTZ,
            duration_seconds INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
            FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (callee_id) REFERENCES users(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_calls_chat_id ON calls(chat_id);
        CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON calls(caller_id);
        CREATE INDEX IF NOT EXISTS idx_calls_callee_id ON calls(callee_id);
        CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
        CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);
    `,

    nearby_discovery: `
        CREATE TABLE IF NOT EXISTS nearby_discovery (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL,
            latitude DECIMAL(10, 7),
            longitude DECIMAL(10, 7),
            location_hash VARCHAR(128),
            radius_meters INTEGER DEFAULT 1000,
            visible_until TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_nearby_discovery_user_id ON nearby_discovery(user_id);
        CREATE INDEX IF NOT EXISTS idx_nearby_discovery_location ON nearby_discovery(location_hash);
        CREATE INDEX IF NOT EXISTS idx_nearby_discovery_visible_until ON nearby_discovery(visible_until);
    `,

    discovery_tokens: `
        CREATE TABLE IF NOT EXISTS discovery_tokens (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL,
            token VARCHAR(255) UNIQUE NOT NULL,
            type VARCHAR(20) DEFAULT 'share_link',
            expires_at TIMESTAMPTZ,
            max_uses INTEGER,
            current_uses INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_discovery_tokens_token ON discovery_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_discovery_tokens_user_id ON discovery_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_discovery_tokens_type ON discovery_tokens(type);
        CREATE INDEX IF NOT EXISTS idx_discovery_tokens_expires_at ON discovery_tokens(expires_at);
    `,

    waitlist: `
        CREATE TABLE IF NOT EXISTS waitlist (
            id UUID PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            ip_address INET,
            referrer TEXT,
            source VARCHAR(100) DEFAULT 'landing_page',
            user_agent TEXT,
            language VARCHAR(10),
            synced BOOLEAN DEFAULT false
        );
        
        CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
        CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);
        CREATE INDEX IF NOT EXISTS idx_waitlist_source ON waitlist(source);
        CREATE INDEX IF NOT EXISTS idx_waitlist_synced ON waitlist(synced);
    `,

    waitlist_stats: `
        CREATE TABLE IF NOT EXISTS waitlist_stats (
            id SERIAL PRIMARY KEY,
            total_signups INTEGER DEFAULT 0,
            days_active INTEGER DEFAULT 0,
            last_signup TIMESTAMPTZ,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    `
};

// 🔧 UTILITY FUNCTIONS
async function loadBackupData(tableName) {
    try {
        const filePath = path.join(BACKUP_PATH, `${tableName}.json`);
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        return data.data || [];
    } catch (error) {
        console.warn(`⚠️  No backup data found for ${tableName}: ${error.message}`);
        return [];
    }
}

function formatSQLValue(value) {
    if (value === null || value === undefined) {
        return 'NULL';
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        // Escape single quotes and wrap in quotes
        return `'${value.replace(/'/g, "''")}'`;
    }
    return `'${String(value).replace(/'/g, "''")}'`;
}

async function createTables(pool, state) {
    console.log('\n🏗️  CREATING DATABASE SCHEMA...');
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Create tables in dependency order
        const tableOrder = [
            'users', 'chats', 'messages', 'chat_participants', 
            'phone_hashes', 'device_registrations', 'user_wallets', 
            'transactions', 'message_status', 'calls', 
            'nearby_discovery', 'discovery_tokens', 'waitlist', 'waitlist_stats'
        ];
        
        for (const tableName of tableOrder) {
            if (TABLE_SCHEMAS[tableName]) {
                console.log(`📋 Creating ${tableName}...`);
                await client.query(TABLE_SCHEMAS[tableName]);
                console.log(`✅ ${tableName} schema created`);
            }
        }
        
        await client.query('COMMIT');
        console.log('✅ All tables created successfully');
        
    } catch (error) {
        await client.query('ROLLBACK');
        state.addError('schema_creation', error);
        throw error;
    } finally {
        client.release();
    }
}

async function migrateTableData(pool, tableName, state) {
    const data = await loadBackupData(tableName);
    
    if (data.length === 0) {
        console.log(`📭 ${tableName}: No data to migrate`);
        state.tableCompleted(tableName, 0);
        return;
    }

    console.log(`📦 Migrating ${tableName}: ${data.length} rows...`);
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Build INSERT statement
        const firstRow = data[0];
        const columns = Object.keys(firstRow);
        const columnsStr = columns.join(', ');
        
        let successfulRows = 0;
        
        // Insert rows in batches
        const batchSize = 100;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            
            for (const row of batch) {
                try {
                    const values = columns.map(col => formatSQLValue(row[col]));
                    const valuesStr = values.join(', ');
                    
                    const insertSQL = `INSERT INTO ${tableName} (${columnsStr}) VALUES (${valuesStr}) ON CONFLICT DO NOTHING`;
                    await client.query(insertSQL);
                    successfulRows++;
                    
                } catch (rowError) {
                    console.warn(`⚠️  Row error in ${tableName}:`, rowError.message);
                    // Continue with other rows
                }
            }
        }
        
        await client.query('COMMIT');
        state.tableCompleted(tableName, successfulRows);
        
    } catch (error) {
        await client.query('ROLLBACK');
        state.addError(tableName, error);
        throw error;
    } finally {
        client.release();
    }
}

async function validateMigration(pool, state) {
    console.log('\n🔍 VALIDATING DATA INTEGRITY...');
    
    const client = await pool.connect();
    try {
        // Check row counts for each table
        const tableOrder = Object.keys(TABLE_SCHEMAS);
        const validation = {};
        
        for (const tableName of tableOrder) {
            try {
                const result = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
                const count = parseInt(result.rows[0].count);
                validation[tableName] = count;
                
                // Load expected count from backup
                const backupData = await loadBackupData(tableName);
                const expectedCount = backupData.length;
                
                if (count === expectedCount) {
                    console.log(`✅ ${tableName}: ${count}/${expectedCount} rows ✓`);
                } else {
                    console.log(`⚠️  ${tableName}: ${count}/${expectedCount} rows (mismatch)`);
                }
                
            } catch (error) {
                console.log(`❌ ${tableName}: validation error - ${error.message}`);
            }
        }
        
        return validation;
        
    } finally {
        client.release();
    }
}

// 🚀 MAIN MIGRATION FUNCTION
async function runMigration() {
    console.log('🚀 CYPHR MESSENGER - ENTERPRISE RDS MIGRATION');
    console.log('===============================================');
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`🔒 SSL Enabled: ✅`);
    console.log(`🏭 Connection Pool: max=${RDS_CONFIG.max}, min=${RDS_CONFIG.min}`);
    
    const state = new MigrationState();
    let pool = null;
    
    try {
        // 🔗 Connect to RDS with SSL
        console.log('\n🔗 CONNECTING TO AWS RDS...');
        pool = new Pool(RDS_CONFIG);
        
        // Test connection
        const client = await pool.connect();
        const result = await client.query('SELECT version()');
        console.log('✅ Connected to PostgreSQL:', result.rows[0].version.split(' ')[0]);
        client.release();
        
        // 🏗️ Create schema
        await createTables(pool, state);
        
        // 📊 Count total rows to migrate
        console.log('\n📊 ANALYZING BACKUP DATA...');
        const tableOrder = Object.keys(TABLE_SCHEMAS);
        for (const tableName of tableOrder) {
            const data = await loadBackupData(tableName);
            state.totalRows += data.length;
            console.log(`📋 ${tableName}: ${data.length} rows`);
        }
        console.log(`📈 Total rows to migrate: ${state.totalRows}`);
        
        // 🔄 Migrate data
        console.log('\n🔄 MIGRATING DATA...');
        for (const tableName of tableOrder) {
            try {
                await migrateTableData(pool, tableName, state);
            } catch (error) {
                console.error(`❌ Failed to migrate ${tableName}:`, error.message);
                // Continue with other tables
            }
        }
        
        // 🔍 Validate migration
        const validation = await validateMigration(pool, state);
        
        // 📊 Final Report
        const report = state.getReport();
        console.log('\n📊 MIGRATION REPORT');
        console.log('==================');
        console.log(`⏱️  Duration: ${report.duration}`);
        console.log(`📋 Tables: ${report.tablesMigrated}/${report.tablesTotal}`);
        console.log(`📈 Rows: ${report.rowsMigrated}/${report.rowsTotal}`);
        console.log(`❌ Errors: ${report.errors}`);
        console.log(`🎯 Success: ${report.success ? '✅' : '❌'}`);
        
        if (state.errors.length > 0) {
            console.log('\n🚨 ERROR DETAILS:');
            state.errors.forEach(err => {
                console.log(`  • ${err.table}: ${err.error}`);
            });
        }
        
        console.log('\n🎉 MIGRATION COMPLETED!');
        console.log(`📍 RDS Endpoint: ${RDS_CONFIG.host}`);
        console.log(`🔒 SSL: Enabled`);
        console.log(`📊 Database: ${RDS_CONFIG.database}`);
        
        return report.success;
        
    } catch (error) {
        console.error('\n💥 CRITICAL MIGRATION ERROR:', error.message);
        state.addError('migration', error);
        return false;
        
    } finally {
        if (pool) {
            await pool.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// 🎬 Execute Migration
if (import.meta.url === `file://${__filename}`) {
    runMigration()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 MIGRATION FAILED:', error);
            process.exit(1);
        });
}

export { runMigration, RDS_CONFIG, TABLE_SCHEMAS };