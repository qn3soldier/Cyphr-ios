import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  QrCode, 
  Share2, 
  Smartphone, 
  MapPin, 
  Phone, 
  Settings,
  User,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react';
import discoveryService from '@/services/discoveryService';

export default function DiscoveryHub() {
  const [activeMethod, setActiveMethod] = useState('cyphr_id');
  const [cyphrIdQuery, setCyphrIdQuery] = useState('');
  const [cyphrIdAvailable, setCyphrIdAvailable] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [shareLink, setShareLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const discoveryMethods = [
    {
      id: 'cyphr_id',
      name: 'Cyphr ID',
      icon: User,
      description: '@username поиск',
      color: 'from-violet-600 to-purple-600'
    },
    {
      id: 'qr_code',
      name: 'QR Code',
      icon: QrCode,
      description: 'Сканировать или создать QR',
      color: 'from-blue-600 to-cyan-600'
    },
    {
      id: 'share_link',
      name: 'Share Link',
      icon: Share2,
      description: 'cyphr.me/add/username',
      color: 'from-green-600 to-emerald-600'
    },
    {
      id: 'quantum_handshake',
      name: 'Quantum Handshake',
      icon: Smartphone,
      description: 'Встряхивание устройств',
      color: 'from-orange-600 to-red-600'
    },
    {
      id: 'nearby',
      name: 'Nearby Users',
      icon: MapPin,
      description: 'Поиск рядом',
      color: 'from-pink-600 to-rose-600'
    },
    {
      id: 'phone',
      name: 'Phone Search',
      icon: Phone,
      description: 'По номеру телефона',
      color: 'from-indigo-600 to-purple-600'
    }
  ];

  // Check Cyphr ID availability
  const checkCyphrId = async (cyphrId) => {
    if (!cyphrId || cyphrId.length < 3) {
      setCyphrIdAvailable(null);
      return;
    }

    setLoading(true);
    try {
      const result = await discoveryService.checkCyphrIdAvailable(cyphrId);
      setCyphrIdAvailable(result);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Search by Cyphr ID
  const searchByCyphrId = async (cyphrId) => {
    setLoading(true);
    try {
      const result = await discoveryService.searchByCyphrId(cyphrId);
      setSearchResults(result);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate QR Code
  const generateQRCode = async () => {
    setLoading(true);
    try {
      const result = await discoveryService.generateQRCode();
      setQrCode(result);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate Share Link
  const generateShareLink = async () => {
    setLoading(true);
    try {
      const result = await discoveryService.generateShareLink();
      setShareLink(result);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Debounced Cyphr ID check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (cyphrIdQuery) {
        checkCyphrId(cyphrIdQuery);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [cyphrIdQuery]);

  const renderMethodContent = () => {
    switch (activeMethod) {
      case 'cyphr_id':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Поиск по Cyphr ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="@alice_quantum"
                  value={cyphrIdQuery}
                  onChange={(e) => setCyphrIdQuery(e.target.value)}
                  className="glass rounded-lg px-4 py-3 pl-10 w-full text-white placeholder-white/60 border border-white/20 focus:border-purple-400 focus:outline-none"
                />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                {loading && (
                  <Loader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-purple-400" />
                )}
              </div>
              
              {cyphrIdAvailable && (
                <div className="mt-2 flex items-center gap-2">
                  {cyphrIdAvailable.available ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm ${cyphrIdAvailable.available ? 'text-green-500' : 'text-red-500'}`}>
                    {cyphrIdAvailable.available ? 'Доступно' : 'Занято'}
                  </span>
                </div>
              )}
            </div>

            <button 
              onClick={() => searchByCyphrId(cyphrIdQuery)}
              disabled={!cyphrIdQuery || loading}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Найти пользователя
            </button>

            {searchResults && (
              <div className="p-4 glass rounded-lg border border-white/20">
                {searchResults.user ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold">
                        {searchResults.user.full_name?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-white">{searchResults.user.full_name}</p>
                      <p className="text-sm text-white/60">{searchResults.user.cyphr_id}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-white/60">Пользователь не найден</p>
                )}
              </div>
            )}
          </div>
        );

      case 'qr_code':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <button 
                onClick={generateQRCode}
                disabled={loading}
                className="w-full mb-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Создать QR код
              </button>
              
              {qrCode && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg inline-block">
                    <img 
                      src={qrCode.qrCode} 
                      alt="QR Code" 
                      className="w-48 h-48 mx-auto"
                    />
                  </div>
                  <p className="text-sm text-white/60">
                    QR код действует до: {new Date(qrCode.expiresAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 'share_link':
        return (
          <div className="space-y-6">
            <button 
              onClick={generateShareLink}
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Создать ссылку для sharing
            </button>

            {shareLink && (
              <div className="p-4 glass rounded-lg border border-white/20">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">
                      Ваша ссылка:
                    </label>
                    <div className="flex gap-2">
                      <input 
                        value={shareLink.shareLink} 
                        readOnly 
                        className="flex-1 glass rounded-lg px-4 py-3 text-white placeholder-white/60 border border-white/20"
                      />
                      <button 
                        onClick={() => navigator.clipboard.writeText(shareLink.shareLink)}
                        className="px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-medium hover:from-violet-700 hover:to-purple-700 transition-all"
                      >
                        Копировать
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-white/60">
                    Cyphr ID: {shareLink.cyphrId}
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 'quantum_handshake':
        return (
          <div className="space-y-6 text-center">
            <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 rounded-lg text-white">
              <Smartphone className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Quantum Handshake</h3>
              <p className="text-sm opacity-90">
                Революционный P2P метод обмена ключами через физическое встряхивание устройств
              </p>
            </div>
            <button className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-lg font-medium opacity-50 cursor-not-allowed" disabled>
              Функция в разработке
            </button>
          </div>
        );

      case 'nearby':
        return (
          <div className="space-y-6 text-center">
            <div className="bg-gradient-to-r from-pink-600 to-rose-600 p-6 rounded-lg text-white">
              <MapPin className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nearby Users</h3>
              <p className="text-sm opacity-90">
                Временная видимость для пользователей рядом с защитой приватности
              </p>
            </div>
            <button className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-lg font-medium opacity-50 cursor-not-allowed" disabled>
              Функция в разработке
            </button>
          </div>
        );

      case 'phone':
        return (
          <div className="space-y-6 text-center">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-lg text-white">
              <Phone className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Phone Discovery</h3>
              <p className="text-sm opacity-90">
                Опциональный поиск по хешу номера телефона с triple-hash защитой
              </p>
            </div>
            <button className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-lg font-medium opacity-50 cursor-not-allowed" disabled>
              Функция в разработке
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[rgb(10,14,39)] to-[rgb(30,36,80)] text-white">
      {/* Background effects */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600 rounded-full filter blur-[128px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-600 rounded-full filter blur-[128px] opacity-20 animate-pulse animation-delay-2000"></div>

      <div className="relative z-10 max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            🚀 Discovery Hub
          </h1>
          <p className="text-white/60">
            Революционная система поиска пользователей - 6 методов discovery
          </p>
        </div>

        {error && (
          <div className="p-4 mb-6 glass rounded-lg border border-red-400/30">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Methods Sidebar */}
          <div className="lg:col-span-1">
            <div className="p-4 glass rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-purple-400" />
                <h2 className="font-semibold text-white">Discovery Methods</h2>
              </div>
              
              <div className="space-y-2">
                {discoveryMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <motion.button
                      key={method.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveMethod(method.id)}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        activeMethod === method.id
                          ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white'
                          : 'glass hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-r ${method.color}`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">{method.name}</p>
                          <p className="text-xs opacity-70">{method.description}</p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="p-6 glass rounded-xl">
              <div className="mb-6">
                {(() => {
                  const activeMethodData = discoveryMethods.find(m => m.id === activeMethod);
                  const Icon = activeMethodData?.icon;
                  return (
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg bg-gradient-to-r ${activeMethodData?.color}`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-white">
                          {activeMethodData?.name}
                        </h2>
                        <p className="text-white/60">
                          {activeMethodData?.description}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {renderMethodContent()}
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="p-6 mt-6 glass rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">
            🏆 Competitive Advantage
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-purple-400">6</p>
              <p className="text-sm text-white/60">Discovery Methods</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">100%</p>
              <p className="text-sm text-white/60">Zero Knowledge</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-400">Post-Quantum</p>
              <p className="text-sm text-white/60">Kyber1024 Security</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}