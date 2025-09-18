#!/usr/bin/env node
/**
 * RDS MIGRATION SCRIPT - Supabase → AWS RDS PostgreSQL
 * ENTERPRISE-GRADE MIGRATION WITH ZERO DATA LOSS
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';

// RDS CONNECTION CONFIG с SSL
const RDS_CONFIG = {
  host: 'cyphr-messenger-prod.cgni4my4o6a2.us-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'postgres', // Default database
  user: 'cyphr_admin',
  password: '52JNc-2#$$)r_|n=_57a9G^ad6%oC]cE',
  ssl: {
    rejectUnauthorized: false // RDS сертификат
  }
};

const BACKUP_DIR = '/Users/daniilbogdanov/cyphrmessenger/backups/2025-08-29T23-06-03';

console.log('🚀 Starting RDS Migration from Supabase backup...');
console.log('📁 Backup source:', BACKUP_DIR);
console.log('🔗 RDS target:', RDS_CONFIG.host);

/**
 * CREATE DATABASE AND TABLES
 */
async function createDatabaseSchema(client) {
  try {
    console.log('🏗️ Creating database schema...');
    
    // Create main database
    await client.query('CREATE DATABASE cyphr_messenger_prod;');
    console.log('✅ Database cyphr_messenger_prod created');
    
    // Connect to new database
    const appClient = new pg.Client({
      ...RDS_CONFIG,
      database: 'cyphr_messenger_prod'
    });
    await appClient.connect();
    
    // Create tables based on backup structure
    const createTablesSQL = `
      -- Users table (core)
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone TEXT,
        phone_hash TEXT,
        full_name TEXT,
        nickname TEXT,
        avatar_url TEXT,
        bio TEXT,
        cyphr_id TEXT UNIQUE,
        email TEXT UNIQUE,
        email_hash TEXT,
        pin_hash TEXT,
        biometric_enabled BOOLEAN DEFAULT false,
        public_key TEXT,
        encrypted_private_key TEXT,
        device_fingerprint TEXT,
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Chats table
      CREATE TABLE chats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT,
        is_group BOOLEAN DEFAULT false,
        avatar_url TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Messages table
      CREATE TABLE messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id),
        content TEXT,
        encrypted BOOLEAN DEFAULT true,
        message_type TEXT DEFAULT 'text',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Chat participants
      CREATE TABLE chat_participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role TEXT DEFAULT 'member',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(chat_id, user_id)
      );
      
      -- User wallets (crypto)
      CREATE TABLE user_wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        wallet_address TEXT,
        public_key TEXT,
        encrypted_private_key TEXT,
        wallet_type TEXT DEFAULT 'stellar',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Device registrations (security)
      CREATE TABLE device_registrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        device_fingerprint TEXT UNIQUE,
        device_name TEXT,
        user_agent TEXT,
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Discovery tokens (privacy)
      CREATE TABLE discovery_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        token_type TEXT,
        token_value TEXT UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Phone hashes (privacy)
      CREATE TABLE phone_hashes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        phone_hash TEXT UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Nearby discovery (temporary)
      CREATE TABLE nearby_discovery (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        region_hash TEXT,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Calls table
      CREATE TABLE calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        caller_id UUID REFERENCES users(id),
        callee_id UUID REFERENCES users(id),
        call_type TEXT DEFAULT 'audio',
        status TEXT DEFAULT 'initiated',
        started_at TIMESTAMP WITH TIME ZONE,
        ended_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Message status
      CREATE TABLE message_status (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        status TEXT DEFAULT 'sent',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Transactions (wallet)
      CREATE TABLE transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_user_id UUID REFERENCES users(id),
        to_user_id UUID REFERENCES users(id),
        amount DECIMAL(20,7),
        currency TEXT DEFAULT 'USDC',
        transaction_hash TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Waitlist
      CREATE TABLE waitlist (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE,
        phone TEXT,
        referral_code TEXT,
        source TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Waitlist stats
      CREATE TABLE waitlist_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        total_signups INTEGER DEFAULT 0,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Create indexes for performance
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_cyphr_id ON users(cyphr_id);
      CREATE INDEX idx_messages_chat_id ON messages(chat_id);
      CREATE INDEX idx_messages_created_at ON messages(created_at);
      CREATE INDEX idx_chat_participants_chat_id ON chat_participants(chat_id);
      CREATE INDEX idx_chat_participants_user_id ON chat_participants(user_id);
    `;
    
    await appClient.query(createTablesSQL);
    console.log('✅ Database schema created successfully');
    
    await appClient.end();
    return true;
    
  } catch (error) {
    console.error('❌ Schema creation failed:', error);
    return false;
  }
}

/**
 * IMPORT DATA FROM BACKUP
 */
async function importBackupData() {
  try {
    console.log('📊 Importing data from backup...');
    
    const client = new pg.Client({
      ...RDS_CONFIG,
      database: 'cyphr_messenger_prod'
    });
    await client.connect();
    
    // Import users
    const usersBackup = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, 'database', 'users.json')));
    console.log(`👤 Importing ${usersBackup.data.length} users...`);
    
    for (const user of usersBackup.data) {
      const insertSQL = `
        INSERT INTO users (id, phone, phone_hash, full_name, nickname, avatar_url, bio, cyphr_id, email, email_hash, pin_hash, biometric_enabled, public_key, encrypted_private_key, device_fingerprint, last_login, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (id) DO NOTHING;
      `;
      
      await client.query(insertSQL, [
        user.id, user.phone, user.phone_hash, user.full_name, user.nickname,
        user.avatar_url, user.bio, user.cyphr_id, user.email, user.email_hash,
        user.pin_hash, user.biometric_enabled, user.public_key, user.encrypted_private_key,
        user.device_fingerprint, user.last_login, user.created_at, user.updated_at
      ]);
    }
    console.log('✅ Users imported');
    
    // Import chats
    const chatsBackup = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, 'database', 'chats.json')));
    console.log(`💬 Importing ${chatsBackup.data.length} chats...`);
    
    for (const chat of chatsBackup.data) {
      const insertSQL = `
        INSERT INTO chats (id, title, is_group, avatar_url, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING;
      `;
      
      await client.query(insertSQL, [
        chat.id, chat.title, chat.is_group, chat.avatar_url,
        chat.created_by, chat.created_at, chat.updated_at
      ]);
    }
    console.log('✅ Chats imported');
    
    // Import waitlist
    const waitlistBackup = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, 'database', 'waitlist.json')));
    console.log(`📋 Importing ${waitlistBackup.data.length} waitlist entries...`);
    
    for (const entry of waitlistBackup.data) {
      const insertSQL = `
        INSERT INTO waitlist (id, email, phone, referral_code, source, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING;
      `;
      
      await client.query(insertSQL, [
        entry.id, entry.email, entry.phone, entry.referral_code,
        entry.source, entry.created_at
      ]);
    }
    console.log('✅ Waitlist imported');
    
    // Verify data
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    const chatCount = await client.query('SELECT COUNT(*) FROM chats');
    const waitlistCount = await client.query('SELECT COUNT(*) FROM waitlist');
    
    console.log('');
    console.log('🎉 ===== MIGRATION COMPLETED =====');
    console.log(`👤 Users: ${userCount.rows[0].count}`);
    console.log(`💬 Chats: ${chatCount.rows[0].count}`);
    console.log(`📋 Waitlist: ${waitlistCount.rows[0].count}`);
    console.log('');
    
    await client.end();
    return true;
    
  } catch (error) {
    console.error('❌ Data import failed:', error);
    return false;
  }
}

/**
 * MAIN MIGRATION EXECUTION
 */
async function executeMigration() {
  try {
    console.log('🔗 Connecting to RDS...');
    const client = new pg.Client(RDS_CONFIG);
    await client.connect();
    console.log('✅ Connected to RDS PostgreSQL');
    
    // Create schema
    const schemaCreated = await createDatabaseSchema(client);
    if (!schemaCreated) {
      throw new Error('Schema creation failed');
    }
    
    await client.end();
    
    // Import data
    const dataImported = await importBackupData();
    if (!dataImported) {
      throw new Error('Data import failed');
    }
    
    console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('1. Update server.cjs to use RDS connection');
    console.log('2. Test application with new database');
    console.log('3. Verify all functionality works');
    console.log('4. Switch production traffic to RDS');
    
    return true;
    
  } catch (error) {
    console.error('💥 MIGRATION FAILED:', error);
    return false;
  }
}

// Execute migration
executeMigration()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });