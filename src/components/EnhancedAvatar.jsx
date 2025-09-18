import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import { useAvatar } from './AvatarProvider';
import { cn } from '@/lib/utils';

const EnhancedAvatar = ({ 
  userId, 
  size = 'md', 
  showOnline = false, 
  online = false,
  className = '',
  fallbackData = null,
  onClick = null 
}) => {
  const { loadAvatar, getCachedAvatar } = useAvatar();
  const [avatarData, setAvatarData] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Size variants
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-20 h-20 text-xl',
    '2xl': 'w-24 h-24 text-2xl'
  };

  const onlineIndicatorSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
    xl: 'w-5 h-5',
    '2xl': 'w-6 h-6'
  };

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const loadUserAvatar = async () => {
      try {
        // Check cache first
        const cachedData = getCachedAvatar(userId);
        if (cachedData) {
          setAvatarData(cachedData);
          setIsLoading(false);
          return;
        }

        // Load from API
        const data = await loadAvatar(userId);
        setAvatarData(data);
      } catch (error) {
        console.error('Error loading avatar:', error);
        setAvatarData({
          url: null,
          fallback: fallbackData || { initials: '?', color: 'bg-gray-500' },
          userData: { id: userId }
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadUserAvatar();
  }, [userId, loadAvatar, getCachedAvatar, fallbackData]);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageError(false);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className={cn(
        'rounded-full bg-gray-700 animate-pulse flex items-center justify-center',
        sizeClasses[size],
        className
      )}>
        <User className="w-1/2 h-1/2 text-gray-400" />
      </div>
    );
  }

  const showImage = avatarData?.url && !imageError;
  const fallback = avatarData?.fallback || fallbackData || { initials: '?', color: 'bg-gray-500' };

  return (
    <div className="relative">
      <motion.div
        whileHover={onClick ? { scale: 1.05 } : {}}
        whileTap={onClick ? { scale: 0.95 } : {}}
        onClick={onClick}
        className={cn(
          'rounded-full overflow-hidden flex items-center justify-center border-2 border-white/20 cursor-pointer',
          sizeClasses[size],
          showImage ? 'bg-gray-800' : fallback.color,
          onClick && 'hover:border-white/40 transition-all duration-200',
          className
        )}
      >
        {showImage ? (
          <img
            src={avatarData.url}
            alt={avatarData.userData?.name || 'Avatar'}
            className="w-full h-full object-cover"
            onError={handleImageError}
            onLoad={handleImageLoad}
          />
        ) : (
          <span className="font-bold text-white select-none">
            {fallback.initials}
          </span>
        )}
      </motion.div>

      {/* Online indicator */}
      {showOnline && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: online ? 1 : 0 }}
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-gray-800',
            onlineIndicatorSizes[size],
            online ? 'bg-green-500' : 'bg-gray-500'
          )}
        />
      )}
    </div>
  );
};

export default EnhancedAvatar;