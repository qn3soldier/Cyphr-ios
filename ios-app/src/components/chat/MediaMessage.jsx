import React, { useState, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import { Download, Play, X, Maximize2, Shield, Unlock } from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../ui/button';
import { secureChaCha20 } from '../../api/crypto/secureChaCha20.ts';
import { toast } from 'react-native-toast-message';

export default function MediaMessage({ 
  mediaUrl, 
  mediaType, // 'image' or 'video'
  thumbnailUrl,
  fileName,
  fileSize,
  isOwn,
  timestamp,
  // New props for encrypted media
  encrypted = false,
  encryptionKey = null,
  originalName = null,
  originalType = null,
  originalSize = null
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [decryptedUrl, setDecryptedUrl] = useState(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionError, setDecryptionError] = useState(null);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Decrypt encrypted media on component mount
  useEffect(() => {
    if (encrypted && encryptionKey && mediaUrl && !decryptedUrl) {
      decryptMedia();
    }
  }, [encrypted, encryptionKey, mediaUrl, decryptedUrl]);

  const decryptMedia = async () => {
    if (!encrypted || !encryptionKey || !mediaUrl) return;
    
    setIsDecrypting(true);
    setDecryptionError(null);
    
    try {
      // Fetch encrypted file from Supabase Storage
      const response = await fetch(mediaUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch encrypted file');
      }
      
      const encryptedData = await response.arrayBuffer();
      const encryptedBytes = new Uint8Array(encryptedData);
      
      // Convert key array back to Uint8Array
      const keyBytes = new Uint8Array(encryptionKey);
      
      // Decrypt using ChaCha20
      const decryptedData = await secureChaCha20.decrypt(encryptedBytes, keyBytes);
      
      // Create blob with original MIME type
      const decryptedBlob = new Blob([decryptedData], { 
        type: originalType || mediaType === 'image' ? 'image/jpeg' : 'video/mp4' 
      });
      
      // Create object URL for display
      const objectUrl = URL.createObjectURL(decryptedBlob);
      setDecryptedUrl(objectUrl);
      
      console.log('✅ Media decrypted successfully:', originalName || fileName);
    } catch (error) {
      console.error('❌ Media decryption failed:', error);
      setDecryptionError(error.message);
      toast.error('Failed to decrypt media file');
    } finally {
      setIsDecrypting(false);
    }
  };

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (decryptedUrl) {
        URL.revokeObjectURL(decryptedUrl);
      }
    };
  }, [decryptedUrl]);

  const handleDownload = () => {
    const link = document.createElement('a');
    
    if (encrypted && decryptedUrl) {
      // Download decrypted file with original name and type
      link.href = decryptedUrl;
      link.download = originalName || fileName || `media_${Date.now()}.${originalType?.split('/')[1] || 'file'}`;
    } else {
      // Download regular unencrypted file
      link.href = mediaUrl;
      link.download = fileName || `media_${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`;
    }
    
    link.click();
  };

  const MediaPreview = () => {
    // Show decryption states for encrypted media
    if (encrypted) {
      if (isDecrypting) {
        return (
          <div className="w-full h-48 bg-background-secondary/50 flex flex-col items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mb-3"
            />
            <div className="flex items-center gap-2 text-accent-primary">
              <Unlock className="w-4 h-4" />
              <span className="text-sm">Decrypting file...</span>
            </div>
          </div>
        );
      }

      if (decryptionError) {
        return (
          <div className="w-full h-48 bg-red-500/10 flex flex-col items-center justify-center">
            <X className="w-8 h-8 text-red-500 mb-2" />
            <span className="text-sm text-red-500">Decryption failed</span>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={decryptMedia}
              className="mt-2 text-red-500 border-red-500"
            >
              Retry
            </Button>
          </div>
        );
      }

      if (!decryptedUrl) {
        return (
          <div className="w-full h-48 bg-background-secondary/50 flex flex-col items-center justify-center">
            <Shield className="w-8 h-8 text-green-400 mb-2" />
            <span className="text-sm text-green-400">Encrypted Media</span>
          </div>
        );
      }
    }

    // Use appropriate URL (decrypted for encrypted files, original for regular files)
    const displayUrl = encrypted && decryptedUrl ? decryptedUrl : mediaUrl;
    const displayType = encrypted ? (originalType || mediaType) : mediaType;

    if (displayType?.startsWith('image/') || mediaType === 'image') {
      return (
        <motion.img
          src={displayUrl}
          alt={originalName || fileName}
          className="w-full h-full object-cover cursor-pointer"
          onLoad={() => setIsLoading(false)}
          onClick={() => setIsFullscreen(true)}
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        />
      );
    }

    return (
      <div className="relative w-full h-full">
        <video
          src={displayUrl}
          poster={thumbnailUrl}
          className="w-full h-full object-cover"
          onLoadedData={() => setIsLoading(false)}
          controls={isPlaying}
          onClick={() => !isPlaying && setIsPlaying(true)}
        />
        {!isPlaying && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
            onClick={() => setIsPlaying(true)}
            whileHover={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          >
            <motion.div
              className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Play className="w-8 h-8 text-black ml-1" />
            </motion.div>
          </motion.div>
        )}
      </div>
    );
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative rounded-2xl overflow-hidden backdrop-blur-xl ${
          isOwn ? 'rounded-br-sm' : 'rounded-bl-sm'
        }`}
        style={{ maxWidth: '300px', minWidth: '200px' }}
      >
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 bg-background-secondary/80 flex items-center justify-center z-10">
            <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Media Content */}
        <div className="relative" style={{ height: mediaType === 'video' ? '200px' : 'auto' }}>
          <MediaPreview />
          
          {/* Action Buttons */}
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsFullscreen(true)}
              className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDownload}
              className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* File Info */}
        <div className={`p-3 ${isOwn ? 'bg-accent-primary/20' : 'bg-background-secondary/80'}`}>
          <div className="flex items-center gap-2">
            <p className="text-sm text-text-primary truncate flex-1">
              {originalName || fileName || 'Media file'}
            </p>
            {encrypted && (
              <Shield className="w-4 h-4 text-green-400 flex-shrink-0" title="End-to-end encrypted" />
            )}
          </div>
          <p className="text-xs text-text-secondary/70">
            {formatFileSize(originalSize || fileSize || 0)} • {new Date(timestamp).toLocaleTimeString()}
            {encrypted && <span className="text-green-400"> • Encrypted</span>}
          </p>
        </div>
      </motion.div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
            onClick={() => setIsFullscreen(false)}
          >
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 text-white hover:bg-white/10"
            >
              <X className="w-6 h-6" />
            </Button>

            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              {(encrypted && decryptedUrl) || (!encrypted) ? (
                <>
                  {((encrypted ? originalType : mediaType)?.startsWith('image/') || mediaType === 'image') ? (
                    <img
                      src={encrypted && decryptedUrl ? decryptedUrl : mediaUrl}
                      alt={originalName || fileName}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <video
                      src={encrypted && decryptedUrl ? decryptedUrl : mediaUrl}
                      poster={thumbnailUrl}
                      controls
                      autoPlay
                      className="max-w-full max-h-full"
                    />
                  )}
                </>
              ) : (
                <div className="bg-background-secondary/50 p-8 rounded-lg flex flex-col items-center justify-center">
                  <Shield className="w-12 h-12 text-green-400 mb-4" />
                  <p className="text-lg text-green-400 mb-2">Encrypted Media</p>
                  <p className="text-sm text-text-secondary text-center">
                    This file is protected with post-quantum encryption
                  </p>
                </div>
              )}
            </motion.div>

            <Button
              size="icon"
              onClick={handleDownload}
              className="absolute bottom-4 right-4 bg-white/10 hover:bg-white/20 text-white"
            >
              <Download className="w-5 h-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
} 