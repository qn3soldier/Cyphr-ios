#!/usr/bin/env node

require('dotenv/config');
const RDSService = require('./rds-service.cjs');
const { createClient } = require('@supabase/supabase-js');

async function migrateDataToRDS() {
  console.log('🚀 STARTING DATA MIGRATION: SUPABASE → AWS RDS\n');

  const rdsService = new RDSService();
  
  try {
    // Initialize RDS
    console.log('📡 Connecting to RDS...');
    const connected = await rdsService.initialize();
    if (!connected) {
      throw new Error('Failed to connect to RDS');
    }

    // Create schema
    console.log('🏗️ Creating schema...');
    await rdsService.createSchema();

    // Initialize Supabase
    console.log('📡 Connecting to Supabase...');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fkhwhplufjzlicccgbrf.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseKey) {
      throw new Error('Supabase key not found in environment');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify Supabase data
    console.log('🔍 Checking Supabase data...');
    const { data: users } = await supabase.from('users').select('*');
    const { data: chats } = await supabase.from('chats').select('*');
    const { data: messages } = await supabase.from('messages').select('*');
    const { data: waitlist } = await supabase.from('waitlist').select('*');

    console.log(`📊 Found in Supabase:`);
    console.log(`   👥 Users: ${users?.length || 0}`);
    console.log(`   💬 Chats: ${chats?.length || 0}`);
    console.log(`   📝 Messages: ${messages?.length || 0}`);
    console.log(`   📧 Waitlist: ${waitlist?.length || 0}\n`);

    // Perform migration
    console.log('🔄 Starting data migration...');
    const migrationSuccess = await rdsService.migrateDataFromSupabase(supabase);
    
    if (migrationSuccess) {
      // Verify migration
      console.log('\n✅ Verifying migrated data...');
      const userCount = await rdsService.query('SELECT COUNT(*) FROM users');
      const chatCount = await rdsService.query('SELECT COUNT(*) FROM chats');
      const messageCount = await rdsService.query('SELECT COUNT(*) FROM messages');
      const waitlistCount = await rdsService.query('SELECT COUNT(*) FROM waitlist');

      console.log(`📊 Migrated to RDS:`);
      console.log(`   👥 Users: ${userCount.rows[0].count}`);
      console.log(`   💬 Chats: ${chatCount.rows[0].count}`);
      console.log(`   📝 Messages: ${messageCount.rows[0].count}`);
      console.log(`   📧 Waitlist: ${waitlistCount.rows[0].count}\n`);

      console.log('🎉 DATA MIGRATION COMPLETED SUCCESSFULLY!');
      console.log('🚀 RDS is ready for production use');
      return true;
    } else {
      throw new Error('Data migration failed');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    return false;
  } finally {
    await rdsService.close();
  }
}

// Run migration
if (require.main === module) {
  migrateDataToRDS()
    .then(success => {
      console.log(success ? '\n✅ Migration completed successfully' : '\n❌ Migration failed');
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Migration runner failed:', error);
      process.exit(1);
    });
}

module.exports = migrateDataToRDS;