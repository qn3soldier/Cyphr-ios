import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

const AvatarContext = createContext();

export const useAvatar = () => {
  const context = useContext(AvatarContext);
  if (!context) {
    throw new Error('useAvatar must be used within an AvatarProvider');
  }
  return context;
};

export const AvatarProvider = ({ children }) => {
  const [avatarCache, setAvatarCache] = useState(new Map());
  const [loading, setLoading] = useState(false);

  // Generate fallback avatar based on user data
  const generateFallback = (userData) => {
    if (!userData) return { initials: '?', color: 'bg-gray-500' };
    
    const name = userData.full_name || userData.phone || 'Unknown';
    const initials = name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);

    // Generate consistent color based on user ID or name
    const colors = [
      'bg-gradient-to-br from-violet-600 to-cyan-600',
      'bg-gradient-to-br from-blue-600 to-purple-600',
      'bg-gradient-to-br from-green-600 to-blue-600',
      'bg-gradient-to-br from-orange-600 to-red-600',
      'bg-gradient-to-br from-pink-600 to-purple-600',
      'bg-gradient-to-br from-cyan-600 to-blue-600',
      'bg-gradient-to-br from-yellow-600 to-orange-600',
      'bg-gradient-to-br from-indigo-600 to-purple-600'
    ];

    const colorIndex = (userData.id || name).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    
    return {
      initials,
      color: colors[colorIndex]
    };
  };

  // Load avatar URL with caching
  const loadAvatar = async (userId) => {
    if (!userId) return null;
    
    // Check cache first
    if (avatarCache.has(userId)) {
      return avatarCache.get(userId);
    }

    try {
      setLoading(true);
      
      // Load user data from Supabase
      const { data: userData, error } = await supabase
        .from('users')
        .select('id, full_name, phone, avatar_url')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        console.error('Error loading user avatar:', error);
      }

      const avatarData = {
        url: userData?.avatar_url || null,
        fallback: generateFallback(userData),
        userData: userData || { id: userId }
      };

      // Cache the result
      setAvatarCache(prev => new Map(prev).set(userId, avatarData));
      
      return avatarData;
    } catch (error) {
      console.error('Avatar loading error:', error);
      const fallbackData = {
        url: null,
        fallback: generateFallback({ id: userId }),
        userData: { id: userId }
      };
      
      setAvatarCache(prev => new Map(prev).set(userId, fallbackData));
      return fallbackData;
    } finally {
      setLoading(false);
    }
  };

  // Update avatar in cache when user updates their profile
  const updateAvatar = (userId, avatarUrl, userData = null) => {
    const existingData = avatarCache.get(userId);
    const updatedData = {
      url: avatarUrl,
      fallback: generateFallback(userData || existingData?.userData || { id: userId }),
      userData: userData || existingData?.userData || { id: userId }
    };
    
    setAvatarCache(prev => new Map(prev).set(userId, updatedData));
  };

  // Clear avatar cache (useful for logout)
  const clearCache = () => {
    setAvatarCache(new Map());
  };

  // Preload avatars for multiple users
  const preloadAvatars = async (userIds) => {
    const uniqueIds = [...new Set(userIds)].filter(id => id && !avatarCache.has(id));
    
    if (uniqueIds.length === 0) return;

    try {
      setLoading(true);
      
      // Batch load user data
      const { data: usersData, error } = await supabase
        .from('users')
        .select('id, name, phone, avatar_url')
        .in('id', uniqueIds);

      if (error) {
        console.error('Error batch loading avatars:', error);
        return;
      }

      // Update cache with loaded data
      const newCache = new Map(avatarCache);
      
      usersData.forEach(userData => {
        const avatarData = {
          url: userData.avatar_url || null,
          fallback: generateFallback(userData),
          userData
        };
        newCache.set(userData.id, avatarData);
      });

      // Add fallbacks for users not found in database
      uniqueIds.forEach(userId => {
        if (!newCache.has(userId)) {
          const fallbackData = {
            url: null,
            fallback: generateFallback({ id: userId }),
            userData: { id: userId }
          };
          newCache.set(userId, fallbackData);
        }
      });

      setAvatarCache(newCache);
    } catch (error) {
      console.error('Batch avatar loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get cached avatar data immediately (for synchronous rendering)
  const getCachedAvatar = (userId) => {
    return avatarCache.get(userId) || null;
  };

  const value = {
    loadAvatar,
    updateAvatar,
    clearCache,
    preloadAvatars,
    getCachedAvatar,
    generateFallback,
    loading,
    cacheSize: avatarCache.size
  };

  return (
    <AvatarContext.Provider value={value}>
      {children}
    </AvatarContext.Provider>
  );
};

export default AvatarProvider;