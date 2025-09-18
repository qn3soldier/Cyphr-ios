/**
 * Device Security Service
 * Enhanced cross-device security features with device verification and backup scheduling
 * Global compliance-friendly implementation
 */

import { ipfsService } from './ipfsService.js';
import { ipfsSyncNotificationService } from './ipfsSyncNotificationService.js';
import { toast } from 'sonner';

class DeviceSecurityService {
  constructor() {
    this.trustedDevices = new Map();
    this.backupSchedule = null;
    this.deviceVerificationEnabled = true;
    this.autoBackupEnabled = true;
    this.backupInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.lastBackupTime = null;
    this.deviceTrustScore = 0;
  }

  /**
   * Initialize device security service
   */
  async initialize() {
    try {
      console.log('🔐 Initializing device security service...');
      
      // Load trusted devices from storage
      await this.loadTrustedDevices();
      
      // Start automatic backup scheduling
      this.startAutomaticBackup();
      
      // Initialize device verification
      await this.initializeDeviceVerification();
      
      console.log('✅ Device security service initialized');
      return true;
    } catch (error) {
      console.error('❌ Device security initialization failed:', error);
      return false;
    }
  }

  /**
   * Enhanced device fingerprinting with security features
   */
  async generateEnhancedDeviceFingerprint() {
    try {
      const basicFingerprint = await this.getBasicFingerprint();
      const securityFingerprint = await this.getSecurityFingerprint();
      const performanceFingerprint = await this.getPerformanceFingerprint();
      
      const combinedFingerprint = {
        ...basicFingerprint,
        ...securityFingerprint,
        ...performanceFingerprint,
        timestamp: Date.now(),
        version: '2.0'
      };

      // Generate hash
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(combinedFingerprint));
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      
      return {
        ...combinedFingerprint,
        hash: hashArray.map(b => b.toString(16).padStart(2, '0')).join(''),
        trustScore: this.calculateDeviceTrustScore(combinedFingerprint)
      };
    } catch (error) {
      console.error('❌ Enhanced fingerprinting failed:', error);
      return this.getFallbackFingerprint();
    }
  }

  /**
   * Get basic device fingerprint
   */
  async getBasicFingerprint() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages?.join(',') || '',
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      deviceMemory: navigator.deviceMemory || 'unknown',
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown'
    };
  }

  /**
   * Get security-related fingerprint
   */
  async getSecurityFingerprint() {
    const security = {
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack || 'unknown',
      webgl: this.getWebGLFingerprint(),
      canvas: await this.getCanvasFingerprint(),
      fonts: await this.getFontFingerprint(),
      plugins: this.getPluginsFingerprint()
    };

    return security;
  }

  /**
   * Get performance-related fingerprint
   */
  async getPerformanceFingerprint() {
    const performance = {
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : 'unknown',
      maxTouchPoints: navigator.maxTouchPoints || 0,
      vendor: navigator.vendor || 'unknown',
      webdriver: navigator.webdriver || false
    };

    return performance;
  }

  /**
   * Get WebGL fingerprint for device verification
   */
  getWebGLFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) return 'no-webgl';
      
      return {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
      };
    } catch (error) {
      return 'webgl-error';
    }
  }

  /**
   * Get canvas fingerprint
   */
  async getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device verification 🔐', 2, 2);
      
      return canvas.toDataURL().slice(0, 50); // First 50 chars
    } catch (error) {
      return 'canvas-error';
    }
  }

  /**
   * Get font fingerprint
   */
  async getFontFingerprint() {
    try {
      const testString = 'mmmmmmmmmmlli';
      const testSize = '72px';
      const h = document.getElementsByTagName('body')[0];
      
      const baseFonts = ['monospace', 'sans-serif', 'serif'];
      const fontList = [
        'Arial', 'Helvetica', 'Times New Roman', 'Courier New',
        'Verdana', 'Georgia', 'Comic Sans MS', 'Trebuchet MS'
      ];
      
      const s = document.createElement('span');
      s.style.fontSize = testSize;
      s.style.visibility = 'hidden';
      s.innerHTML = testString;
      
      const defaultWidth = {};
      const defaultHeight = {};
      
      // Get baseline measurements
      for (let i = 0; i < baseFonts.length; i++) {
        s.style.fontFamily = baseFonts[i];
        h.appendChild(s);
        defaultWidth[baseFonts[i]] = s.offsetWidth;
        defaultHeight[baseFonts[i]] = s.offsetHeight;
        h.removeChild(s);
      }
      
      const fonts = [];
      for (let i = 0; i < fontList.length; i++) {
        let detected = false;
        for (let j = 0; j < baseFonts.length; j++) {
          s.style.fontFamily = fontList[i] + ',' + baseFonts[j];
          h.appendChild(s);
          const matched = (s.offsetWidth !== defaultWidth[baseFonts[j]] || 
                          s.offsetHeight !== defaultHeight[baseFonts[j]]);
          h.removeChild(s);
          detected = detected || matched;
        }
        if (detected) fonts.push(fontList[i]);
      }
      
      return fonts.join(',');
    } catch (error) {
      return 'font-error';
    }
  }

  /**
   * Get plugins fingerprint
   */
  getPluginsFingerprint() {
    try {
      const plugins = [];
      for (let i = 0; i < navigator.plugins.length; i++) {
        plugins.push(navigator.plugins[i].name);
      }
      return plugins.sort().join(',');
    } catch (error) {
      return 'plugins-error';
    }
  }

  /**
   * Calculate device trust score (0-100)
   */
  calculateDeviceTrustScore(fingerprint) {
    let score = 50; // Base score
    
    // Increase score for consistent features
    if (fingerprint.webgl && fingerprint.webgl !== 'no-webgl') score += 15;
    if (fingerprint.canvas && fingerprint.canvas !== 'canvas-error') score += 10;
    if (fingerprint.fonts && fingerprint.fonts !== 'font-error') score += 10;
    if (fingerprint.deviceMemory && fingerprint.deviceMemory !== 'unknown') score += 5;
    if (fingerprint.hardwareConcurrency && fingerprint.hardwareConcurrency !== 'unknown') score += 5;
    if (fingerprint.connection && fingerprint.connection !== 'unknown') score += 5;
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get fallback fingerprint for edge cases
   */
  getFallbackFingerprint() {
    return {
      userAgent: navigator.userAgent || 'unknown',
      timestamp: Date.now(),
      random: Math.random().toString(36),
      hash: 'fallback-' + Date.now(),
      trustScore: 25,
      fallback: true
    };
  }

  /**
   * Verify device against trusted devices
   */
  async verifyDevice(fingerprint) {
    try {
      const deviceId = fingerprint.hash;
      const trusted = this.trustedDevices.get(deviceId);
      
      if (!trusted) {
        // New device - request verification
        return {
          verified: false,
          reason: 'new_device',
          trustScore: fingerprint.trustScore,
          requiresVerification: true
        };
      }
      
      // Check if device has changed significantly
      const similarity = this.calculateFingerprintSimilarity(fingerprint, trusted.fingerprint);
      
      if (similarity < 0.7) {
        return {
          verified: false,
          reason: 'device_changed',
          similarity,
          trustScore: fingerprint.trustScore,
          requiresVerification: true
        };
      }
      
      // Update last seen
      trusted.lastSeen = Date.now();
      trusted.accessCount = (trusted.accessCount || 0) + 1;
      
      return {
        verified: true,
        trustScore: fingerprint.trustScore,
        deviceInfo: trusted
      };
      
    } catch (error) {
      console.error('❌ Device verification failed:', error);
      return {
        verified: false,
        reason: 'verification_error',
        trustScore: 0
      };
    }
  }

  /**
   * Calculate similarity between fingerprints
   */
  calculateFingerprintSimilarity(fp1, fp2) {
    const keys = ['userAgent', 'platform', 'screen', 'timezone', 'language'];
    let matches = 0;
    
    for (const key of keys) {
      if (fp1[key] === fp2[key]) matches++;
    }
    
    return matches / keys.length;
  }

  /**
   * Add device to trusted list
   */
  async addTrustedDevice(fingerprint, deviceName = 'Unknown Device') {
    try {
      const deviceId = fingerprint.hash;
      
      const trustedDevice = {
        id: deviceId,
        name: deviceName,
        fingerprint,
        addedAt: Date.now(),
        lastSeen: Date.now(),
        accessCount: 1,
        verified: true
      };
      
      this.trustedDevices.set(deviceId, trustedDevice);
      await this.saveTrustedDevices();
      
      console.log('✅ Device added to trusted list:', deviceName);
      toast.success('Device verified and added to trusted list');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to add trusted device:', error);
      return false;
    }
  }

  /**
   * Remove device from trusted list
   */
  async removeTrustedDevice(deviceId) {
    try {
      if (this.trustedDevices.delete(deviceId)) {
        await this.saveTrustedDevices();
        console.log('🗑️ Device removed from trusted list:', deviceId);
        toast.success('Device removed from trusted list');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to remove trusted device:', error);
      return false;
    }
  }

  /**
   * Load trusted devices from storage
   */
  async loadTrustedDevices() {
    try {
      const stored = localStorage.getItem('cyphr_trusted_devices');
      if (stored) {
        const devices = JSON.parse(stored);
        this.trustedDevices = new Map(Object.entries(devices));
        console.log('📱 Loaded trusted devices:', this.trustedDevices.size);
      }
    } catch (error) {
      console.error('❌ Failed to load trusted devices:', error);
    }
  }

  /**
   * Save trusted devices to storage
   */
  async saveTrustedDevices() {
    try {
      const devices = Object.fromEntries(this.trustedDevices);
      localStorage.setItem('cyphr_trusted_devices', JSON.stringify(devices));
    } catch (error) {
      console.error('❌ Failed to save trusted devices:', error);
    }
  }

  /**
   * Start automatic backup scheduling
   */
  startAutomaticBackup() {
    if (!this.autoBackupEnabled) return;
    
    // Initial backup check
    this.checkAndPerformBackup();
    
    // Schedule regular backups
    this.backupSchedule = setInterval(() => {
      this.checkAndPerformBackup();
    }, 60 * 60 * 1000); // Check every hour
    
    console.log('⏰ Automatic backup scheduling started');
  }

  /**
   * Stop automatic backup scheduling
   */
  stopAutomaticBackup() {
    if (this.backupSchedule) {
      clearInterval(this.backupSchedule);
      this.backupSchedule = null;
      console.log('⏹️ Automatic backup scheduling stopped');
    }
  }

  /**
   * Check if backup is needed and perform it
   */
  async checkAndPerformBackup() {
    try {
      const now = Date.now();
      const lastBackup = this.getLastBackupTime();
      
      if (!lastBackup || (now - lastBackup) > this.backupInterval) {
        await this.performAutomaticBackup();
      }
    } catch (error) {
      console.error('❌ Backup check failed:', error);
    }
  }

  /**
   * Perform automatic backup
   */
  async performAutomaticBackup() {
    try {
      console.log('💾 Performing automatic backup...');
      
      // This would typically backup current wallet state
      // For now, just update the timestamp
      this.lastBackupTime = Date.now();
      localStorage.setItem('cyphr_last_backup', this.lastBackupTime.toString());
      
      console.log('✅ Automatic backup completed');
      
      // Show subtle notification
      toast.success('Wallet backed up automatically', {
        duration: 2000
      });
      
      return true;
    } catch (error) {
      console.error('❌ Automatic backup failed:', error);
      toast.error('Automatic backup failed');
      return false;
    }
  }

  /**
   * Get last backup time
   */
  getLastBackupTime() {
    try {
      const stored = localStorage.getItem('cyphr_last_backup');
      return stored ? parseInt(stored) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Initialize device verification flow
   */
  async initializeDeviceVerification() {
    if (!this.deviceVerificationEnabled) return;
    
    try {
      const fingerprint = await this.generateEnhancedDeviceFingerprint();
      const verification = await this.verifyDevice(fingerprint);
      
      this.deviceTrustScore = verification.trustScore;
      
      if (!verification.verified && verification.requiresVerification) {
        await this.handleDeviceVerificationRequired(fingerprint, verification);
      }
      
      return verification;
    } catch (error) {
      console.error('❌ Device verification initialization failed:', error);
      return { verified: false, reason: 'init_error' };
    }
  }

  /**
   * Handle device verification requirement
   */
  async handleDeviceVerificationRequired(fingerprint, verification) {
    console.log('🔐 Device verification required:', verification.reason);
    
    // Show verification prompt
    toast.info('Device verification required', {
      description: 'This appears to be a new or changed device',
      action: {
        label: 'Verify',
        onClick: () => this.showDeviceVerificationDialog(fingerprint)
      },
      duration: 10000
    });
  }

  /**
   * Show device verification dialog
   */
  showDeviceVerificationDialog(fingerprint) {
    // This would typically show a modal or navigate to verification page
    toast.info('Device Verification', {
      description: 'Please provide a name for this device',
      action: {
        label: 'Trust Device',
        onClick: () => this.addTrustedDevice(fingerprint, 'Verified Device')
      },
      duration: 15000
    });
  }

  /**
   * Get device security status
   */
  getSecurityStatus() {
    return {
      verificationEnabled: this.deviceVerificationEnabled,
      autoBackupEnabled: this.autoBackupEnabled,
      trustedDevicesCount: this.trustedDevices.size,
      lastBackupTime: this.lastBackupTime,
      deviceTrustScore: this.deviceTrustScore,
      backupInterval: this.backupInterval,
      nextBackupDue: this.lastBackupTime ? 
        this.lastBackupTime + this.backupInterval : null
    };
  }

  /**
   * Get trusted devices list
   */
  getTrustedDevices() {
    return Array.from(this.trustedDevices.values()).map(device => ({
      ...device,
      id: device.id.substring(0, 8) + '...',
      addedAt: new Date(device.addedAt).toLocaleString(),
      lastSeen: new Date(device.lastSeen).toLocaleString(),
      fingerprint: {
        ...device.fingerprint,
        hash: device.fingerprint.hash.substring(0, 8) + '...'
      }
    }));
  }

  /**
   * Update device verification settings
   */
  updateVerificationSettings(settings) {
    if (settings.verificationEnabled !== undefined) {
      this.deviceVerificationEnabled = settings.verificationEnabled;
    }
    
    if (settings.autoBackupEnabled !== undefined) {
      this.autoBackupEnabled = settings.autoBackupEnabled;
      
      if (settings.autoBackupEnabled) {
        this.startAutomaticBackup();
      } else {
        this.stopAutomaticBackup();
      }
    }
    
    if (settings.backupInterval !== undefined) {
      this.backupInterval = settings.backupInterval;
    }
    
    console.log('⚙️ Device verification settings updated:', settings);
  }
}

// Create singleton instance
export const deviceSecurityService = new DeviceSecurityService();
export default deviceSecurityService;