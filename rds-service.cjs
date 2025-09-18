const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class RDSService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      console.log('🔄 Initializing RDS PostgreSQL connection...');
      
      // SSL configuration with downloaded certificate
      const sslConfig = {
        rejectUnauthorized: true,
        ca: fs.readFileSync(path.join(__dirname, 'global-bundle.pem')),
        checkServerIdentity: () => { return undefined; }
      };

      // Connection configuration
      this.pool = new Pool({
        host: 'cyphr-messenger-prod.cgni4my4o6a2.us-east-1.rds.amazonaws.com',
        port: 5432,
        database: 'cyphr_messenger_prod',
        user: 'cyphr_admin',
        password: process.env.RDS_PASSWORD || 'Cyphr2025EnterpriseSecurePassword123',
        ssl: sslConfig,
        max: 20, // maximum number of clients in the pool
        idleTimeoutMillis: 30000, // close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // return an error after 2 seconds if connection could not be established
      });

      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as current_time');
      client.release();
      
      this.isConnected = true;
      console.log('✅ RDS PostgreSQL connected successfully at:', result.rows[0].current_time);
      
      return true;
    } catch (error) {
      console.error('❌ RDS PostgreSQL connection failed:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  async query(text, params) {
    if (!this.isConnected) {
      throw new Error('RDS not connected. Call initialize() first.');
    }
    
    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      console.error('❌ RDS Query error:', error.message);
      throw error;
    }
  }

  async getClient() {
    if (!this.isConnected) {
      throw new Error('RDS not connected. Call initialize() first.');
    }
    return await this.pool.connect();
  }

  async createSchema() {
    console.log('🔄 Creating RDS database schema...');
    
    try {
      // Create all tables from Supabase schema
      await this.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          phone VARCHAR(20),
          phone_hash VARCHAR(255),
          full_name VARCHAR(255),
          nickname VARCHAR(255),
          avatar_url TEXT,
          unique_id VARCHAR(255),
          public_key TEXT,
          encrypted_private_key TEXT,
          status VARCHAR(20) DEFAULT 'offline',
          is_online BOOLEAN DEFAULT false,
          last_seen TIMESTAMP WITH TIME ZONE,
          socket_id VARCHAR(255),
          cyphr_id VARCHAR(50),
          phone_discovery_enabled BOOLEAN DEFAULT false,
          nearby_discovery_enabled BOOLEAN DEFAULT false,
          share_link_enabled BOOLEAN DEFAULT true,
          cyphr_id_changed_at TIMESTAMP WITH TIME ZONE,
          email_hash VARCHAR(255),
          password_hash VARCHAR(255),
          auth_method VARCHAR(20) DEFAULT 'phone',
          pin_hash VARCHAR(255),
          biometric_enabled BOOLEAN DEFAULT false,
          last_session_expiry TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS chats (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255),
          type VARCHAR(20) DEFAULT 'direct',
          participants JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
          sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
          content TEXT,
          encrypted BOOLEAN DEFAULT false,
          message_type VARCHAR(20) DEFAULT 'text',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS waitlist (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      console.log('✅ RDS database schema created successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to create RDS schema:', error.message);
      return false;
    }
  }

  async migrateDataFromSupabase(supabaseClient) {
    console.log('🔄 Starting data migration from Supabase to RDS...');
    
    try {
      // Migrate users
      const { data: users } = await supabaseClient.from('users').select('*');
      if (users && users.length > 0) {
        for (const user of users) {
          await this.query(`
            INSERT INTO users (id, phone, phone_hash, full_name, nickname, avatar_url, unique_id, public_key, encrypted_private_key, status, is_online, last_seen, socket_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (id) DO UPDATE SET
              phone = EXCLUDED.phone,
              full_name = EXCLUDED.full_name,
              nickname = EXCLUDED.nickname,
              avatar_url = EXCLUDED.avatar_url,
              status = EXCLUDED.status,
              updated_at = NOW()
          `, [user.id, user.phone, user.phone_hash, user.full_name, user.nickname, user.avatar_url, user.unique_id, user.public_key, user.encrypted_private_key, user.status, user.is_online, user.last_seen, user.socket_id, user.created_at, user.updated_at]);
        }
        console.log(`✅ Migrated ${users.length} users to RDS`);
      }

      // Migrate chats
      const { data: chats } = await supabaseClient.from('chats').select('*');
      if (chats && chats.length > 0) {
        for (const chat of chats) {
          await this.query(`
            INSERT INTO chats (id, creator_id, name, type, participants, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              participants = EXCLUDED.participants,
              updated_at = NOW()
          `, [chat.id, chat.creator_id, chat.name, chat.type, JSON.stringify(chat.participants), chat.created_at, chat.updated_at]);
        }
        console.log(`✅ Migrated ${chats.length} chats to RDS`);
      }

      // Migrate messages
      const { data: messages } = await supabaseClient.from('messages').select('*');
      if (messages && messages.length > 0) {
        for (const message of messages) {
          await this.query(`
            INSERT INTO messages (id, chat_id, sender_id, content, encrypted, message_type, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO NOTHING
          `, [message.id, message.chat_id, message.sender_id, message.content, message.encrypted, message.message_type, message.created_at]);
        }
        console.log(`✅ Migrated ${messages.length} messages to RDS`);
      }

      // Migrate waitlist
      const { data: waitlist } = await supabaseClient.from('waitlist').select('*');
      if (waitlist && waitlist.length > 0) {
        for (const entry of waitlist) {
          await this.query(`
            INSERT INTO waitlist (id, email, created_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (email) DO NOTHING
          `, [entry.id, entry.email, entry.created_at]);
        }
        console.log(`✅ Migrated ${waitlist.length} waitlist entries to RDS`);
      }

      console.log('🎉 Data migration completed successfully!');
      return true;
    } catch (error) {
      console.error('❌ Data migration failed:', error.message);
      return false;
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) return false;
      
      const result = await this.query('SELECT 1 as health');
      return result.rows[0].health === 1;
    } catch (error) {
      console.error('❌ RDS health check failed:', error.message);
      return false;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('🔄 RDS connection closed');
    }
  }
}

module.exports = RDSService;