/**
 * RDS DATABASE SERVICE - ЗАМЕНА SUPABASE
 * Enterprise-grade PostgreSQL connection для AWS RDS
 */

const { Pool } = require('pg');

class RDSDatabaseService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  /**
   * Initialize RDS connection pool
   */
  async initialize() {
    try {
      console.log('🔗 Initializing RDS PostgreSQL connection...');
      
      const config = {
        host: process.env.RDS_HOST || 'cyphr-messenger-prod.cgni4my4o6a2.us-east-1.rds.amazonaws.com',
        port: process.env.RDS_PORT || 5432,
        database: process.env.RDS_DATABASE || 'cyphr_messenger_prod',
        user: process.env.RDS_USER || 'cyphr_admin',
        password: process.env.RDS_PASSWORD || '52JNc-2#$$)r_|n=_57a9G^ad6%oC]cE',
        ssl: {
          rejectUnauthorized: false
        },
        // Connection pool settings
        max: 20, // maximum pool size
        min: 5,  // minimum pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        acquireTimeoutMillis: 60000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
      };

      this.pool = new Pool(config);
      
      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as server_time, version() as postgres_version');
      client.release();
      
      console.log('✅ RDS PostgreSQL connected:', result.rows[0].postgres_version.substring(0, 50) + '...');
      this.isConnected = true;
      
      return true;
    } catch (error) {
      console.error('❌ RDS connection failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Execute SQL query (Supabase.from() replacement)
   */
  async query(text, params = []) {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    
    try {
      const result = await this.pool.query(text, params);
      return {
        data: result.rows,
        count: result.rowCount,
        error: null
      };
    } catch (error) {
      console.error('❌ Query failed:', error);
      return {
        data: null,
        count: 0,
        error: error
      };
    }
  }

  /**
   * SELECT query (Supabase.from().select() replacement)
   */
  async select(table, columns = '*', whereClause = '', params = []) {
    const sql = `SELECT ${columns} FROM ${table} ${whereClause}`;
    return this.query(sql, params);
  }

  /**
   * INSERT query (Supabase.from().insert() replacement)
   */
  async insert(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const sql = `
      INSERT INTO ${table} (${keys.join(', ')}) 
      VALUES (${placeholders}) 
      RETURNING *
    `;
    
    return this.query(sql, values);
  }

  /**
   * UPDATE query (Supabase.from().update() replacement)
   */
  async update(table, data, whereClause, whereParams = []) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    
    const sql = `
      UPDATE ${table} 
      SET ${setClause}, updated_at = NOW() 
      ${whereClause}
      RETURNING *
    `;
    
    return this.query(sql, [...values, ...whereParams]);
  }

  /**
   * DELETE query (Supabase.from().delete() replacement)
   */
  async delete(table, whereClause, whereParams = []) {
    const sql = `DELETE FROM ${table} ${whereClause} RETURNING *`;
    return this.query(sql, whereParams);
  }

  /**
   * Authentication helper - find user by email
   */
  async findUserByEmail(email) {
    const result = await this.select('users', '*', 'WHERE email = $1', [email]);
    return result.data && result.data.length > 0 ? result.data[0] : null;
  }

  /**
   * Authentication helper - find user by Cyphr ID
   */
  async findUserByCyphrId(cyphrId) {
    const result = await this.select('users', '*', 'WHERE cyphr_id = $1', [cyphrId]);
    return result.data && result.data.length > 0 ? result.data[0] : null;
  }

  /**
   * Messaging helper - get chat messages
   */
  async getChatMessages(chatId, limit = 50) {
    const sql = `
      SELECT m.*, u.full_name as sender_name, u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id  
      WHERE m.chat_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2
    `;
    
    return this.query(sql, [chatId, limit]);
  }

  /**
   * Messaging helper - save message
   */
  async saveMessage(chatId, senderId, content, messageType = 'text') {
    const data = {
      chat_id: chatId,
      sender_id: senderId,
      content: content,
      message_type: messageType,
      encrypted: true
    };
    
    return this.insert('messages', data);
  }

  /**
   * User helper - create new user
   */
  async createUser(userData) {
    return this.insert('users', {
      ...userData,
      id: userData.id || undefined // Let PostgreSQL generate UUID if not provided
    });
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const result = await this.query('SELECT NOW() as current_time, version() as db_version');
      return {
        healthy: true,
        timestamp: result.data[0].current_time,
        version: result.data[0].db_version,
        connectionPool: {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount
        }
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Close connection pool
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔒 RDS connection pool closed');
    }
  }
}

// Singleton instance
const rdsDatabase = new RDSDatabaseService();

module.exports = {
  RDSDatabaseService,
  rdsDatabase
};