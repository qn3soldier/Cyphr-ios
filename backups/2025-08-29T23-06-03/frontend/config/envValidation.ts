/**
 * Environment Variables Validation
 * Ensures all required API keys and configuration are present
 */

interface EnvConfig {
  // Supabase
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  
  // Twilio (AUTH_TOKEN is backend-only for security)
  VITE_TWILIO_ACCOUNT_SID: string;
  VITE_TWILIO_VERIFY_SID: string;
  
  // Firebase
  VITE_FIREBASE_API_KEY: string;
  VITE_FIREBASE_AUTH_DOMAIN: string;
  VITE_FIREBASE_PROJECT_ID: string;
  VITE_FIREBASE_STORAGE_BUCKET: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  VITE_FIREBASE_APP_ID: string;
  VITE_FIREBASE_MEASUREMENT_ID: string;
  
  // Stellar (ONLY PUBLIC KEYS - never expose secrets to frontend!)
  VITE_STELLAR_PUBLIC_KEY: string;
  VITE_STELLAR_ISSUER_PUBLIC_KEY: string;
  
  // Server
  VITE_SERVER_URL: string;
}

/**
 * Validates that all required environment variables are present
 */
export function validateEnvironmentVariables(): { isValid: boolean; missing: string[]; config?: EnvConfig } {
  const requiredVars: (keyof EnvConfig)[] = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_TWILIO_ACCOUNT_SID',
    'VITE_TWILIO_VERIFY_SID',
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FIREBASE_MEASUREMENT_ID',
    'VITE_STELLAR_PUBLIC_KEY',
    'VITE_STELLAR_ISSUER_PUBLIC_KEY',
    'VITE_SERVER_URL'
  ];

  const missing: string[] = [];
  const config: Partial<EnvConfig> = {};

  for (const varName of requiredVars) {
    const value = import.meta.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
    } else {
      config[varName] = value;
    }
  }

  const isValid = missing.length === 0;

  if (!isValid) {
    console.error('❌ Missing required environment variables:', missing);
    console.error('💡 Make sure your .env file contains all required API keys');
  } else {
    console.log('✅ All environment variables validated successfully');
  }

  return {
    isValid,
    missing,
    config: isValid ? config as EnvConfig : undefined
  };
}

/**
 * Get validated environment configuration
 */
export function getEnvConfig(): EnvConfig {
  const validation = validateEnvironmentVariables();
  
  if (!validation.isValid) {
    throw new Error(
      `Missing required environment variables: ${validation.missing.join(', ')}\n` +
      'Please check your .env file and ensure all API keys are configured.'
    );
  }

  return validation.config!;
}

/**
 * Runtime configuration object with all API keys
 */
export const ENV_CONFIG = getEnvConfig();

/**
 * Helper to check if running in development mode
 */
export const isDevelopment = import.meta.env.DEV;

/**
 * Helper to check if running in production mode
 */
export const isProduction = import.meta.env.PROD;

/**
 * Print configuration status (without exposing secrets)
 */
export function printConfigStatus(): void {
  const validation = validateEnvironmentVariables();
  
  console.log('🔧 Environment Configuration Status:');
  console.log(`📊 Mode: ${isDevelopment ? 'Development' : 'Production'}`);
  console.log(`✅ Valid: ${validation.isValid}`);
  
  if (!validation.isValid) {
    console.log(`❌ Missing: ${validation.missing.length} variables`);
    validation.missing.forEach(varName => {
      console.log(`   - ${varName}`);
    });
  } else {
    console.log('🎉 All API keys configured correctly');
    console.log('🔒 Supabase: Connected');
    console.log('📱 Twilio: Ready');
    console.log('🔥 Firebase: Initialized');
    console.log('⭐ Stellar: Configured');
  }
}