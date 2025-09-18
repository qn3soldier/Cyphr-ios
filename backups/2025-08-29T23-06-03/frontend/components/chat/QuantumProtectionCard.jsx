import React from 'react';
import { ShieldCheck, Lock, Zap } from 'lucide-react';

const QuantumProtectionCard = () => {
  return (
    <div className="glass rounded-2xl p-4 border border-white/10 shadow-lg glow-purple relative overflow-hidden">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-cyan-600/10 rounded-2xl"></div>
      
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">QUANTUM PROTECTION</h2>
              <p className="text-xs text-green-400 font-semibold uppercase flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                </span>
                Encryption Active
              </p>
            </div>
          </div>
          <div className="text-green-400">
            <span className="text-xs font-bold">SECURED</span>
          </div>
        </div>
        
        <p className="text-white/70 text-xs mb-4 leading-relaxed">
          Your messages are protected by{' '}
          <span className="font-bold text-purple-300">Kyber1024</span> +{' '}
          <span className="font-bold text-cyan-300">ChaCha20</span> quantum-resistant encryption.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="glass rounded-lg p-3 flex items-center space-x-2 transition-all hover:bg-white/10 border border-white/5">
            <Lock className="h-4 w-4 text-purple-300" />
            <div>
              <h4 className="font-semibold text-white text-xs">End-to-End</h4>
              <p className="text-xs text-white/50 uppercase">Encrypted</p>
            </div>
          </div>
          <div className="glass rounded-lg p-3 flex items-center space-x-2 transition-all hover:bg-cyan-500/20 border border-cyan-400/20 glow-blue">
            <Zap className="h-4 w-4 text-cyan-300" />
            <div>
              <h4 className="font-semibold text-white text-xs">Quantum</h4>
              <p className="text-xs text-cyan-300 uppercase">Protected</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuantumProtectionCard; 