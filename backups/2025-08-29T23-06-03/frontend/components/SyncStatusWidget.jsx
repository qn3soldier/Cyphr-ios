/**
 * Sync Status Widget Component
 * Displays real-time IPFS sync status and notifications
 * Part of cross-device security features
 */

import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Smartphone, 
  Monitor,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ipfsSyncNotificationService } from '@/api/ipfsSyncNotificationService';
import { ipfsService } from '@/api/ipfsService';

const SyncStatusWidget = ({ compact = true, className = '' }) => {
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncHistory, setSyncHistory] = useState([]);
  const [pendingConflicts, setPendingConflicts] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  useEffect(() => {
    // Initialize sync service
    initializeSyncService();
    
    // Set up sync event listener
    ipfsSyncNotificationService.onSyncEvent('sync-widget', handleSyncEvent);
    
    // Update status every 5 seconds
    const interval = setInterval(updateSyncStatus, 5000);
    
    return () => {
      clearInterval(interval);
      ipfsSyncNotificationService.offSyncEvent('sync-widget');
    };
  }, []);

  const initializeSyncService = async () => {
    try {
      // TODO: Re-enable IPFS sync after fixing core app issues
      // await ipfsSyncNotificationService.initialize();
      // updateSyncStatus();
      console.log('📴 IPFS sync temporarily disabled');
    } catch (error) {
      console.error('❌ Sync service initialization failed:', error);
    }
  };

  const updateSyncStatus = () => {
    try {
      const status = ipfsSyncNotificationService.getSyncStatus();
      const history = ipfsSyncNotificationService.getSyncHistory(5);
      const conflicts = ipfsSyncNotificationService.getPendingConflicts();
      
      setSyncStatus(status);
      setSyncHistory(history);
      setPendingConflicts(conflicts);
      
      if (status.lastSyncTimestamp) {
        setLastSyncTime(new Date(status.lastSyncTimestamp));
      }
    } catch (error) {
      console.error('❌ Sync status update failed:', error);
    }
  };

  const handleSyncEvent = (event) => {
    console.log('🔄 Sync event received:', event);
    updateSyncStatus();
    
    // Show appropriate notification
    if (event.type === 'wallet_sync') {
      toast.success('Wallet synced', {
        description: `Updated from device ${event.deviceId?.substring(0, 8)}...`,
        duration: 3000
      });
    }
  };

  const handleForceSyncCheck = async () => {
    try {
      await ipfsSyncNotificationService.forceSyncCheck();
      updateSyncStatus();
    } catch (error) {
      toast.error('Sync check failed');
    }
  };

  const handleResolveConflict = async (conflictId, resolution) => {
    try {
      await ipfsSyncNotificationService.resolveConflict(conflictId, resolution);
      updateSyncStatus();
    } catch (error) {
      toast.error('Failed to resolve conflict');
    }
  };

  const getSyncStatusIcon = () => {
    if (!syncStatus) return <WifiOff className="w-4 h-4 text-gray-400" />;
    
    if (pendingConflicts.length > 0) {
      return <AlertTriangle className="w-4 h-4 text-yellow-500 animate-pulse" />;
    }
    
    if (syncStatus.isMonitoring) {
      return <Wifi className="w-4 h-4 text-green-500" />;
    }
    
    return <WifiOff className="w-4 h-4 text-gray-400" />;
  };

  const getSyncStatusText = () => {
    if (!syncStatus) return 'Sync disabled';
    
    if (pendingConflicts.length > 0) {
      return `${pendingConflicts.length} conflict${pendingConflicts.length > 1 ? 's' : ''}`;
    }
    
    if (syncStatus.isMonitoring) {
      return lastSyncTime ? `Last sync: ${lastSyncTime.toLocaleTimeString()}` : 'Monitoring';
    }
    
    return 'Sync disabled';
  };

  const getDeviceIcon = (deviceId) => {
    // Simple heuristic to determine device type based on device ID pattern
    if (deviceId?.includes('mobile') || Math.random() > 0.5) {
      return <Smartphone className="w-3 h-3" />;
    }
    return <Monitor className="w-3 h-3" />;
  };

  if (compact && !isExpanded) {
    return (
      <motion.div 
        className={`glass rounded-lg p-2 flex items-center gap-2 cursor-pointer ${className}`}
        onClick={() => setIsExpanded(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {getSyncStatusIcon()}
        <span className="text-sm text-white/80">{getSyncStatusText()}</span>
        {pendingConflicts.length > 0 && (
          <span className="bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-medium">
            {pendingConflicts.length}
          </span>
        )}
        <ChevronDown className="w-3 h-3 text-white/60" />
      </motion.div>
    );
  }

  return (
    <motion.div 
      className={`glass rounded-2xl p-4 space-y-4 ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getSyncStatusIcon()}
          <h3 className="font-semibold text-white">Sync Status</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleForceSyncCheck}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            title="Force sync check"
          >
            <RefreshCw className="w-4 h-4 text-white/60" />
          </button>
          {compact && (
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ChevronUp className="w-4 h-4 text-white/60" />
            </button>
          )}
        </div>
      </div>

      {/* Sync Status Details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-white/60">Monitoring</div>
          <div className="font-medium">
            {syncStatus?.isMonitoring ? (
              <span className="text-green-400">Active</span>
            ) : (
              <span className="text-gray-400">Inactive</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-white/60">Device</div>
          <div className="font-medium text-blue-400">
            {syncStatus?.deviceFingerprint || 'Unknown'}
          </div>
        </div>
        <div>
          <div className="text-white/60">Listeners</div>
          <div className="font-medium">{syncStatus?.activeListeners || 0}</div>
        </div>
        <div>
          <div className="text-white/60">Last Sync</div>
          <div className="font-medium">
            {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Never'}
          </div>
        </div>
      </div>

      {/* Pending Conflicts */}
      <AnimatePresence>
        {pendingConflicts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <h4 className="text-sm font-medium text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Sync Conflicts ({pendingConflicts.length})
            </h4>
            
            {pendingConflicts.map((conflict) => (
              <div key={conflict.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div className="font-medium text-yellow-400">{conflict.reason.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-white/60">Detected: {conflict.detectedAt}</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {getDeviceIcon(conflict.localDevice)}
                    <span className="text-white/60">vs</span>
                    {getDeviceIcon(conflict.remoteDevice)}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResolveConflict(conflict.id, 'use_remote')}
                    className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs py-1 px-2 rounded transition-colors"
                  >
                    Use Remote
                  </button>
                  <button
                    onClick={() => handleResolveConflict(conflict.id, 'keep_local')}
                    className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs py-1 px-2 rounded transition-colors"
                  >
                    Keep Local
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Sync History */}
      {syncHistory.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white/80">Recent Syncs</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {syncHistory.map((sync, index) => (
              <div key={index} className="flex items-center gap-2 text-xs bg-white/5 rounded-lg p-2">
                <div className="flex items-center gap-1">
                  {getDeviceIcon(sync.deviceId)}
                  <span className="text-white/60">{sync.deviceId}</span>
                </div>
                <div className="flex-1 text-center">
                  {sync.status === 'processed' ? (
                    <CheckCircle className="w-3 h-3 text-green-400 mx-auto" />
                  ) : (
                    <Clock className="w-3 h-3 text-yellow-400 mx-auto" />
                  )}
                </div>
                <div className="text-white/60">{sync.timestamp}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IPFS Status */}
      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60">IPFS Status</span>
          <span className={ipfsService.getStatus().isInitialized ? 'text-green-400' : 'text-red-400'}>
            {ipfsService.getStatus().isInitialized ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60">Peers</span>
          <span className="text-white/80">{ipfsService.getStatus().peers}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default SyncStatusWidget;