import React from 'react';
import { motion } from 'framer-motion';

const AetheriumLogo = ({ size = 144 }) => {
  return (
    <motion.div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Outer Glow */}
      <motion.div
        className="absolute inset-0 rounded-full bg-accent-primary/20"
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0, 0.5, 0],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Atom Core (Message Bubble Shape) */}
      <div
        className="w-full h-full bg-background-secondary rounded-[50%_50%_50%_10%/50%_50%_10%_50%] rotate-45 border-2 border-accent-primary/30"
      />
      
      {/* Electron Orbit 1 */}
      <motion.div
        className="absolute w-full h-full border-2 border-accent-primary/50 rounded-full"
        style={{ rotateX: 60, rotateY: 20 }}
        animate={{ rotateZ: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
      >
        <motion.div className="absolute top-[-4px] left-1/2 w-2 h-2 bg-accent-primary rounded-full" />
      </motion.div>

      {/* Electron Orbit 2 */}
      <motion.div
        className="absolute w-full h-full border border-accent-secondary/50 rounded-full"
        style={{ rotateX: 60, rotateY: -70 }}
        animate={{ rotateZ: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear', delay: 1 }}
      >
        <motion.div className="absolute top-[-2px] left-1/2 w-1 h-1 bg-accent-secondary rounded-full" />
      </motion.div>
    </motion.div>
  );
};

export default AetheriumLogo; 