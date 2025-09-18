import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Video, User } from 'lucide-react';
import { toast } from 'sonner';

export default function IncomingCallModal({ 
  isOpen, 
  onAnswer, 
  onDecline, 
  callData 
}) {
  const [ringtoneInterval, setRingtoneInterval] = useState(null);
  const [audio] = useState(() => {
    try {
      const audioElement = new Audio('/ringtone.mp3');
      audioElement.loop = true;
      audioElement.volume = 0.5;
      return audioElement;
    } catch (error) {
      console.warn('Audio not available:', error);
      return null;
    }
  });

  useEffect(() => {
    if (isOpen) {
      // Play ringtone
      if (audio) {
        audio.play().catch(e => console.log('Audio play failed:', e));
      }
      
      // Vibrate pattern
      const interval = setInterval(() => {
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200]);
        }
      }, 2000);
      
      setRingtoneInterval(interval);
      
      // Auto-decline after 30 seconds
      const timeout = setTimeout(() => {
        onDecline();
        toast.info('Call ended - no answer');
      }, 30000);
      
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      };
    } else {
      if (ringtoneInterval) {
        clearInterval(ringtoneInterval);
      }
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  }, [isOpen, audio]);

  if (!isOpen || !callData) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gradient-to-b from-gray-900 to-black rounded-3xl p-8 max-w-sm w-full text-center"
        >
          {/* Animated rings */}
          <div className="relative mb-8">
            <div className="w-32 h-32 mx-auto relative">
              {/* Avatar */}
              <div className="absolute inset-0 bg-gray-800 rounded-full flex items-center justify-center overflow-hidden z-10">
                {callData.callerAvatar ? (
                  <img 
                    src={callData.callerAvatar} 
                    alt={callData.callerName} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={48} className="text-gray-600" />
                )}
              </div>
              
              {/* Animated rings */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 border-2 border-white/20 rounded-full"
                  animate={{
                    scale: [1, 1.5, 2],
                    opacity: [0.6, 0.3, 0]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.5
                  }}
                />
              ))}
            </div>
          </div>

          {/* Caller info */}
          <h2 className="text-2xl font-semibold text-white mb-2">
            {callData.callerName || 'Unknown'}
          </h2>
          <p className="text-gray-400 mb-8">
            Incoming {callData.callType === 'video' ? 'video' : 'voice'} call...
          </p>

          {/* Call actions */}
          <div className="flex justify-center gap-6">
            {/* Decline */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onDecline}
              className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-colors"
            >
              <PhoneOff size={28} className="text-white" />
            </motion.button>

            {/* Answer */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAnswer}
              className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg transition-colors"
            >
              {callData.callType === 'video' ? (
                <Video size={28} className="text-white" />
              ) : (
                <Phone size={28} className="text-white" />
              )}
            </motion.button>
          </div>

          {/* Slide to answer hint */}
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-xs text-gray-500 mt-6"
          >
            {callData.callType === 'video' ? 'Video call' : 'Voice call'} • End-to-end encrypted
          </motion.p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 