#!/usr/bin/env node
/**
 * COMPLETE SUPABASE BACKUP SCRIPT
 * Экспорт всех данных из Supabase для миграции на AWS
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Supabase credentials - АКТУАЛЬНЫЕ КЛЮЧИ
const SUPABASE_URL = 'https://fkhwhplufjzlicccgbrf.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHdocGx1Zmp6bGljY2NnYnJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg0MzU0MiwiZXhwIjoyMDY3NDE5NTQyfQ.u1uPwT4fD1-hl0n2pegF9UNuwDKje2PKzFKYyD57smM';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BACKUP_DIR = `/Users/daniilbogdanov/cyphrmessenger/backups/${new Date().toISOString().slice(0,19).replace(/:/g, '-')}`;

// Создать backup директории
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(`${BACKUP_DIR}/database`, { recursive: true });
  fs.mkdirSync(`${BACKUP_DIR}/schema`, { recursive: true });
  fs.mkdirSync(`${BACKUP_DIR}/storage`, { recursive: true });
}

console.log('🚀 Starting COMPLETE Supabase backup...');
console.log('📁 Backup directory:', BACKUP_DIR);

/**
 * BACKUP DATABASE SCHEMA
 */
async function backupSchema() {
  try {
    console.log('📋 Backing up database schema...');
    
    // ПОЛНЫЙ список таблиц из Supabase Dashboard
    const tableNames = [
      'calls',
      'chat_participants', 
      'chats',
      'device_registrations',
      'discovery_tokens',
      'message_status',
      'messages', 
      'nearby_discovery',
      'phone_hashes',
      'transactions',
      'user_wallets',
      'users',
      'waitlist',
      'waitlist_stats'
    ];
    
    const tables = tableNames.map(name => ({ table_name: name }));
    const tablesError = null;
    
    if (tablesError) throw tablesError;
    
    const schemaInfo = {
      tables: tables.map(t => t.table_name),
      exported_at: new Date().toISOString(),
      supabase_url: SUPABASE_URL,
      total_tables: tables.length
    };
    
    fs.writeFileSync(
      `${BACKUP_DIR}/schema/schema_info.json`, 
      JSON.stringify(schemaInfo, null, 2)
    );
    
    console.log(`✅ Schema info backed up: ${tables.length} tables found`);
    return tables.map(t => t.table_name);
    
  } catch (error) {
    console.error('❌ Schema backup failed:', error);
    return [];
  }
}

/**
 * BACKUP TABLE DATA
 */
async function backupTableData(tableName) {
  try {
    console.log(`📊 Backing up table: ${tableName}`);
    
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' });
    
    if (error) throw error;
    
    const backupData = {
      table_name: tableName,
      row_count: count,
      exported_at: new Date().toISOString(),
      data: data
    };
    
    fs.writeFileSync(
      `${BACKUP_DIR}/database/${tableName}.json`,
      JSON.stringify(backupData, null, 2)
    );
    
    console.log(`✅ Table ${tableName}: ${count} rows backed up`);
    return { table: tableName, rows: count, success: true };
    
  } catch (error) {
    console.error(`❌ Failed to backup table ${tableName}:`, error);
    return { table: tableName, rows: 0, success: false, error: error.message };
  }
}

/**
 * BACKUP USER PROFILES AND AVATARS
 */
async function backupUserProfiles() {
  try {
    console.log('👤 Backing up user profiles...');
    
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, cyphr_id, avatar_url, created_at');
    
    if (error) throw error;
    
    const profilesBackup = {
      total_users: users.length,
      exported_at: new Date().toISOString(),
      users: users
    };
    
    fs.writeFileSync(
      `${BACKUP_DIR}/database/user_profiles_summary.json`,
      JSON.stringify(profilesBackup, null, 2)
    );
    
    console.log(`✅ User profiles backed up: ${users.length} users`);
    return users.length;
    
  } catch (error) {
    console.error('❌ User profiles backup failed:', error);
    return 0;
  }
}

/**
 * MAIN BACKUP EXECUTION
 */
async function executeFullBackup() {
  const startTime = Date.now();
  console.log('🚀 Starting FULL SUPABASE BACKUP at:', new Date().toISOString());
  
  try {
    // 1. Backup schema info
    const tables = await backupSchema();
    
    // 2. Backup user profiles summary
    const userCount = await backupUserProfiles();
    
    // 3. Backup all table data
    const backupResults = [];
    for (const tableName of tables) {
      const result = await backupTableData(tableName);
      backupResults.push(result);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 4. Create backup summary
    const summary = {
      backup_completed_at: new Date().toISOString(),
      backup_directory: BACKUP_DIR,
      total_duration_ms: Date.now() - startTime,
      total_tables: tables.length,
      total_users: userCount,
      successful_tables: backupResults.filter(r => r.success).length,
      failed_tables: backupResults.filter(r => !r.success).length,
      table_results: backupResults,
      supabase_config: {
        url: SUPABASE_URL,
        backup_method: 'full_export'
      }
    };
    
    fs.writeFileSync(
      `${BACKUP_DIR}/BACKUP_SUMMARY.json`,
      JSON.stringify(summary, null, 2)
    );
    
    console.log('');
    console.log('🎉 ===== BACKUP COMPLETED SUCCESSFULLY =====');
    console.log(`📁 Location: ${BACKUP_DIR}`);
    console.log(`⏱️  Duration: ${(Date.now() - startTime) / 1000}s`);
    console.log(`📊 Tables: ${summary.successful_tables}/${summary.total_tables} successful`);
    console.log(`👤 Users: ${summary.total_users} backed up`);
    console.log('');
    
    if (summary.failed_tables > 0) {
      console.log('⚠️  FAILED TABLES:');
      backupResults.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.table}: ${r.error}`);
      });
    }
    
    return summary;
    
  } catch (error) {
    console.error('❌ BACKUP FAILED:', error);
    
    const errorSummary = {
      backup_failed_at: new Date().toISOString(),
      error: error.message,
      backup_directory: BACKUP_DIR
    };
    
    fs.writeFileSync(
      `${BACKUP_DIR}/BACKUP_ERROR.json`,
      JSON.stringify(errorSummary, null, 2)
    );
    
    return errorSummary;
  }
}

// Execute backup
executeFullBackup()
  .then(result => {
    if (result.backup_completed_at) {
      console.log('✅ Backup completed successfully');
      process.exit(0);
    } else {
      console.log('❌ Backup failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  });