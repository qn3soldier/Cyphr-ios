import React from 'react';

export const CyphrLogoTransparent = ({ className = "w-8 h-8", showText = false, color = "white" }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Atom in Speech Bubble Logo - Transparent Background */}
      <div className="relative">
        <svg 
          viewBox="0 0 40 40" 
          className="w-full h-full"
          fill="none"
        >
          {/* Speech bubble background - transparent fill */}
          <path
            d="M8 8C8 5.79086 9.79086 4 12 4H24C26.2091 4 28 5.79086 28 8V20C28 22.2091 26.2091 24 24 24H16L12 28V24H8C5.79086 24 4 22.2091 4 20V8C4 5.79086 5.79086 4 8 4Z"
            fill="none"
            stroke={`var(--${color})`}
            strokeWidth="2"
            className={`text-${color}`}
          />
          
          {/* Atom nucleus */}
          <circle cx="16" cy="14" r="2" fill={`var(--${color})`} className={`text-${color}`} />
          
          {/* Atom orbits */}
          <ellipse 
            cx="16" 
            cy="14" 
            rx="6" 
            ry="3" 
            stroke={`var(--${color})`} 
            strokeWidth="1.5"
            className={`text-${color}`}
            transform="rotate(0 16 14)"
          />
          <ellipse 
            cx="16" 
            cy="14" 
            rx="6" 
            ry="3" 
            stroke={`var(--${color})`} 
            strokeWidth="1.5"
            className={`text-${color}`}
            transform="rotate(60 16 14)"
          />
          <ellipse 
            cx="16" 
            cy="14" 
            rx="6" 
            ry="3" 
            stroke={`var(--${color})`} 
            strokeWidth="1.5"
            className={`text-${color}`}
            transform="rotate(120 16 14)"
          />
          
          {/* Sparkles/Plus signs */}
          <path d="M10 10L12 10M11 9L11 11" stroke={`var(--${color})`} strokeWidth="1.5" className={`text-${color}`} />
          <path d="M22 10L24 10M23 9L23 11" stroke={`var(--${color})`} strokeWidth="1.5" className={`text-${color}`} />
          <path d="M22 18L24 18M23 17L23 19" stroke={`var(--${color})`} strokeWidth="1.5" className={`text-${color}`} />
        </svg>
      </div>
      
      {/* Text logo */}
      {showText && (
        <div className="flex flex-col">
          <span className={`text-lg font-bold text-${color}`}>Cyphr Messenger</span>
          <span className={`text-xs text-${color}/60 font-medium`}>Secure & Private</span>
        </div>
      )}
    </div>
  );
}; 