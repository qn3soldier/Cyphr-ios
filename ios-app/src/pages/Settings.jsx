import React, { useState, useEffect } from 'react';
import { Link, useNavigation } from '@react-navigation/native';
import { ChevronRight, Shield, Bell, Lock, User, HelpCircle, LogOut, Phone, Key, CreditCard, Globe, Copy, AtSign } from 'react-native-vector-icons/MaterialIcons';
import { toast } from 'react-native-toast-message';
import { zeroKnowledgeAuth } from '../api/authService';
import { ThemeToggle } from '../components/ThemeProvider';
import { supabase } from '../api/supabaseClient';

export default function Settings() {
  const navigate = useNavigation();
  const user = zeroKnowledgeAuth.getUser();
  const [cyphrId, setCyphrId] = useState('');

  useEffect(() => {
    loadCyphrId();
  }, []);

  const loadCyphrId = async () => {
    try {
      const userId = sessionStorage.getItem('userId');
      if (userId) {
        const { data } = await supabase
          .from('users')
          .select('cyphr_id')
          .eq('id', userId)
          .single();
        
        if (data?.cyphr_id) {
          setCyphrId(data.cyphr_id);
        }
      }
    } catch (error) {
      console.error('Error loading cyphr_id:', error);
    }
  };

  const copyCyphrId = () => {
    if (cyphrId) {
      navigator.clipboard.writeText(`@${cyphrId}`);
      toast.success('Cyphr ID copied!');
    }
  };

  const handleLogout = () => {
    zeroKnowledgeAuth.logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const handleResetApp = async () => {
    if (!confirm('⚠️ ВНИМАНИЕ! Это удалит ВСЕ данные:\n\n• Ваш аккаунт и профиль\n• Все чаты и сообщения\n• Криптографические ключи\n• Настройки приложения\n\nПродолжить?')) {
      return;
    }

    if (!confirm('🔥 ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ!\n\nВы уверены что хотите ПОЛНОСТЬЮ сбросить приложение?\n\nЭто действие НЕОБРАТИМО!')) {
      return;
    }

    try {
      toast.loading('Сброс приложения...');
      
      // 1. Очистить все localStorage данные
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        keysToRemove.push(localStorage.key(i));
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // 2. Очистить sessionStorage
      sessionStorage.clear();
      
      // 3. Очистить IndexedDB (если используется)
      if ('indexedDB' in window) {
        try {
          const databases = await indexedDB.databases();
          for (const db of databases) {
            indexedDB.deleteDatabase(db.name);
          }
        } catch (e) {
          console.warn('IndexedDB cleanup failed:', e);
        }
      }
      
      // 4. Очистить Service Worker cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
        }
      }
      
      // 5. Logout из auth service
      zeroKnowledgeAuth.logout();
      
      toast.success('✅ Приложение полностью сброшено!');
      
      // 6. Перезагрузить страницу
      setTimeout(() => {
        window.location.href = '/';
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Reset failed:', error);
      toast.error('Ошибка при сбросе приложения');
    }
  };

  const settingsSections = [
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Account', path: '/profile', desc: 'Profile, avatar, about' },
        { icon: Lock, label: 'Privacy', path: '/privacy-settings', desc: 'Last seen, profile photo' },
        { icon: Key, label: 'Security', path: '/security-settings', desc: '2FA, encryption keys' }
      ]
    },
    {
      title: 'App Settings',
      items: [
        { icon: Shield, label: 'Chats', path: '/chat-settings', desc: 'Backup, history' },
        { icon: Bell, label: 'Notifications', path: '/notification-settings', desc: 'Message, group, call alerts' },
        { icon: CreditCard, label: 'Crypto Wallet', path: '/crypto-wallet', desc: 'Stellar, transactions' }
      ]
    },
    {
      title: 'Support',
      items: [
        { icon: HelpCircle, label: 'Help Center', path: '/help', desc: 'FAQ, contact support' }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[rgb(10,14,39)] to-[rgb(30,36,80)] text-white">
      {/* Header */}
      <div className="glass border-b border-white/10">
        <div className="p-6 pb-0">
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        
        {/* User Info */}
        <div className="p-6 flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-xl font-bold">
            {user?.nickname?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{user?.nickname || 'User'}</h2>
            {cyphrId && (
              <button 
                onClick={copyCyphrId}
                className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors group"
              >
                <AtSign size={14} />
                <span className="font-medium">{cyphrId}</span>
                <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            <p className="text-white/60 text-sm">{user?.phone || ''}</p>
          </div>
          <Link to="/profile" className="p-2 glass rounded-full">
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="p-6 space-y-6">
        {settingsSections.map((section, idx) => (
          <div key={idx} className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-white/50 px-2">{section.title}</h3>
            <div className="glass rounded-2xl overflow-hidden">
              {section.items.map((item, itemIdx) => (
                <Link
                  key={itemIdx}
                  to={item.path}
                  className="flex items-center p-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center mr-4">
                    <item.icon className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{item.label}</h4>
                    <p className="text-sm text-white/60">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/30" />
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Theme Toggle */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center mr-4">
                <Shield className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium">Appearance</h4>
                <p className="text-sm text-white/60">Light / Dark theme</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Reset App Button */}
        <button
          onClick={handleResetApp}
          className="w-full glass glass-hover rounded-2xl p-4 flex items-center justify-center space-x-3 text-yellow-400 hover:bg-yellow-500/10 transition-all border border-yellow-500/20"
        >
          <Key className="w-5 h-5" />
          <span className="font-medium">🔄 Reset App (Full Cleanup)</span>
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full glass glass-hover rounded-2xl p-4 flex items-center justify-center space-x-3 text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Log Out</span>
        </button>
      </div>
    </div>
  );
}; 