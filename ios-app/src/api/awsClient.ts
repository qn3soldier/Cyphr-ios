/**
 * AWS CLIENT - ENTERPRISE BACKEND
 * Полная замена Supabase на AWS infrastructure
 * 
 * AWS Services:
 * - EC2 Backend API: https://app.cyphrmessenger.app/api
 * - RDS PostgreSQL: Managed by backend
 * - SES Email: Integrated in backend
 * - Secrets Manager: Server-side only
 */

// AWS Backend Configuration
const AWS_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://app.cyphrmessenger.app/api';
const AWS_SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'https://app.cyphrmessenger.app';

export class AWSClient {
  constructor() {
    this.baseURL = AWS_BACKEND_URL;
    this.serverURL = AWS_SERVER_URL;
  }

  // Generic API request helper
  async apiRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}/${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const response = await fetch(url, {
      ...options,
      headers: { ...defaultHeaders, ...options.headers }
    });

    if (!response.ok) {
      throw new Error(`AWS API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Database operations через AWS backend
  async select(table: string, options: any = {}) {
    return this.apiRequest(`db/${table}`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'select',
        ...options
      })
    });
  }

  async insert(table: string, data: any) {
    return this.apiRequest(`db/${table}`, {
      method: 'POST', 
      body: JSON.stringify({
        action: 'insert',
        data
      })
    });
  }

  async update(table: string, id: string, data: any) {
    return this.apiRequest(`db/${table}`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'update',
        id,
        data
      })
    });
  }

  async delete(table: string, id: string) {
    return this.apiRequest(`db/${table}`, {
      method: 'DELETE',
      body: JSON.stringify({ id })
    });
  }
}

// Export singleton instance
export const awsClient = new AWSClient();

// Export for backward compatibility with supabase syntax
export const supabase = {
  from: (table: string) => ({
    select: (columns?: string) => awsClient.select(table, { columns }),
    insert: (data: any) => awsClient.insert(table, data),
    update: (data: any) => ({ eq: (col: string, val: any) => awsClient.update(table, val, data) }),
    delete: () => ({ eq: (col: string, val: any) => awsClient.delete(table, val) })
  }),
  rpc: (functionName: string, params?: any) => awsClient.apiRequest(`rpc/${functionName}`, {
    method: 'POST',
    body: JSON.stringify(params)
  })
};

export default awsClient;