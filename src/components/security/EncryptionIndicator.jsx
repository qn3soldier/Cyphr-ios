import React from 'react';
import { Shield, Lock, Zap, Atom } from 'lucide-react';

export const EncryptionIndicator = ({ isEncrypted = true, status = 'active', encryptionInfo = null }) => {
  const defaultInfo = {
    algorithm: 'Kyber1024 + ChaCha20',
    security: 'Post-Quantum Resistant',
    keySize: '256 bits (Kyber1024) + 256 bits (ChaCha20)',
    resistance: 'Resistant to quantum attacks using Shor\'s algorithm'
  };

  const info = encryptionInfo || defaultInfo;

  return (
    <div className="flex items-center gap-2">
      {isEncrypted ? (
        <>
          <Shield className="w-4 h-4 text-green-400" />
          <span className="text-green-400 text-xs font-medium">Post-Quantum Encrypted</span>
          <Atom className="w-3 h-3 text-purple-400" />
          <span className="text-purple-400 text-xs font-medium">Kyber1024</span>
          <Zap className="w-3 h-3 text-blue-400" />
          <span className="text-blue-400 text-xs font-medium">ChaCha20</span>
        </>
      ) : (
        <>
          <Lock className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-400 text-xs font-medium">Securing...</span>
        </>
      )}
    </div>
  );
}; 