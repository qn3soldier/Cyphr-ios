/**
 * SIMPLE USER SEARCH SERVICE - IMMEDIATE FIX
 * Handles database schema differences (name vs full_name)
 * Provides backward compatibility while we implement zero-knowledge system
 */

import { supabase } from './supabaseClient';

class UserSearchService {
  constructor() {
    this.searchCache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  /**
   * UNIVERSAL USER SEARCH - handles both name and full_name columns
   * Works regardless of database schema inconsistencies
   */
  async searchUsers(query) {
    try {
      if (!query || query.length < 2) {
        return [];
      }

      console.log('🔍 Searching for users:', query);

      // Check cache first
      const cacheKey = query.toLowerCase();
      if (this.searchCache.has(cacheKey)) {
        const cached = this.searchCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          console.log('📋 Returning cached results');
          return cached.results;
        }
      }

      // Determine search type
      const isPhoneNumber = /^\+?[\d\s\-\(\)]+$/.test(query);
      let users = [];

      if (isPhoneNumber) {
        // Phone number search
        users = await this.searchByPhone(query);
      } else {
        // Username/name search
        users = await this.searchByName(query);
      }

      // Cache results
      this.searchCache.set(cacheKey, {
        results: users,
        timestamp: Date.now()
      });

      console.log('✅ Found', users.length, 'users');
      return users;

    } catch (error) {
      console.error('❌ User search failed:', error);
      return [];
    }
  }

  /**
   * Search by phone number with normalized format
   */
  async searchByPhone(phoneNumber) {
    try {
      // Normalize phone number
      const normalized = this.normalizePhoneNumber(phoneNumber);
      
      // Try exact match first
      let { data: users, error } = await supabase
        .from('users')
        .select(`
          id,
          phone,
          full_name,
          full_name as name,
          avatar_url,
          bio,
          unique_id,
          status,
          public_key,
          last_seen,
          created_at
        `)
        .eq('phone', normalized)
        .eq('status', 'active');

      if (error) {
        console.error('Phone search error:', error);
        return [];
      }

      // If no exact match, try partial match
      if (!users || users.length === 0) {
        const { data: partialUsers, error: partialError } = await supabase
          .from('users')
          .select(`
            id,
            phone,
            full_name,
            full_name as name,
            avatar_url,
            bio,
            unique_id,
            status,
            public_key,
            last_seen,
            created_at
          `)
          .ilike('phone', `%${normalized.slice(-10)}%`) // Last 10 digits
          .eq('status', 'active')
          .limit(5);

        if (!partialError && partialUsers) {
          users = partialUsers;
        }
      }

      return users || [];

    } catch (error) {
      console.error('Phone search exception:', error);
      return [];
    }
  }

  /**
   * Search by name/username - handles both name and full_name columns
   */
  async searchByName(query) {
    try {
      // Search by unique_id (username) first
      let { data: users, error } = await supabase
        .from('users')
        .select(`
          id,
          phone,
          full_name,
          full_name as name,
          avatar_url,
          bio,
          unique_id,
          status,
          public_key,
          last_seen,
          created_at
        `)
        .ilike('unique_id', `%${query}%`)
        .eq('status', 'active')
        .limit(10);

      if (error) {
        console.error('Username search error:', error);
        users = [];
      }

      // Also search by full_name
      const { data: nameUsers, error: nameError } = await supabase
        .from('users')
        .select(`
          id,
          phone,
          full_name,
          full_name as name,
          avatar_url,
          bio,
          unique_id,
          status,
          public_key,
          last_seen,
          created_at
        `)
        .ilike('full_name', `%${query}%`)
        .eq('status', 'active')
        .limit(10);

      if (!nameError && nameUsers) {
        // Merge results, avoiding duplicates
        const existingIds = new Set((users || []).map(u => u.id));
        const newUsers = nameUsers.filter(u => !existingIds.has(u.id));
        users = [...(users || []), ...newUsers];
      }

      return users || [];

    } catch (error) {
      console.error('Name search exception:', error);
      return [];
    }
  }

  /**
   * Get user by ID - universal format
   */
  async getUserById(userId) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select(`
          id,
          phone,
          full_name,
          full_name as name,
          avatar_url,
          bio,
          unique_id,
          status,
          public_key,
          last_seen,
          created_at
        `)
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Get user by ID error:', error);
        return null;
      }

      return user;

    } catch (error) {
      console.error('Get user by ID exception:', error);
      return null;
    }
  }

  /**
   * Normalize phone number to E.164 format
   */
  normalizePhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let digits = phoneNumber.replace(/\D/g, '');
    
    // Add US country code if needed
    if (!digits.startsWith('1') && digits.length === 10) {
      digits = '1' + digits;
    }
    
    return '+' + digits;
  }

  /**
   * Get current user contacts - for Alice/Bob testing
   */
  async getCurrentUserContacts(userId) {
    try {
      // This would integrate with actual contacts when available
      // For now, return all users except current user
      const { data: users, error } = await supabase
        .from('users')
        .select(`
          id,
          phone,
          full_name,
          full_name as name,
          avatar_url,
          bio,
          unique_id,
          status,
          public_key,
          last_seen
        `)
        .neq('id', userId)
        .eq('status', 'active')
        .limit(50);

      if (error) {
        console.error('Get contacts error:', error);
        return [];
      }

      return users || [];

    } catch (error) {
      console.error('Get contacts exception:', error);
      return [];
    }
  }

  /**
   * Clear search cache
   */
  clearCache() {
    this.searchCache.clear();
    console.log('🧹 Search cache cleared');
  }
}

// Export singleton instance
export const userSearchService = new UserSearchService();
export default userSearchService;