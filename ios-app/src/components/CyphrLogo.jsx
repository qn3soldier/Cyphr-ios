import React from 'react';
import Animated from 'react-native-reanimated';

const CyphrLogo = ({ size = "medium" }) => {
  const sizes = {
    small: "w-16 h-16",
    medium: "w-24 h-24",
    large: "w-32 h-32"
  };

  const containerVariants = {
    initial: {
      scale: 0.95,
      opacity: 0.8,
    },
    animate: {
      scale: 1,
      opacity: 1,
      transition: {
        duration: 2,
        ease: "easeInOut",
      },
    },
  };

  return (
    <motion.div
      className={`${sizes[size]} flex items-center justify-center relative`}
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      <motion.img
        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/dec7b14f2_2025-06-2451203PM.png"
        alt="Cyphr Logo"
        className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(0,190,255,0.3)]"
      />
      <div className="absolute inset-0 bg-gradient-radial from-blue-500/10 to-transparent to-70% pointer-events-none"></div>
    </motion.div>
  );
};

export default CyphrLogo; 