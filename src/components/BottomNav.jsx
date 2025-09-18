import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, Phone, CreditCard, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

const navItems = [
  { id: 'chats', label: 'Chats', icon: MessageCircle, path: '/chats' },
  { id: 'calls', label: 'Calls', icon: Phone, path: '/calls' },
  { id: 'wallet', label: 'Wallet', icon: CreditCard, path: '/crypto-wallet' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm mx-auto z-50">
      <div className="bg-gray-900/50 backdrop-blur-2xl border-2 border-white/20 rounded-full p-2 shadow-2xl shadow-blue-500/20">
        <div className="flex justify-around items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <motion.button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="relative flex flex-col items-center justify-center w-16 h-16 rounded-full transition-colors duration-300 focus:outline-none"
                whileTap={{ scale: 0.95 }}
              >
                {active && (
                  <motion.div
                    layoutId="active-nav-indicator"
                    className="absolute inset-0 bg-blue-500/80 rounded-full shadow-lg shadow-blue-400/50"
                    initial={false}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 35 }}
                  />
                )}
                <div className="relative z-10 flex flex-col items-center">
                  <Icon
                    size={26}
                    className={`transition-colors duration-300 ${
                      active ? 'text-white' : 'text-gray-300 group-hover:text-white'
                    }`}
                  />
                   <span className={`text-[10px] mt-1 font-bold tracking-wider transition-colors duration-300 ${
                    active ? 'text-white' : 'text-gray-400 group-hover:text-white'
                  }`}>
                    {item.label.toUpperCase()}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomNav; 