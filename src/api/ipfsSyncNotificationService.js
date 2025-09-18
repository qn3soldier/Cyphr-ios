/**
 * IPFS Sync Notification Service
 * Handles real-time notifications for wallet sync events and conflict resolution
 * Part of Cyphr's cross-device security features
 */

import { ipfsService } from './ipfsService.js';
import { toast } from 'sonner';
import { zeroKnowledgeAuth } from './authService.js';

class IPFSSyncNotificationService {
  constructor() {
    this.syncListeners = new Map();
    this.syncHistory = [];
    this.conflictQueue = [];
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.deviceFingerprint = null;
    this.lastSyncTimestamp = null;
  }

  /**
   * Initialize sync notification service
   */
  async initialize() {
    if (this.isMonitoring) return true;

    try {
      // TODO: Re-enable IPFS sync after fixing core app issues
      console.log('📴 IPFS sync notifications temporarily disabled');
      
      // // Generate device fingerprint
      // await this.generateDeviceFingerprint();
      
      // // Start monitoring for sync events
      // this.startSyncMonitoring();
      
      console.log('📴 IPFS sync notifications disabled');
      return false; // Return false to indicate disabled
    } catch (error) {
      console.error('❌ Sync notification init failed:', error);
      return false;
    }
  }

  /**
   * Generate device fingerprint for conflict resolution
   */
  async generateDeviceFingerprint() {
    try {
      const fingerprint = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `${screen.width}x${screen.height}`,
        timestamp: Date.now(),
        deviceId: await this.getOrCreateDeviceId()
      };

      // Create hash of fingerprint
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(fingerprint));
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      
      this.deviceFingerprint = {
        ...fingerprint,
        hash: hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      };

      console.log('🔑 Device fingerprint generated:', this.deviceFingerprint.hash.substring(0, 8) + '...');
    } catch (error) {
      console.error('❌ Device fingerprint generation failed:', error);
      // Fallback fingerprint
      this.deviceFingerprint = {
        deviceId: 'unknown-' + Date.now(),
        hash: 'fallback-' + Math.random().toString(36).substring(2),
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get or create persistent device ID
   */
  async getOrCreateDeviceId() {
    try {
      let deviceId = localStorage.getItem('cyphr_device_id');
      
      if (!deviceId) {
        // Generate new device ID
        const randomBytes = crypto.getRandomValues(new Uint8Array(16));
        deviceId = Array.from(randomBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        localStorage.setItem('cyphr_device_id', deviceId);
      }
      
      return deviceId;
    } catch (error) {
      console.error('❌ Device ID generation failed:', error);
      return 'fallback-' + Date.now();
    }
  }

  /**
   * Start monitoring for sync events
   */
  startSyncMonitoring() {
    if (this.monitoringInterval) return;

    this.isMonitoring = true;
    
    // Check for sync events every 10 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.checkForSyncEvents();
    }, 10000);

    console.log('👀 Started IPFS sync monitoring');
  }

  /**
   * Stop sync monitoring
   */
  stopSyncMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    console.log('⏹️ Stopped IPFS sync monitoring');
  }

  /**
   * Check for new sync events
   */
  async checkForSyncEvents() {
    try {
      const user = zeroKnowledgeAuth.getUser();
      if (!user?.id) return;

      // Get IPFS status to check for new content
      const ipfsStatus = ipfsService.getStatus();
      if (!ipfsStatus.isInitialized) return;

      // Check for new wallet backups
      await this.checkForWalletSyncEvents(user.id);
      
      // Process any queued conflicts
      await this.processConflictQueue();

    } catch (error) {
      console.error('❌ Sync event check failed:', error);
    }
  }

  /**
   * Check for wallet sync events
   */
  async checkForWalletSyncEvents(userId) {
    try {
      // Get list of current backups
      const backups = await ipfsService.listBackups();
      
      for (const backup of backups) {
        if (backup.key === userId) {
          // Check if this is a new backup or updated backup
          const syncEvent = await this.detectSyncEvent(backup);
          
          if (syncEvent) {
            await this.handleSyncEvent(syncEvent);
          }
        }
      }
    } catch (error) {
      console.error('❌ Wallet sync check failed:', error);
    }
  }

  /**
   * Detect if a backup represents a sync event
   */
  async detectSyncEvent(backup) {
    try {
      // Try to retrieve metadata about the backup
      const result = await ipfsService.retrieveWalletSeed(backup.key, backup.cid);
      
      if (!result.success) return null;

      const metadata = result.metadata || {};
      const backupTimestamp = metadata.timestamp || 0;
      const deviceId = metadata.deviceId || 'unknown';
      
      // Check if this is from a different device
      const isFromDifferentDevice = deviceId !== this.deviceFingerprint.deviceId;
      
      // Check if this is newer than our last known sync
      const isNewer = !this.lastSyncTimestamp || backupTimestamp > this.lastSyncTimestamp;
      
      if (isFromDifferentDevice && isNewer) {
        return {
          type: 'wallet_sync',
          backup,
          metadata,
          isFromDifferentDevice,
          isNewer,
          deviceId,
          timestamp: backupTimestamp
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Sync event detection failed:', error);
      return null;
    }
  }

  /**
   * Handle a detected sync event
   */
  async handleSyncEvent(syncEvent) {
    try {
      console.log('🔄 Detected sync event:', syncEvent);
      
      // Add to sync history
      this.syncHistory.push({
        ...syncEvent,
        processedAt: Date.now(),
        status: 'detected'
      });

      // Check for conflicts
      const conflict = await this.checkForConflict(syncEvent);
      
      if (conflict) {
        await this.handleSyncConflict(conflict);
      } else {
        await this.handleNormalSync(syncEvent);
      }

      // Update last sync timestamp
      this.lastSyncTimestamp = syncEvent.timestamp;
      
      // Notify listeners
      this.notifySyncListeners(syncEvent);

    } catch (error) {
      console.error('❌ Sync event handling failed:', error);
    }
  }

  /**
   * Check for sync conflicts
   */
  async checkForConflict(syncEvent) {
    try {
      // Get current local wallet state
      const localState = await this.getCurrentLocalWalletState();
      
      if (!localState) return null;

      // Check if local state is newer than incoming sync
      const isLocalNewer = localState.timestamp > syncEvent.timestamp;
      
      // Check if local state has been modified since last sync
      const hasLocalChanges = !this.lastSyncTimestamp || localState.timestamp > this.lastSyncTimestamp;
      
      if (isLocalNewer && hasLocalChanges) {
        return {
          type: 'sync_conflict',
          localState,
          remoteState: syncEvent,
          reason: 'both_devices_modified',
          severity: 'medium'
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Conflict detection failed:', error);
      return null;
    }
  }

  /**
   * Get current local wallet state for conflict detection
   */
  async getCurrentLocalWalletState() {
    try {
      // This would typically get the current wallet state from local storage
      // For now, return a mock state
      const lastModified = localStorage.getItem('wallet_last_modified');
      
      return {
        timestamp: lastModified ? parseInt(lastModified) : Date.now(),
        deviceId: this.deviceFingerprint.deviceId,
        hasLocalChanges: true
      };
    } catch (error) {
      console.error('❌ Local wallet state check failed:', error);
      return null;
    }
  }

  /**
   * Handle sync conflict with user interaction
   */
  async handleSyncConflict(conflict) {
    try {
      console.log('⚠️ Sync conflict detected:', conflict);
      
      // Add to conflict queue for user resolution
      this.conflictQueue.push({
        ...conflict,
        id: Date.now().toString(),
        status: 'pending_resolution',
        detectedAt: Date.now()
      });

      // Show notification to user
      toast.error('Sync conflict detected', {
        description: 'Multiple devices have made changes. Please resolve the conflict.',
        action: {
          label: 'Resolve',
          onClick: () => this.showConflictResolutionUI(conflict)
        },
        duration: 10000
      });

      return conflict;
    } catch (error) {
      console.error('❌ Conflict handling failed:', error);
    }
  }

  /**
   * Handle normal sync (no conflicts)
   */
  async handleNormalSync(syncEvent) {
    try {
      console.log('✅ Processing normal sync:', syncEvent);
      
      // Show success notification
      toast.success('Wallet synced', {
        description: `Updated from device ${syncEvent.deviceId.substring(0, 8)}...`,
        duration: 3000
      });

      // Mark sync as processed
      const historyItem = this.syncHistory.find(item => 
        item.backup.cid === syncEvent.backup.cid
      );
      
      if (historyItem) {
        historyItem.status = 'processed';
      }

      return true;
    } catch (error) {
      console.error('❌ Normal sync handling failed:', error);
      return false;
    }
  }

  /**
   * Show conflict resolution UI
   */
  showConflictResolutionUI(conflict) {
    // This would typically navigate to a conflict resolution page
    // For now, just show options in toast
    toast.info('Conflict Resolution Options', {
      description: 'Choose how to resolve the sync conflict',
      action: {
        label: 'Use Remote',
        onClick: () => this.resolveConflict(conflict.id, 'use_remote')
      },
      duration: 15000
    });

    // Additional option
    setTimeout(() => {
      toast.info('Alternative Option', {
        description: 'Keep local changes and ignore remote',
        action: {
          label: 'Keep Local',
          onClick: () => this.resolveConflict(conflict.id, 'keep_local')
        },
        duration: 15000
      });
    }, 1000);
  }

  /**
   * Resolve a sync conflict
   */
  async resolveConflict(conflictId, resolution) {
    try {
      const conflict = this.conflictQueue.find(c => c.id === conflictId);
      if (!conflict) return false;

      console.log(`🔧 Resolving conflict ${conflictId} with strategy: ${resolution}`);

      switch (resolution) {
        case 'use_remote':
          await this.applyRemoteChanges(conflict);
          break;
          
        case 'keep_local':
          await this.keepLocalChanges(conflict);
          break;
          
        case 'merge':
          await this.mergeChanges(conflict);
          break;
          
        default:
          throw new Error(`Unknown resolution strategy: ${resolution}`);
      }

      // Remove from conflict queue
      this.conflictQueue = this.conflictQueue.filter(c => c.id !== conflictId);
      
      // Update sync history
      const historyItem = this.syncHistory.find(item => 
        item.backup.cid === conflict.remoteState.backup.cid
      );
      
      if (historyItem) {
        historyItem.status = 'resolved';
        historyItem.resolution = resolution;
      }

      toast.success('Conflict resolved', {
        description: `Applied ${resolution} strategy`,
        duration: 3000
      });

      return true;
    } catch (error) {
      console.error('❌ Conflict resolution failed:', error);
      toast.error('Failed to resolve conflict');
      return false;
    }
  }

  /**
   * Apply remote changes (overwrite local)
   */
  async applyRemoteChanges(conflict) {
    console.log('📥 Applying remote changes...');
    // Implementation would update local wallet with remote state
    this.lastSyncTimestamp = conflict.remoteState.timestamp;
  }

  /**
   * Keep local changes (ignore remote)
   */
  async keepLocalChanges(conflict) {
    console.log('📤 Keeping local changes...');
    // Implementation would create new backup with local state
    // and update the IPFS entry
  }

  /**
   * Merge changes (attempt automatic merge)
   */
  async mergeChanges(conflict) {
    console.log('🔀 Attempting to merge changes...');
    // Implementation would attempt to merge both states
    // This is complex and depends on the specific data structure
  }

  /**
   * Process conflict queue
   */
  async processConflictQueue() {
    // Remove old unresolved conflicts (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.conflictQueue = this.conflictQueue.filter(conflict => 
      conflict.detectedAt > oneHourAgo
    );
  }

  /**
   * Register sync event listener
   */
  onSyncEvent(id, callback) {
    this.syncListeners.set(id, callback);
    console.log(`📡 Registered sync listener: ${id}`);
  }

  /**
   * Unregister sync event listener
   */
  offSyncEvent(id) {
    this.syncListeners.delete(id);
    console.log(`📡 Unregistered sync listener: ${id}`);
  }

  /**
   * Notify all sync listeners
   */
  notifySyncListeners(event) {
    for (const [id, callback] of this.syncListeners.entries()) {
      try {
        callback(event);
      } catch (error) {
        console.error(`❌ Sync listener ${id} failed:`, error);
      }
    }
  }

  /**
   * Get sync status and statistics
   */
  getSyncStatus() {
    return {
      isMonitoring: this.isMonitoring,
      deviceFingerprint: this.deviceFingerprint?.hash?.substring(0, 8) + '...',
      lastSyncTimestamp: this.lastSyncTimestamp,
      syncHistoryCount: this.syncHistory.length,
      pendingConflicts: this.conflictQueue.length,
      activeListeners: this.syncListeners.size
    };
  }

  /**
   * Get sync history
   */
  getSyncHistory(limit = 10) {
    return this.syncHistory
      .slice(-limit)
      .reverse()
      .map(item => ({
        ...item,
        deviceId: item.deviceId?.substring(0, 8) + '...',
        timestamp: new Date(item.timestamp).toLocaleString()
      }));
  }

  /**
   * Get pending conflicts
   */
  getPendingConflicts() {
    return this.conflictQueue.map(conflict => ({
      ...conflict,
      detectedAt: new Date(conflict.detectedAt).toLocaleString(),
      localDevice: conflict.localState?.deviceId?.substring(0, 8) + '...',
      remoteDevice: conflict.remoteState?.deviceId?.substring(0, 8) + '...'
    }));
  }

  /**
   * Force sync check
   */
  async forceSyncCheck() {
    console.log('🔄 Forcing sync check...');
    await this.checkForSyncEvents();
    toast.info('Sync check completed');
  }

  /**
   * Clear sync history
   */
  clearSyncHistory() {
    this.syncHistory = [];
    console.log('🗑️ Sync history cleared');
  }
}

// Create singleton instance
export const ipfsSyncNotificationService = new IPFSSyncNotificationService();
export default ipfsSyncNotificationService;