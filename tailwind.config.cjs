/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'electric-blue': 'hsl(199, 89%, 48%)',
        'neon-purple': 'hsl(271, 91%, 65%)',
        'cyan-glow': 'hsl(188, 91%, 48%)',
        'lightning-white': '#ffffff',
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        glow: {
          '0%': { opacity: 0.6 },
          '100%': { opacity: 1 }
        }
      }
    },
  },
  plugins: [
    require('tailwindcss-animate')
  ],
} 