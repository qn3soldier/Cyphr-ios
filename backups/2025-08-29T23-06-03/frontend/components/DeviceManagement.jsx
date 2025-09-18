/**
 * Device Management Component
 * Manages trusted devices, verification, and automatic backup settings
 */

import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Monitor, 
  Shield, 
  Clock, 
  Trash2, 
  Plus, 
  Settings,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { deviceSecurityService } from '@/api/deviceSecurityService';

const DeviceManagement = ({ className = '' }) => {
  const [trustedDevices, setTrustedDevices] = useState([]);
  const [securityStatus, setSecurityStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    initializeDeviceManagement();
  }, []);

  const initializeDeviceManagement = async () => {
    try {
      setIsLoading(true);
      await deviceSecurityService.initialize();
      updateDeviceData();
    } catch (error) {
      console.error('❌ Device management initialization failed:', error);
      toast.error('Failed to initialize device management');
    } finally {
      setIsLoading(false);
    }
  };

  const updateDeviceData = () => {
    try {
      const devices = deviceSecurityService.getTrustedDevices();
      const status = deviceSecurityService.getSecurityStatus();
      
      setTrustedDevices(devices);
      setSecurityStatus(status);
    } catch (error) {
      console.error('❌ Failed to update device data:', error);
    }
  };

  const handleRemoveDevice = async (deviceId) => {
    try {
      const success = await deviceSecurityService.removeTrustedDevice(deviceId);
      if (success) {
        updateDeviceData();
      }
    } catch (error) {
      console.error('❌ Failed to remove device:', error);
      toast.error('Failed to remove device');
    }
  };

  const handleVerifyCurrentDevice = async () => {
    try {
      const fingerprint = await deviceSecurityService.generateEnhancedDeviceFingerprint();
      const deviceName = `${navigator.platform} - ${new Date().toLocaleDateString()}`;
      
      const success = await deviceSecurityService.addTrustedDevice(fingerprint, deviceName);
      if (success) {
        updateDeviceData();
      }
    } catch (error) {
      console.error('❌ Failed to verify current device:', error);
      toast.error('Failed to verify current device');
    }
  };

  const handleUpdateSettings = (settings) => {
    try {
      deviceSecurityService.updateVerificationSettings(settings);
      updateDeviceData();
      toast.success('Settings updated successfully');
    } catch (error) {
      console.error('❌ Failed to update settings:', error);
      toast.error('Failed to update settings');
    }
  };

  const getDeviceIcon = (device) => {
    // Simple heuristic based on fingerprint data
    const platform = device.fingerprint?.platform?.toLowerCase() || '';
    
    if (platform.includes('mobile') || platform.includes('android') || platform.includes('iphone')) {
      return <Smartphone className="w-5 h-5" />;
    }
    
    return <Monitor className="w-5 h-5" />;
  };

  const getTrustScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBackupStatus = () => {
    if (!securityStatus?.lastBackupTime) {
      return { status: 'Never', color: 'text-red-400', icon: AlertTriangle };
    }
    
    const timeDiff = Date.now() - securityStatus.lastBackupTime;
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    if (hoursDiff < 1) {
      return { status: 'Recent', color: 'text-green-400', icon: CheckCircle };
    } else if (hoursDiff < 24) {
      return { status: `${Math.floor(hoursDiff)}h ago`, color: 'text-yellow-400', icon: Clock };
    } else {
      return { status: `${Math.floor(hoursDiff / 24)}d ago`, color: 'text-red-400', icon: AlertTriangle };
    }
  };

  if (isLoading) {
    return (
      <div className={`glass rounded-2xl p-6 ${className}`}>
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
          <span className="ml-2 text-white/80">Loading device management...</span>
        </div>
      </div>
    );
  }

  const backupStatus = getBackupStatus();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-400" />
            Device Security
          </h2>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 glass rounded-lg hover:bg-white/10 transition-colors"
          >
            <Settings className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Security Status Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {securityStatus?.trustedDevicesCount || 0}
            </div>
            <div className="text-xs text-white/60">Trusted Devices</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getTrustScoreColor(securityStatus?.deviceTrustScore || 0)}`}>
              {securityStatus?.deviceTrustScore || 0}
            </div>
            <div className="text-xs text-white/60">Trust Score</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${backupStatus.color}`}>
              <backupStatus.icon className="w-6 h-6 mx-auto" />
            </div>
            <div className="text-xs text-white/60">Backup Status</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${securityStatus?.verificationEnabled ? 'text-green-400' : 'text-gray-400'}`}>
              {securityStatus?.verificationEnabled ? '✓' : '✗'}
            </div>
            <div className="text-xs text-white/60">Verification</div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-2xl p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Security Settings</h3>
            
            <div className="space-y-4">
              {/* Device Verification Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">Device Verification</div>
                  <div className="text-sm text-white/60">Require verification for new devices</div>
                </div>
                <button
                  onClick={() => handleUpdateSettings({ 
                    verificationEnabled: !securityStatus.verificationEnabled 
                  })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    securityStatus?.verificationEnabled ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    securityStatus?.verificationEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Auto Backup Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">Automatic Backup</div>
                  <div className="text-sm text-white/60">Backup wallet data automatically</div>
                </div>
                <button
                  onClick={() => handleUpdateSettings({ 
                    autoBackupEnabled: !securityStatus.autoBackupEnabled 
                  })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    securityStatus?.autoBackupEnabled ? 'bg-green-500' : 'bg-white/20'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    securityStatus?.autoBackupEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Backup Interval */}
              {securityStatus?.autoBackupEnabled && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Backup Interval (hours)
                  </label>
                  <select
                    value={securityStatus.backupInterval / (1000 * 60 * 60)}
                    onChange={(e) => handleUpdateSettings({ 
                      backupInterval: parseInt(e.target.value) * 1000 * 60 * 60 
                    })}
                    className="w-full p-2 glass rounded-lg text-white"
                  >
                    <option value={1} className="bg-gray-900">1 hour</option>
                    <option value={6} className="bg-gray-900">6 hours</option>
                    <option value={12} className="bg-gray-900">12 hours</option>
                    <option value={24} className="bg-gray-900">24 hours</option>
                    <option value={72} className="bg-gray-900">3 days</option>
                  </select>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trusted Devices */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Trusted Devices</h3>
          <button
            onClick={handleVerifyCurrentDevice}
            className="flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Verify Current</span>
          </button>
        </div>

        {trustedDevices.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/60">No trusted devices yet</p>
            <p className="text-sm text-white/40">Verify your current device to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trustedDevices.map((device) => (
              <motion.div
                key={device.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="text-blue-400">
                    {getDeviceIcon(device)}
                  </div>
                  <div>
                    <div className="font-medium text-white">{device.name}</div>
                    <div className="text-sm text-white/60">
                      Added: {device.addedAt} • Last seen: {device.lastSeen}
                    </div>
                    <div className="text-xs text-white/40">
                      ID: {device.id} • Trust: {device.fingerprint?.trustScore}/100
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-sm ${getTrustScoreColor(device.fingerprint?.trustScore || 0)}`}>
                    {device.fingerprint?.trustScore || 0}%
                  </div>
                  <button
                    onClick={() => handleRemoveDevice(device.id)}
                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Remove device"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Backup Information */}
      {securityStatus?.autoBackupEnabled && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Backup Status</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-white/60">Last Backup</div>
              <div className={`font-medium ${backupStatus.color}`}>
                {backupStatus.status}
              </div>
            </div>
            <div>
              <div className="text-sm text-white/60">Next Backup</div>
              <div className="font-medium text-white">
                {securityStatus.nextBackupDue ? 
                  new Date(securityStatus.nextBackupDue).toLocaleString() : 
                  'Soon'
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceManagement;