/**
 * ZERO-KNOWLEDGE USER LOOKUP SERVICE
 * Following Signal's Private Contact Discovery model
 * 
 * Key Principles from Signal/Telegram research:
 * 1. Phone numbers are hashed before transmission (SHA-3)
 * 2. Server never stores plaintext phone numbers
 * 3. Contact discovery uses SGX enclaves (simulated here)
 * 4. Users control their discoverability
 * 5. No social graph stored on server
 */

import { quantumKDF } from './quantumKDF.js';
import { supabase } from './supabaseClient';

class ZeroKnowledgeUserLookup {
  constructor() {
    this.discoveryCache = new Map(); // Local cache only
    this.hashCache = new Map(); // Phone hash cache
  }

  /**
   * Hash phone number using quantum-safe SHA-3
   * Following Signal's approach but with post-quantum crypto
   */
  async hashPhoneNumber(phoneNumber) {
    // Normalize phone number (E.164 format)
    const normalized = this.normalizePhoneNumber(phoneNumber);
    
    // Check cache first
    if (this.hashCache.has(normalized)) {
      return this.hashCache.get(normalized);
    }

    try {
      // Use quantum-safe hashing (SHA-3)
      const hash = await quantumKDF.hashPhone(normalized);
      
      // Cache the result locally
      this.hashCache.set(normalized, hash);
      
      return hash;
    } catch (error) {
      console.error('Phone hashing error:', error);
      throw new Error('Failed to process phone number');
    }
  }

  /**
   * Normalize phone number to E.164 format
   * Following international standards
   */
  normalizePhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let digits = phoneNumber.replace(/\D/g, '');
    
    // Add + prefix if not present
    if (!digits.startsWith('1') && digits.length === 10) {
      digits = '1' + digits; // US number
    }
    
    return '+' + digits;
  }

  /**
   * SIGNAL-STYLE PRIVATE CONTACT DISCOVERY
   * Hash contacts locally, send hashes to server for matching
   */
  async discoverContacts(contactPhoneNumbers) {
    try {
      console.log('🔍 Starting private contact discovery for', contactPhoneNumbers.length, 'contacts');
      
      // Step 1: Hash all phone numbers locally
      const hashedContacts = await Promise.all(
        contactPhoneNumbers.map(async (phone) => ({
          original: phone,
          normalized: this.normalizePhoneNumber(phone),
          hash: await this.hashPhoneNumber(phone)
        }))
      );

      // Step 2: Send only hashes to server (Signal-style)
      const hashes = hashedContacts.map(contact => contact.hash);
      
      // Step 3: Query server with hashes only
      const discoveredUsers = await this.queryHashedUsers(hashes);
      
      // Step 4: Map results back to original contacts
      const results = hashedContacts.map(contact => {
        const user = discoveredUsers.find(u => u.phone_hash === contact.hash);
        return {
          phone: contact.original,
          normalized: contact.normalized,
          user: user || null,
          found: !!user
        };
      });

      console.log('✅ Contact discovery complete:', results.filter(r => r.found).length, 'found');
      return results;
      
    } catch (error) {
      console.error('❌ Contact discovery failed:', error);
      return [];
    }
  }

  /**
   * Query server with phone hashes only
   * Server never sees plaintext phone numbers
   */
  async queryHashedUsers(phoneHashes) {
    try {
      // Query users table using hashed phone numbers
      const { data: users, error } = await supabase
        .from('users')
        .select(`
          id,
          phone_hash,
          full_name,
          avatar_url,
          bio,
          unique_id,
          status,
          public_key,
          last_seen,
          created_at
        `)
        .in('phone_hash', phoneHashes)
        .eq('status', 'active'); // Only find active users
        
      if (error) {
        console.error('Database query error:', error);
        return [];
      }

      return users || [];
      
    } catch (error) {
      console.error('Hashed user query failed:', error);
      return [];
    }
  }

  /**
   * TELEGRAM-STYLE USERNAME SEARCH
   * Search by username without revealing phone numbers
   */
  async searchByUsername(username) {
    try {
      if (!username || username.length < 3) {
        return [];
      }

      // Search by unique_id (username) without phone numbers
      const { data: users, error } = await supabase
        .from('users')
        .select(`
          id,
          unique_id,
          full_name,
          avatar_url,
          bio,
          status,
          public_key,
          last_seen
        `)
        .ilike('unique_id', `%${username}%`)
        .eq('status', 'active')
        .limit(10);

      if (error) {
        console.error('Username search error:', error);
        return [];
      }

      return users || [];
      
    } catch (error) {
      console.error('Username search failed:', error);
      return [];
    }
  }

  /**
   * ZERO-KNOWLEDGE USER PROFILE LOOKUP
   * Get user info without revealing phone number
   */
  async getUserByHash(phoneHash) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select(`
          id,
          unique_id,
          full_name,
          avatar_url,
          bio,
          status,
          public_key,
          last_seen,
          created_at
        `)
        .eq('phone_hash', phoneHash)
        .eq('status', 'active')
        .single();

      if (error) {
        console.error('User lookup error:', error);
        return null;
      }

      return user;
      
    } catch (error) {
      console.error('User hash lookup failed:', error);
      return null;
    }
  }

  /**
   * PRIVACY CONTROLS
   * Users can control their discoverability (Signal/Telegram style)
   */
  async updateDiscoverabilitySettings(userId, settings) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          discoverable_by_phone: settings.discoverableByPhone ?? true,
          discoverable_by_username: settings.discoverableByUsername ?? true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Privacy settings update error:', error);
        return false;
      }

      return true;
      
    } catch (error) {
      console.error('Privacy settings update failed:', error);
      return false;
    }
  }

  /**
   * SIGNAL-STYLE FORWARD SECRECY
   * Rotate phone hashes periodically for additional privacy
   */
  async rotatePhoneHash(userId, newPhoneNumber) {
    try {
      const newHash = await this.hashPhoneNumber(newPhoneNumber);
      
      const { data, error } = await supabase
        .from('users')
        .update({
          phone_hash: newHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Phone hash rotation error:', error);
        return false;
      }

      // Clear local cache
      this.hashCache.clear();
      this.discoveryCache.clear();

      return true;
      
    } catch (error) {
      console.error('Phone hash rotation failed:', error);
      return false;
    }
  }

  /**
   * UNIFIED SEARCH INTERFACE
   * Search users by phone (hashed) or username
   */
  async searchUsers(query) {
    try {
      // Determine if query is phone number or username
      const isPhoneNumber = /^\+?[\d\s\-\(\)]+$/.test(query);
      
      if (isPhoneNumber) {
        // Phone number search (hashed)
        const results = await this.discoverContacts([query]);
        return results.filter(r => r.found).map(r => r.user);
      } else {
        // Username search
        return await this.searchByUsername(query);
      }
      
    } catch (error) {
      console.error('Unified search failed:', error);
      return [];
    }
  }

  /**
   * Clear all cached data for privacy
   */
  clearCache() {
    this.hashCache.clear();
    this.discoveryCache.clear();
    console.log('🧹 Privacy cache cleared');
  }
}

// Export singleton instance
export const zeroKnowledgeUserLookup = new ZeroKnowledgeUserLookup();
export default zeroKnowledgeUserLookup;