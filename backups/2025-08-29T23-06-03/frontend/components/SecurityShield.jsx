import React from 'react';
import { motion } from 'framer-motion';

export default function SecurityShield({ children }) {
  return (
    <div className="relative p-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden group">
      {/* Corner Brackets (HUD style) */}
      <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-cyan-400/50 rounded-tl-2xl transition-all duration-300 group-hover:w-10 group-hover:h-10"></div>
      <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-cyan-400/50 rounded-tr-2xl transition-all duration-300 group-hover:w-10 group-hover:h-10"></div>
      <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-cyan-400/50 rounded-bl-2xl transition-all duration-300 group-hover:w-10 group-hover:h-10"></div>
      <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-cyan-400/50 rounded-br-2xl transition-all duration-300 group-hover:w-10 group-hover:h-10"></div>
      
      {/* Quantum Shimmer Effect */}
      <div className="absolute inset-0 rounded-3xl transition-opacity duration-500 opacity-0 group-hover:opacity-100"
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 50%, rgba(0, 255, 255, 0.2))',
          animation: 'pulse 4s infinite'
        }}
      ></div>

      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
} 