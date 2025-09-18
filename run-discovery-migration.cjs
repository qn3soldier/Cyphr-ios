/**
 * 🚀 RUN DISCOVERY MIGRATION
 * Direct PostgreSQL connection for schema updates
 */

const { Client } = require('pg');
const fs = require('fs');

// PostgreSQL connection using Supabase connection string
const client = new Client({
  connectionString: 'postgresql://postgres.fkhwhplufjzlicccgbrf:Qqf5R02fnBfMR!vj@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require'
});

async function runMigration() {
  try {
    console.log('🔄 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to database');

    // Read migration SQL
    const migrationSQL = fs.readFileSync('simple-discovery-migration.sql', 'utf8');
    
    // Split into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && s.length > 10);

    console.log(`📊 Found ${statements.length} SQL statements to execute`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
        console.log(`   ${statement.substring(0, 60)}...`);
        
        await client.query(statement);
        console.log(`✅ Statement ${i + 1} successful`);
        successCount++;
      } catch (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key') ||
            error.message.includes('column already exists')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists)`);
        } else {
          console.log(`❌ Statement ${i + 1} failed: ${error.message}`);
          errorCount++;
        }
      }
    }

    // Test the new schema
    console.log('\\n🧪 Testing new schema...');
    
    const testQueries = [
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE '%cyphr%'",
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'discovery_tokens'",
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'phone_hashes'"
    ];

    for (const query of testQueries) {
      try {
        const result = await client.query(query);
        console.log(`✅ Test query result:`, result.rows);
      } catch (error) {
        console.log(`❌ Test query failed: ${error.message}`);
      }
    }

    console.log(`\\n📊 MIGRATION SUMMARY:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📋 Total: ${statements.length}`);
    
    if (errorCount === 0) {
      console.log('🎉 DISCOVERY DATABASE MIGRATION COMPLETED SUCCESSFULLY!');
    } else {
      console.log('⚠️ Migration completed with some errors');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

runMigration();