import React from 'react';
import Animated from 'react-native-reanimated';
import { Check, CheckCheck, Lock, Clock, Shield, Star } from 'react-native-vector-icons/MaterialIcons';

export const MessageBubble = ({ message, isOwn, timestamp, status, isEncrypted, type, paymentData }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-white/50" />;
      case 'sent':
        return <Check className="w-3 h-3 text-white/70" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-white/70" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-blue-400" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
        <div
          className={`relative px-4 py-3 rounded-2xl ${
            type === 'crypto_payment'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
              : isOwn
              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
              : 'bg-white/10 backdrop-blur-xl text-white border border-white/20 shadow-lg'
          }`}
        >
          {type === 'crypto_payment' ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Star className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{message}</p>
                <p className="text-xs text-white/70 font-mono">
                  Hash: {paymentData?.hash?.slice(0, 8)}...{paymentData?.hash?.slice(-8)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{message}</p>
          )}
          
          {/* Encryption indicator */}
          {isEncrypted && (
            <div className="absolute -top-2 -left-2">
              <div className="bg-green-500 rounded-full p-1 shadow-lg">
                <Lock className="w-2 h-2 text-white" />
              </div>
            </div>
          )}
          
          {/* Security shield for own messages */}
          {isOwn && isEncrypted && (
            <div className="absolute -top-2 -right-2">
              <div className="bg-blue-500 rounded-full p-1 shadow-lg">
                <Shield className="w-2 h-2 text-white" />
              </div>
            </div>
          )}
        </div>
        
        {/* Timestamp and status */}
        <div className={`flex items-center space-x-1 mt-2 text-xs ${
          isOwn ? 'justify-end' : 'justify-start'
        }`}>
          <span className={`${
            isOwn ? 'text-white/60' : 'text-white/40'
          }`}>
            {timestamp}
          </span>
          {isOwn && getStatusIcon()}
        </div>
      </div>
    </motion.div>
  );
}; 