import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://plstpwrqcxuifbqywfle.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3Rwd3JxY3h1aWZicXl3ZmxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTI1MDY3NywiZXhwIjoyMDUwODI2Njc3fQ.yjGHJJdZZSdqFpGp5Y7dWKHUtd7_rG5mZU-WLmF49SE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deployPrivacyConfigSchema() {
  try {
    console.log('📊 Deploying privacy config schema...');
    
    // Execute SQL commands one by one for better error handling
    const commands = [
      // Create table
      `CREATE TABLE IF NOT EXISTS user_privacy_config (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        config JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id)
      );`,
      
      // Enable RLS
      `ALTER TABLE user_privacy_config ENABLE ROW LEVEL SECURITY;`,
      
      // Create policy
      `CREATE POLICY "Users can manage their own privacy config" ON user_privacy_config
       FOR ALL USING (auth.uid() = user_id);`,
      
      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_user_privacy_config_user_id ON user_privacy_config(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_user_privacy_config_updated_at ON user_privacy_config(updated_at);`
    ];
    
    for (const [index, command] of commands.entries()) {
      console.log(`🔧 Executing command ${index + 1}/${commands.length}...`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: command });
      
      if (error) {
        console.error(`❌ Command ${index + 1} failed:`, error);
        // Continue with other commands
      } else {
        console.log(`✅ Command ${index + 1} executed successfully`);
      }
    }
    
    console.log('🎉 Privacy config schema deployment completed');
    console.log('📋 Schema includes:');
    console.log('  - user_privacy_config table with JSONB config storage');
    console.log('  - RLS policies for user data protection');
    console.log('  - Performance indexes');
    console.log('  - Unique constraint on user_id');
    
  } catch (error) {
    console.error('❌ Deployment error:', error);
  }
}

deployPrivacyConfigSchema();