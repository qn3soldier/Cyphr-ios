import { createClient } from '@supabase/supabase-js';

// Get environment variables with proper fallbacks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Never load service-role key in frontend bundles
const supabaseServiceKey = undefined as unknown as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase credentials. Database features may not work.');
}

// Proper Singleton pattern to avoid multiple instances
class SupabaseClientSingleton {
  private static instance: any = null;
  
  static getInstance() {
    if (!this.instance && supabaseUrl && supabaseAnonKey) {
      console.log('🔧 Creating new Supabase client instance...');
      this.instance = createClient(
        supabaseUrl || 'https://placeholder.supabase.co',
        supabaseAnonKey || 'placeholder-key',
        {
          auth: {
            // Disable auth since we use custom phone auth
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
            storageKey: 'cyphr-auth-token' // Unique storage key
          },
          realtime: {
            // Enable realtime for messages
            heartbeatIntervalMs: 30000,
            reconnectAfterMs: () => [1000, 2000, 5000],
          },
          db: {
            // Database configuration
            schema: 'public',
          },
          global: {
            // Global fetch headers
            headers: {
              'x-my-custom-header': 'my-app-name',
            },
          },
        }
      );
    }
    return this.instance;
  }
}

// Export the singleton instance
export const supabase = SupabaseClientSingleton.getInstance();

// Service role client for admin operations (bypasses RLS)
export const supabaseServiceRole = null;

/**
 * Helper function to check if Supabase is connected
 */
export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('messages').select('count').limit(1);
    if (error) {
      console.error('Supabase connection error:', error);
      return false;
    }
    console.log('✅ Supabase connected successfully');
    return true;
  } catch (error) {
    console.error('Supabase connection failed:', error);
    return false;
  }
};

/**
 * Helper function to setup real-time subscriptions
 */
export const setupRealtimeSubscriptions = (callback: (payload: any) => void) => {
  return supabase
    .channel('messages')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, callback)
    .subscribe();
};

/**
 * Helper function to cleanup subscriptions
 */
export const cleanupSubscriptions = (subscription: any) => {
  if (subscription) {
    supabase.removeChannel(subscription);
  }
};

/**
 * Table access helpers with error handling
 */
export const tables = {
  messages: () => supabase.from('messages'),
  users: () => supabase.from('users'),
  groups: () => supabase.from('groups'),
  group_members: () => supabase.from('group_members'),
  wallets: () => supabase.from('wallets'),
  transactions: () => supabase.from('transactions'),
  call_logs: () => supabase.from('call_logs'),
  user_settings: () => supabase.from('user_settings'),
  quantum_keys: () => supabase.from('quantum_keys'),
  media_files: () => supabase.from('media_files')
};

/**
 * Common database operations with error handling
 */
export const db = {
  // Insert with error handling
  insert: async (table: string, data: any) => {
    try {
      const { data: result, error } = await supabase.from(table).insert(data).select();
      if (error) throw error;
      return { success: true, data: result };
    } catch (error) {
      console.error(`Insert error in ${table}:`, error);
      return { success: false, error };
    }
  },

  // Update with error handling
  update: async (table: string, data: any, filter: any) => {
    try {
      const { data: result, error } = await supabase.from(table).update(data).match(filter).select();
      if (error) throw error;
      return { success: true, data: result };
    } catch (error) {
      console.error(`Update error in ${table}:`, error);
      return { success: false, error };
    }
  },

  // Delete with error handling
  delete: async (table: string, filter: any) => {
    try {
      const { data: result, error } = await supabase.from(table).delete().match(filter);
      if (error) throw error;
      return { success: true, data: result };
    } catch (error) {
      console.error(`Delete error in ${table}:`, error);
      return { success: false, error };
    }
  },

  // Select with error handling
  select: async (table: string, columns = '*', filter?: any) => {
    try {
      let query = supabase.from(table).select(columns);
      if (filter) {
        query = query.match(filter);
      }
      const { data: result, error } = await query;
      if (error) throw error;
      return { success: true, data: result };
    } catch (error) {
      console.error(`Select error in ${table}:`, error);
      return { success: false, error };
    }
  }
};

/**
 * Storage helpers for file uploads
 */
export const storage = {
  upload: async (bucket: string, path: string, file: File) => {
    try {
      const { data, error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error(`Storage upload error:`, error);
      return { success: false, error };
    }
  },

  download: async (bucket: string, path: string) => {
    try {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error(`Storage download error:`, error);
      return { success: false, error };
    }
  },

  getPublicUrl: (bucket: string, path: string) => {
    return supabase.storage.from(bucket).getPublicUrl(path);
  }
};

// Initialize connection check on import
checkSupabaseConnection();

export default supabase; 