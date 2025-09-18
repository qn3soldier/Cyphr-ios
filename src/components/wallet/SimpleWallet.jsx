import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Shield, Plus, Key } from 'lucide-react';

const SimpleWallet = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [walletExists, setWalletExists] = useState(false);

  useEffect(() => {
    const initWallet = async () => {
      try {
        console.log('🚀 Simple wallet initialization...');
        
        // Simple check - no complex imports
        const walletData = localStorage.getItem('cypher_encrypted_wallet');
        const exists = walletData !== null;
        
        console.log('📊 Wallet exists:', exists);
        setWalletExists(exists);
        setLoading(false);
        
      } catch (err) {
        console.error('❌ Simple wallet error:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    initWallet();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-blue-400"
        >
          <Wallet className="w-16 h-16" />
        </motion.div>
        <div className="ml-4 text-white">
          <p>Загрузка кошелька...</p>
          <p className="text-sm text-gray-400">Инициализация системы</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-2">Ошибка загрузки</h2>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!walletExists) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <Shield className="w-20 h-20 text-blue-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-white mb-2">
                Quantum-Safe Wallet
              </h1>
              <p className="text-gray-300">
                Создайте или восстановите свой кошелек
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => alert('Создание кошелька - функция в разработке')}
                className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg rounded-xl text-white font-semibold flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Создать новый кошелек
              </button>
              
              <button
                onClick={() => alert('Восстановление кошелька - функция в разработке')}
                className="w-full border border-gray-600 text-white hover:bg-gray-800 py-6 text-lg rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <Key className="w-5 h-5" />
                Восстановить кошелек
              </button>
            </div>

            <div className="mt-8 p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
              <div className="text-amber-300 text-sm">
                <p className="font-semibold mb-1">🔒 Политика нулевого хранения:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Seed-фраза никогда не сохраняется в Cyphr</li>
                  <li>Только вы имеете доступ к приватным ключам</li>
                  <li>Безопасно запишите seed-фразу</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <Shield className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">
            Кошелек найден! 🎉
          </h1>
          <p className="text-gray-300 mb-4">
            Зашифрованный кошелек обнаружен в localStorage
          </p>
          <button
            onClick={() => alert('PIN разблокировка - функция в разработке')}
            className="bg-blue-600 hover:bg-blue-700 px-8 py-4 text-lg rounded-xl text-white font-semibold"
          >
            Разблокировать с PIN
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimpleWallet;