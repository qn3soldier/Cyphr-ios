/**
 * Privacy Configuration Service for Granular Control
 * Manages user-configurable privacy and P2P obfuscation settings
 * Part of Cyphr's enhanced anti-SORM security measures
 */

import { supabase } from './awsClient';
import { zeroKnowledgeAuth } from './authService.js';
import { p2pService } from './p2pService.js';

class PrivacyConfigService {
  constructor() {
    this.defaultConfig = {
      // Traffic Obfuscation Settings
      obfuscation: {
        frequency: 'medium', // 'low', 'medium', 'high', 'custom'
        customMinInterval: 15000, // 15s minimum
        customMaxInterval: 45000, // 45s maximum  
        adaptiveMode: true,
        burstMode: false,
        throttleOnHighActivity: true,
        packetSizeMode: 'variable', // 'small', 'medium', 'large', 'variable'
        customMinPacketSize: 64,
        customMaxPacketSize: 192
      },
      
      // P2P Network Settings
      p2p: {
        maxPeers: 20, // Maximum connected peers
        minPeers: 3,  // Minimum required peers
        preferredRegions: ['auto'], // 'auto', 'us-east', 'us-west', 'eu-west', 'ap-southeast'
        connectionTimeout: 10000, // 10s timeout
        discoveryMode: 'balanced', // 'aggressive', 'balanced', 'conservative'
        enableBootstrap: true,
        enablePubsub: true
      },
      
      // Geographic Preferences
      geographic: {
        autoSelectRegion: true,
        excludeRegions: [], // Regions to avoid
        preferLowLatency: true,
        preferHighThroughput: false
      },
      
      // Performance Settings
      performance: {
        batteryOptimization: 'balanced', // 'performance', 'balanced', 'power_saver'
        bandwidthOptimization: true,
        enableMetrics: true,
        adaptiveQuality: true
      },
      
      // Security Settings
      security: {
        enableTrafficAnalysisResistance: true,
        enableMetadataObfuscation: true,
        enableTimingRandomization: true,
        enablePacketPadding: true,
        securityLevel: 'high' // 'medium', 'high', 'maximum'
      }
    };
    
    this.currentConfig = { ...this.defaultConfig };
    this.isInitialized = false;
  }

  /**
   * Initialize privacy configuration service
   */
  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      await this.loadUserConfig();
      this.isInitialized = true;
      console.log('🔒 Privacy configuration service initialized');
      return true;
    } catch (error) {
      console.error('❌ Privacy config initialization failed:', error);
      return false;
    }
  }

  /**
   * Load user's privacy configuration from database
   */
  async loadUserConfig() {
    try {
      const user = zeroKnowledgeAuth.getUser();
      if (!user?.id) {
        console.log('No user found, using default privacy config');
        return;
      }

      const { data, error } = await supabase
        .from('user_privacy_config')
        .select('config')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.config) {
        this.currentConfig = this.mergeConfigs(this.defaultConfig, data.config);
        console.log('📋 User privacy config loaded');
      }
    } catch (error) {
      console.error('❌ Failed to load user privacy config:', error);
    }
  }

  /**
   * Save user's privacy configuration to database
   */
  async saveUserConfig() {
    try {
      const user = zeroKnowledgeAuth.getUser();
      if (!user?.id) {
        throw new Error('No user authenticated');
      }

      const { error } = await supabase
        .from('user_privacy_config')
        .upsert({
          user_id: user.id,
          config: this.currentConfig,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      console.log('💾 Privacy config saved');
      return true;
    } catch (error) {
      console.error('❌ Failed to save privacy config:', error);
      return false;
    }
  }

  /**
   * Deep merge configurations
   */
  mergeConfigs(defaultConfig, userConfig) {
    const merged = { ...defaultConfig };
    
    for (const [key, value] of Object.entries(userConfig)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        merged[key] = { ...merged[key], ...value };
      } else {
        merged[key] = value;
      }
    }
    
    return merged;
  }

  /**
   * Get current privacy configuration
   */
  getConfig() {
    return { ...this.currentConfig };
  }

  /**
   * Update obfuscation settings
   */
  async updateObfuscationSettings(settings) {
    this.currentConfig.obfuscation = { ...this.currentConfig.obfuscation, ...settings };
    
    // Apply to P2P service immediately
    await this.applyObfuscationConfig();
    
    return await this.saveUserConfig();
  }

  /**
   * Update P2P network settings
   */
  async updateP2PSettings(settings) {
    this.currentConfig.p2p = { ...this.currentConfig.p2p, ...settings };
    
    // Apply to P2P service immediately
    await this.applyP2PConfig();
    
    return await this.saveUserConfig();
  }

  /**
   * Update geographic preferences
   */
  async updateGeographicSettings(settings) {
    this.currentConfig.geographic = { ...this.currentConfig.geographic, ...settings };
    
    // Reconfigure P2P with new geographic preferences
    await this.applyP2PConfig();
    
    return await this.saveUserConfig();
  }

  /**
   * Update performance settings
   */
  async updatePerformanceSettings(settings) {
    this.currentConfig.performance = { ...this.currentConfig.performance, ...settings };
    
    // Apply performance optimizations
    await this.applyPerformanceConfig();
    
    return await this.saveUserConfig();
  }

  /**
   * Update security settings
   */
  async updateSecuritySettings(settings) {
    this.currentConfig.security = { ...this.currentConfig.security, ...settings };
    
    // Apply security configurations
    await this.applySecurityConfig();
    
    return await this.saveUserConfig();
  }

  /**
   * Apply obfuscation configuration to P2P service
   */
  async applyObfuscationConfig() {
    const { obfuscation } = this.currentConfig;
    
    // Convert frequency preset to intervals
    let intervals = this.getFrequencyIntervals(obfuscation.frequency);
    if (obfuscation.frequency === 'custom') {
      intervals = {
        minInterval: obfuscation.customMinInterval,
        maxInterval: obfuscation.customMaxInterval
      };
    }
    
    // Convert packet size preset to sizes
    let packetSizes = this.getPacketSizes(obfuscation.packetSizeMode);
    if (obfuscation.packetSizeMode === 'custom') {
      packetSizes = {
        minPacketSize: obfuscation.customMinPacketSize,
        maxPacketSize: obfuscation.customMaxPacketSize
      };
    }
    
    const p2pConfig = {
      ...intervals,
      ...packetSizes,
      adaptiveMode: obfuscation.adaptiveMode,
      burstMode: obfuscation.burstMode,
      throttleOnHighActivity: obfuscation.throttleOnHighActivity
    };
    
    p2pService.configureTrafficObfuscation(p2pConfig);
    console.log('🎭 Obfuscation config applied:', p2pConfig);
  }

  /**
   * Apply P2P configuration
   */
  async applyP2PConfig() {
    const { p2p, geographic } = this.currentConfig;
    
    // Update P2P service bootstrap nodes based on geographic preferences
    if (!geographic.autoSelectRegion && geographic.excludeRegions.length > 0) {
      const filteredBootstrapNodes = this.filterBootstrapNodesByRegion(
        p2pService.bootstrapNodes,
        geographic.excludeRegions
      );
      p2pService.bootstrapNodes = filteredBootstrapNodes;
    }
    
    // Update connection manager settings
    if (p2pService.node && p2pService.isInitialized) {
      // Note: Can't modify libp2p config after initialization
      // This would require restart for full effect
      console.log('🌐 P2P config updated (restart required for full effect)');
    }
    
    console.log('🌐 P2P config applied:', { p2p, geographic });
  }

  /**
   * Apply performance configuration
   */
  async applyPerformanceConfig() {
    const { performance } = this.currentConfig;
    
    // Adjust obfuscation based on battery optimization
    if (performance.batteryOptimization === 'power_saver') {
      // Reduce obfuscation frequency for power saving
      const powerSaverConfig = {
        minInterval: 60000, // 1 minute
        maxInterval: 180000, // 3 minutes
        adaptiveMode: true,
        throttleOnHighActivity: true
      };
      p2pService.configureTrafficObfuscation(powerSaverConfig);
    }
    
    console.log('⚡ Performance config applied:', performance);
  }

  /**
   * Apply security configuration
   */
  async applySecurityConfig() {
    const { security } = this.currentConfig;
    
    // Adjust obfuscation based on security level
    if (security.securityLevel === 'maximum') {
      const maxSecurityConfig = {
        minInterval: 5000,  // 5s minimum for maximum security
        maxInterval: 15000, // 15s maximum for maximum security
        adaptiveMode: true,
        burstMode: true,
        minPacketSize: 128,
        maxPacketSize: 384
      };
      p2pService.configureTrafficObfuscation(maxSecurityConfig);
    }
    
    console.log('🛡️ Security config applied:', security);
  }

  /**
   * Get frequency intervals based on preset
   */
  getFrequencyIntervals(frequency) {
    const presets = {
      low: { minInterval: 60000, maxInterval: 180000 },    // 1-3 minutes
      medium: { minInterval: 15000, maxInterval: 45000 },  // 15-45 seconds
      high: { minInterval: 5000, maxInterval: 20000 }      // 5-20 seconds
    };
    
    return presets[frequency] || presets.medium;
  }

  /**
   * Get packet sizes based on preset
   */
  getPacketSizes(sizeMode) {
    const presets = {
      small: { minPacketSize: 32, maxPacketSize: 96 },
      medium: { minPacketSize: 64, maxPacketSize: 192 },
      large: { minPacketSize: 128, maxPacketSize: 384 },
      variable: { minPacketSize: 64, maxPacketSize: 192 }
    };
    
    return presets[sizeMode] || presets.variable;
  }

  /**
   * Filter bootstrap nodes by geographic regions
   */
  filterBootstrapNodesByRegion(nodes, excludeRegions) {
    // This is a simplified implementation
    // In a real deployment, you'd have region-specific bootstrap nodes
    return nodes.filter(node => {
      // Example: exclude nodes based on IP ranges or known regions
      // This would require a proper IP-to-region mapping
      return !excludeRegions.some(region => {
        // Simplified exclusion logic
        return node.includes('104.131') && region === 'us-east';
      });
    });
  }

  /**
   * Get privacy metrics and recommendations
   */
  getPrivacyMetrics() {
    const p2pStatus = p2pService.getStatus();
    const recommendations = this.generateRecommendations();
    
    return {
      config: this.currentConfig,
      p2pStatus,
      recommendations,
      securityScore: this.calculateSecurityScore(),
      performanceScore: this.calculatePerformanceScore()
    };
  }

  /**
   * Generate configuration recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const { obfuscation, p2p, performance, security } = this.currentConfig;
    
    // Security recommendations
    if (security.securityLevel === 'medium') {
      recommendations.push({
        type: 'security',
        priority: 'medium',
        message: 'Consider upgrading to high security level for better protection',
        action: 'upgrade_security'
      });
    }
    
    // Performance recommendations
    if (performance.batteryOptimization === 'performance' && window.navigator?.getBattery) {
      recommendations.push({
        type: 'performance',
        priority: 'low',
        message: 'Performance mode may drain battery faster on mobile',
        action: 'consider_balanced_mode'
      });
    }
    
    // P2P recommendations
    if (p2p.maxPeers > 30) {
      recommendations.push({
        type: 'efficiency',
        priority: 'medium',
        message: 'High peer count may increase bandwidth usage',
        action: 'reduce_peer_count'
      });
    }
    
    return recommendations;
  }

  /**
   * Calculate security score (0-100)
   */
  calculateSecurityScore() {
    const { security, obfuscation } = this.currentConfig;
    let score = 0;
    
    // Base security level
    const securityLevels = { medium: 60, high: 80, maximum: 100 };
    score += securityLevels[security.securityLevel] || 60;
    
    // Obfuscation settings
    if (obfuscation.adaptiveMode) score += 5;
    if (obfuscation.burstMode) score += 5;
    if (security.enableTrafficAnalysisResistance) score += 10;
    if (security.enableMetadataObfuscation) score += 10;
    
    return Math.min(100, score);
  }

  /**
   * Calculate performance score (0-100)
   */
  calculatePerformanceScore() {
    const { performance, obfuscation, p2p } = this.currentConfig;
    let score = 100;
    
    // Deduct for performance-impacting settings
    if (performance.batteryOptimization === 'performance') score -= 20;
    if (obfuscation.frequency === 'high') score -= 15;
    if (p2p.maxPeers > 20) score -= 10;
    if (obfuscation.burstMode) score -= 10;
    
    // Add for optimizations
    if (performance.bandwidthOptimization) score += 10;
    if (performance.adaptiveQuality) score += 5;
    
    return Math.max(0, score);
  }

  /**
   * Reset to default configuration
   */
  async resetToDefaults() {
    this.currentConfig = { ...this.defaultConfig };
    await this.applyAllConfigs();
    return await this.saveUserConfig();
  }

  /**
   * Apply all configurations
   */
  async applyAllConfigs() {
    await this.applyObfuscationConfig();
    await this.applyP2PConfig();
    await this.applyPerformanceConfig();
    await this.applySecurityConfig();
  }
}

// Create singleton instance
export const privacyConfigService = new PrivacyConfigService();
export default privacyConfigService;