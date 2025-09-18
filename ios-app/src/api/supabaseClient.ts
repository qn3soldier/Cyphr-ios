/**
 * AWS CLIENT ADAPTER - REPLACING SUPABASE
 * Полная замена Supabase на AWS backend для iOS
 * Backward compatibility для существующего кода
 */

import { awsClient, supabase } from './awsClient';

// Export AWS client as supabase for backward compatibility
export { supabase };
export default awsClient;

// Экспорт для legacy кода
export const createClient = () => awsClient;