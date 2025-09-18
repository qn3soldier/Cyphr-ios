import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Eye, EyeOff, Users, Phone, UserCheck, Info, Shield, Globe, Lock, Settings, Zap, MapPin, Server } from 'react-native-vector-icons/MaterialIcons';
import { toast } from 'react-native-toast-message';
import { supabase } from '../api/supabaseClient';
import { zeroKnowledgeAuth } from '../api/authService';
import { socketService } from '../api/socketService';
import { privacyConfigService } from '../api/privacyConfigService';

const PrivacySettings = () => {
  const navigate = useNavigation();
  const [settings, setSettings] = useState({
    lastSeen: 'everyone',
    profilePhoto: 'everyone', 
    about: 'everyone',
    readReceipts: true,
    typing: true,
    onlineStatus: true,
    blockUnknown: false,
    // СОРМ protection settings
    privacyMode: false,
    p2pEnabled: false
  });
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [privacyStatus, setPrivacyStatus] = useState({});
  
  // Enhanced privacy configuration state
  const [privacyConfig, setPrivacyConfig] = useState(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [privacyMetrics, setPrivacyMetrics] = useState(null);

  useEffect(() => {
    loadSettings();
    loadBlockedUsers();
    loadPrivacyConfig();
    updatePrivacyStatus();
    
    // Update privacy status every 5 seconds
    const interval = setInterval(() => {
      updatePrivacyStatus();
      updatePrivacyMetrics();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const updatePrivacyStatus = () => {
    const status = socketService.getPrivacyStatus();
    setPrivacyStatus(status);
  };

  const loadPrivacyConfig = async () => {
    try {
      await privacyConfigService.initialize();
      const config = privacyConfigService.getConfig();
      setPrivacyConfig(config);
      console.log('📋 Privacy config loaded:', config);
    } catch (error) {
      console.error('❌ Failed to load privacy config:', error);
    }
  };

  const updatePrivacyMetrics = () => {
    try {
      const metrics = privacyConfigService.getPrivacyMetrics();
      setPrivacyMetrics(metrics);
    } catch (error) {
      console.error('❌ Failed to update privacy metrics:', error);
    }
  };

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const user = zeroKnowledgeAuth.getUser();
      if (!user?.id) {
        console.log('No user found, skipping settings load');
        setIsLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('user_settings')
        .select('privacy_settings')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.privacy_settings) {
        setSettings(data.privacy_settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load privacy settings');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBlockedUsers = async () => {
    try {
      const user = zeroKnowledgeAuth.getUser();
      if (!user?.id) {
        console.log('No user found, skipping blocked users load');
        return;
      }
      const { data, error } = await supabase
        .from('blocked_users')
        .select(`
          blocked_user:users!blocked_user_id(
            id,
            nickname,
            phone
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      setBlockedUsers(data || []);
    } catch (error) {
      console.error('Error loading blocked users:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      const user = zeroKnowledgeAuth.getUser();
      
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          privacy_settings: settings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      toast.success('Privacy settings updated');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handlePrivacyModeToggle = async () => {
    try {
      const newValue = !settings.privacyMode;
      
      if (newValue) {
        toast.loading('Enabling privacy mode...');
        await socketService.enablePrivacyMode();
        toast.success('🔒 Privacy mode enabled - traffic obfuscated');
      } else {
        toast.loading('Disabling privacy mode...');
        await socketService.disablePrivacyMode();
        toast.success('🔓 Privacy mode disabled');
      }
      
      setSettings(prev => ({ ...prev, privacyMode: newValue }));
      updatePrivacyStatus();
      
    } catch (error) {
      console.error('Privacy mode toggle error:', error);
      toast.error('Failed to toggle privacy mode');
    }
  };

  const handleP2PToggle = async () => {
    try {
      const newValue = !settings.p2pEnabled;
      
      if (newValue) {
        toast.loading('Enabling P2P network...');
        await socketService.enableP2P();
        toast.success('🌐 P2P network enabled');
      } else {
        toast.loading('Disabling P2P network...');
        await socketService.disableP2P();
        toast.success('⏹️ P2P network disabled');
      }
      
      setSettings(prev => ({ ...prev, p2pEnabled: newValue }));
      updatePrivacyStatus();
      
    } catch (error) {
      console.error('P2P toggle error:', error);
      toast.error('Failed to toggle P2P network');
    }
  };

  // Advanced privacy configuration handlers
  const handleObfuscationFrequencyChange = async (frequency) => {
    try {
      await privacyConfigService.updateObfuscationSettings({ frequency });
      setPrivacyConfig(prev => ({
        ...prev,
        obfuscation: { ...prev.obfuscation, frequency }
      }));
      toast.success(`🎭 Obfuscation frequency set to ${frequency}`);
    } catch (error) {
      console.error('Failed to update obfuscation frequency:', error);
      toast.error('Failed to update obfuscation frequency');
    }
  };

  const handleP2PSettingsChange = async (settings) => {
    try {
      await privacyConfigService.updateP2PSettings(settings);
      setPrivacyConfig(prev => ({
        ...prev,
        p2p: { ...prev.p2p, ...settings }
      }));
      toast.success('🌐 P2P settings updated');
    } catch (error) {
      console.error('Failed to update P2P settings:', error);
      toast.error('Failed to update P2P settings');
    }
  };

  const handleSecurityLevelChange = async (securityLevel) => {
    try {
      await privacyConfigService.updateSecuritySettings({ securityLevel });
      setPrivacyConfig(prev => ({
        ...prev,
        security: { ...prev.security, securityLevel }
      }));
      toast.success(`🛡️ Security level set to ${securityLevel}`);
    } catch (error) {
      console.error('Failed to update security level:', error);
      toast.error('Failed to update security level');
    }
  };

  const handlePerformanceModeChange = async (batteryOptimization) => {
    try {
      await privacyConfigService.updatePerformanceSettings({ batteryOptimization });
      setPrivacyConfig(prev => ({
        ...prev,
        performance: { ...prev.performance, batteryOptimization }
      }));
      toast.success(`⚡ Performance mode set to ${batteryOptimization}`);
    } catch (error) {
      console.error('Failed to update performance mode:', error);
      toast.error('Failed to update performance mode');
    }
  };

  const privacyOptions = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'contacts', label: 'My Contacts' },
    { value: 'nobody', label: 'Nobody' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[rgb(10,14,39)] to-[rgb(30,36,80)] text-white">
      {/* Header */}
      <div className="glass border-b border-white/10">
        <div className="p-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 glass rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">Privacy</h1>
        </div>
      </div>

      {/* Settings Content */}
      <div className="p-6 space-y-6">
        {/* Who can see my info */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-400" />
            Who can see my info
          </h2>
          
          <div className="glass rounded-2xl p-4 space-y-4">
            {/* Last Seen */}
            <div>
              <label className="flex items-center justify-between mb-2">
                <span className="font-medium">Last Seen</span>
                <Info className="w-4 h-4 text-white/50" />
              </label>
              <select
                value={settings.lastSeen}
                onChange={(e) => handleSettingChange('lastSeen', e.target.value)}
                className="w-full p-3 glass rounded-xl text-white"
              >
                {privacyOptions.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-gray-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Profile Photo */}
            <div>
              <label className="flex items-center justify-between mb-2">
                <span className="font-medium">Profile Photo</span>
                <UserCheck className="w-4 h-4 text-white/50" />
              </label>
              <select
                value={settings.profilePhoto}
                onChange={(e) => handleSettingChange('profilePhoto', e.target.value)}
                className="w-full p-3 glass rounded-xl text-white"
              >
                {privacyOptions.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-gray-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* About */}
            <div>
              <label className="flex items-center justify-between mb-2">
                <span className="font-medium">About</span>
                <Info className="w-4 h-4 text-white/50" />
              </label>
              <select
                value={settings.about}
                onChange={(e) => handleSettingChange('about', e.target.value)}
                className="w-full p-3 glass rounded-xl text-white"
              >
                {privacyOptions.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-gray-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Communication Settings */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Phone className="w-5 h-5 text-purple-400" />
            Communication
          </h2>
          
          <div className="glass rounded-2xl">
            {/* Read Receipts */}
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <div>
                <h3 className="font-medium">Read Receipts</h3>
                <p className="text-sm text-white/60">Show when you've read messages</p>
              </div>
              <button
                onClick={() => handleSettingChange('readReceipts', !settings.readReceipts)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.readReceipts ? 'bg-purple-500' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.readReceipts ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Typing Indicators */}
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <div>
                <h3 className="font-medium">Typing Indicators</h3>
                <p className="text-sm text-white/60">Show when you're typing</p>
              </div>
              <button
                onClick={() => handleSettingChange('typing', !settings.typing)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.typing ? 'bg-purple-500' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.typing ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Online Status */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium">Online Status</h3>
                <p className="text-sm text-white/60">Show when you're online</p>
              </div>
              <button
                onClick={() => handleSettingChange('onlineStatus', !settings.onlineStatus)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.onlineStatus ? 'bg-purple-500' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.onlineStatus ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* СОРМ PROTECTION */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="w-5 h-5 text-red-400" />
            СОРМ Protection (Anti-Surveillance)
          </h2>
          
          <div className="glass rounded-2xl border border-red-500/20">
            {/* Privacy Mode */}
            <div className="p-4 flex items-center justify-between border-b border-white/5">
              <div>
                <h3 className="font-medium text-red-400">Privacy Mode</h3>
                <p className="text-sm text-white/60">Traffic obfuscation with dummy packets</p>
                <div className="text-xs text-white/40 mt-1">
                  Status: {privacyStatus.privacyMode ? '🔒 Active' : '🔓 Disabled'} 
                  {privacyStatus.connectedPeers > 0 && ` | ${privacyStatus.connectedPeers} peers`}
                </div>
              </div>
              <button
                onClick={handlePrivacyModeToggle}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.privacyMode ? 'bg-red-500' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.privacyMode ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* P2P Network */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium">P2P Network</h3>
                <p className="text-sm text-white/60">Decentralized mesh communication</p>
                <div className="text-xs text-white/40 mt-1">
                  Status: {privacyStatus.p2pConnected ? '🌐 Connected' : '⏹️ Offline'}
                  {privacyStatus.serverConnected && ' | Server: ✅'}
                </div>
              </div>
              <button
                onClick={handleP2PToggle}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.p2pEnabled ? 'bg-purple-500' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.p2pEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>

          {/* Protection Status */}
          <div className="glass rounded-xl p-3 text-sm">
            <div className="flex items-center gap-2 text-white/60">
              <Shield className="w-4 h-4" />
              <span>Legal compliance: Metadata protection only, content remains accessible for KYC/AML</span>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            General Security
          </h2>
          
          <div className="glass rounded-2xl">
            {/* Block Unknown */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium">Block Unknown Contacts</h3>
                <p className="text-sm text-white/60">Only receive messages from contacts</p>
              </div>
              <button
                onClick={() => handleSettingChange('blockUnknown', !settings.blockUnknown)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.blockUnknown ? 'bg-purple-500' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.blockUnknown ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Blocked Users */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-red-400" />
            Blocked Users ({blockedUsers.length})
          </h2>
          
          {blockedUsers.length > 0 ? (
            <div className="glass rounded-2xl">
              {blockedUsers.map((item, index) => (
                <div
                  key={item.blocked_user.id}
                  className={`p-4 flex items-center justify-between ${
                    index < blockedUsers.length - 1 ? 'border-b border-white/5' : ''
                  }`}
                >
                  <div>
                    <h3 className="font-medium">{item.blocked_user.nickname}</h3>
                    <p className="text-sm text-white/60">{item.blocked_user.phone}</p>
                  </div>
                  <button className="text-sm text-red-400 hover:text-red-300">
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-white/60">No blocked users</p>
            </div>
          )}
        </div>

        {/* Advanced Privacy Controls */}
        {privacyConfig && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                Advanced Privacy Controls
              </h2>
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                {showAdvancedSettings ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {showAdvancedSettings && (
              <div className="space-y-6">
                {/* Traffic Obfuscation Settings */}
                <div className="glass rounded-2xl p-4 space-y-4">
                  <h3 className="font-semibold text-purple-400 flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Traffic Obfuscation
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Frequency</label>
                    <select
                      value={privacyConfig.obfuscation.frequency}
                      onChange={(e) => handleObfuscationFrequencyChange(e.target.value)}
                      className="w-full p-3 glass rounded-xl text-white"
                    >
                      <option value="low" className="bg-gray-900">Low (1-3 min intervals)</option>
                      <option value="medium" className="bg-gray-900">Medium (15-45 sec intervals)</option>
                      <option value="high" className="bg-gray-900">High (5-20 sec intervals)</option>
                      <option value="custom" className="bg-gray-900">Custom</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Adaptive Mode</span>
                      <button
                        onClick={() => privacyConfigService.updateObfuscationSettings({ 
                          adaptiveMode: !privacyConfig.obfuscation.adaptiveMode 
                        }).then(() => loadPrivacyConfig())}
                        className={`w-8 h-4 rounded-full ${privacyConfig.obfuscation.adaptiveMode ? 'bg-purple-500' : 'bg-white/20'}`}
                      >
                        <div className={`w-3 h-3 bg-white rounded-full m-0.5 transition-transform ${privacyConfig.obfuscation.adaptiveMode ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Burst Mode</span>
                      <button
                        onClick={() => privacyConfigService.updateObfuscationSettings({ 
                          burstMode: !privacyConfig.obfuscation.burstMode 
                        }).then(() => loadPrivacyConfig())}
                        className={`w-8 h-4 rounded-full ${privacyConfig.obfuscation.burstMode ? 'bg-purple-500' : 'bg-white/20'}`}
                      >
                        <div className={`w-3 h-3 bg-white rounded-full m-0.5 transition-transform ${privacyConfig.obfuscation.burstMode ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* P2P Network Settings */}
                <div className="glass rounded-2xl p-4 space-y-4">
                  <h3 className="font-semibold text-blue-400 flex items-center gap-2">
                    <Server className="w-4 h-4" />
                    P2P Network Configuration
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Max Peers</label>
                      <input
                        type="number"
                        min="3"
                        max="50"
                        value={privacyConfig.p2p.maxPeers}
                        onChange={(e) => handleP2PSettingsChange({ maxPeers: parseInt(e.target.value) })}
                        className="w-full p-3 glass rounded-xl text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Min Peers</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={privacyConfig.p2p.minPeers}
                        onChange={(e) => handleP2PSettingsChange({ minPeers: parseInt(e.target.value) })}
                        className="w-full p-3 glass rounded-xl text-white"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Discovery Mode</label>
                    <select
                      value={privacyConfig.p2p.discoveryMode}
                      onChange={(e) => handleP2PSettingsChange({ discoveryMode: e.target.value })}
                      className="w-full p-3 glass rounded-xl text-white"
                    >
                      <option value="conservative" className="bg-gray-900">Conservative (lower bandwidth)</option>
                      <option value="balanced" className="bg-gray-900">Balanced (recommended)</option>
                      <option value="aggressive" className="bg-gray-900">Aggressive (more peers)</option>
                    </select>
                  </div>
                </div>

                {/* Geographic Settings */}
                <div className="glass rounded-2xl p-4 space-y-4">
                  <h3 className="font-semibold text-green-400 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Geographic Preferences
                  </h3>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">Auto-select Region</span>
                      <p className="text-sm text-white/60">Let system choose optimal region</p>
                    </div>
                    <button
                      onClick={() => privacyConfigService.updateGeographicSettings({ 
                        autoSelectRegion: !privacyConfig.geographic.autoSelectRegion 
                      }).then(() => loadPrivacyConfig())}
                      className={`w-8 h-4 rounded-full ${privacyConfig.geographic.autoSelectRegion ? 'bg-green-500' : 'bg-white/20'}`}
                    >
                      <div className={`w-3 h-3 bg-white rounded-full m-0.5 transition-transform ${privacyConfig.geographic.autoSelectRegion ? 'translate-x-4' : ''}`} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Prefer Low Latency</span>
                      <button
                        onClick={() => privacyConfigService.updateGeographicSettings({ 
                          preferLowLatency: !privacyConfig.geographic.preferLowLatency 
                        }).then(() => loadPrivacyConfig())}
                        className={`w-8 h-4 rounded-full ${privacyConfig.geographic.preferLowLatency ? 'bg-green-500' : 'bg-white/20'}`}
                      >
                        <div className={`w-3 h-3 bg-white rounded-full m-0.5 transition-transform ${privacyConfig.geographic.preferLowLatency ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Prefer High Throughput</span>
                      <button
                        onClick={() => privacyConfigService.updateGeographicSettings({ 
                          preferHighThroughput: !privacyConfig.geographic.preferHighThroughput 
                        }).then(() => loadPrivacyConfig())}
                        className={`w-8 h-4 rounded-full ${privacyConfig.geographic.preferHighThroughput ? 'bg-green-500' : 'bg-white/20'}`}
                      >
                        <div className={`w-3 h-3 bg-white rounded-full m-0.5 transition-transform ${privacyConfig.geographic.preferHighThroughput ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Performance & Security */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Performance Settings */}
                  <div className="glass rounded-2xl p-4 space-y-4">
                    <h3 className="font-semibold text-yellow-400 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Performance
                    </h3>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Battery Optimization</label>
                      <select
                        value={privacyConfig.performance.batteryOptimization}
                        onChange={(e) => handlePerformanceModeChange(e.target.value)}
                        className="w-full p-3 glass rounded-xl text-white"
                      >
                        <option value="performance" className="bg-gray-900">Performance</option>
                        <option value="balanced" className="bg-gray-900">Balanced</option>
                        <option value="power_saver" className="bg-gray-900">Power Saver</option>
                      </select>
                    </div>
                  </div>

                  {/* Security Level */}
                  <div className="glass rounded-2xl p-4 space-y-4">
                    <h3 className="font-semibold text-red-400 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Security Level
                    </h3>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Protection Level</label>
                      <select
                        value={privacyConfig.security.securityLevel}
                        onChange={(e) => handleSecurityLevelChange(e.target.value)}
                        className="w-full p-3 glass rounded-xl text-white"
                      >
                        <option value="medium" className="bg-gray-900">Medium</option>
                        <option value="high" className="bg-gray-900">High (recommended)</option>
                        <option value="maximum" className="bg-gray-900">Maximum</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Privacy Metrics Dashboard */}
                {privacyMetrics && (
                  <div className="glass rounded-2xl p-4 space-y-4">
                    <h3 className="font-semibold text-cyan-400 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Privacy Metrics
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-green-400">{privacyMetrics.securityScore}</div>
                        <div className="text-xs text-white/60">Security Score</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-400">{privacyMetrics.performanceScore}</div>
                        <div className="text-xs text-white/60">Performance Score</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-400">{privacyMetrics.p2pStatus?.connectedPeers || 0}</div>
                        <div className="text-xs text-white/60">Connected Peers</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-yellow-400">
                          {privacyMetrics.p2pStatus?.obfuscation?.metrics?.realMessagesPerMinute || 0}
                        </div>
                        <div className="text-xs text-white/60">Msgs/Min</div>
                      </div>
                    </div>
                    
                    {privacyMetrics.recommendations?.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-white/80">Recommendations:</h4>
                        {privacyMetrics.recommendations.slice(0, 2).map((rec, index) => (
                          <div key={index} className="text-xs text-white/60 bg-white/5 rounded-lg p-2">
                            💡 {rec.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={saveSettings}
          disabled={isSaving || isLoading}
          className="w-full btn-quantum py-3 font-semibold disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default PrivacySettings; 