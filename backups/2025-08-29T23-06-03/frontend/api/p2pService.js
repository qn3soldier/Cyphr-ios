/**
 * P2P Mesh Networking Service for Traffic Obfuscation
 * Uses libp2p for decentralized communication and metadata protection
 * Part of Cyphr's anti-SORM security measures (legal compliance)
 */

import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { mplex } from '@libp2p/mplex';
import { bootstrap } from '@libp2p/bootstrap';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
import FinalKyber1024 from './crypto/finalKyber1024.js';

class P2PService {
  constructor() {
    // 🚨 TEMPORARY: P2P disabled while fixing core app issues
    this.disabled = true;
    this.node = null;
    this.isStarted = false;
    this.isInitialized = false;
    this.peers = new Map();
    this.messageQueue = [];
    this.kyber = new FinalKyber1024();
    this.privacyMode = false;
    this.startTime = null;
    this.obfuscationInterval = null;
    
    // Traffic obfuscation configuration
    this.obfuscationConfig = {
      enabled: false,
      minInterval: 15000, // 15 seconds minimum (reduced from 20s)
      maxInterval: 45000, // 45 seconds maximum (reduced from 90s)
      minPacketSize: 64,   // 64 bytes minimum (reduced from 128)
      maxPacketSize: 192,  // 192 bytes maximum (reduced from 384)
      adaptiveMode: true,  // Adapt based on network activity
      burstMode: false,    // Send bursts for high-security scenarios
      throttleOnHighActivity: true // Reduce frequency during high activity
    };
    
    this.activityMetrics = {
      realMessagesPerMinute: 0,
      lastActivityCheck: Date.now(),
      recentActivity: []
    };
    
    // Bootstrap nodes for initial peer discovery (disabled for now)
    this.bootstrapNodes = [
      // '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
      // '/ip4/104.236.176.52/tcp/4001/p2p/QmSoLnSGccFuZQJzRadHn95W2CrSFmZuTdDWP8HXaHca9z'
    ];
  }

  /**
   * Initialize P2P node
   */
  async initialize() {
    // 🚨 TEMPORARY: Skip P2P initialization while fixing core issues
    if (this.disabled) {
      console.log('🚫 P2P disabled temporarily - skipping initialization');
      return false;
    }
    
    if (this.isInitialized) {
      console.log('🌐 P2P node already initialized');
      return true;
    }

    // Browser compatibility checks
    if (!this.checkBrowserCompatibility()) {
      console.warn('⚠️ Browser does not support P2P features, running in compatibility mode');
      return false;
    }

    try {
      console.log('🌐 Initializing P2P node...');

      const config = {
        transports: [
          webSockets({
            filter: (ma) => {
              try {
                return ma.toString().includes('ws');
              } catch (error) {
                console.warn('⚠️ WebSocket filter error:', error);
                return false;
              }
            }
          })
        ],
        connectionEncryption: [noise()],
        streamMuxers: [mplex()],
        peerDiscovery: [
          bootstrap({
            list: this.bootstrapNodes,
            timeout: 10000 // 10 second timeout
          }),
          pubsubPeerDiscovery({
            interval: 5000,
            topics: ['cyphr-mesh'],
            timeout: 8000
          })
        ],
        connectionManager: {
          maxConnections: 50,
          minConnections: 3, // Reduced for better compatibility
          maxIncomingPendingConnections: 10,
          maxOutgoingPendingConnections: 20,
          connectionPruning: true
        },
        start: false // Don't auto-start
      };

      this.node = await createLibp2p(config);

      // Set up event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      console.log('✅ P2P node initialized');
      console.log('📍 Peer ID:', this.node.peerId.toString());
      
      return true;
    } catch (error) {
      console.error('❌ P2P initialization failed:', error);
      this.handleInitializationError(error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Check browser compatibility for P2P features
   */
  checkBrowserCompatibility() {
    try {
      // Check for WebRTC support
      if (!window.RTCPeerConnection && !window.webkitRTCPeerConnection && !window.mozRTCPeerConnection) {
        console.warn('⚠️ WebRTC not supported');
        return false;
      }

      // Check for WebSocket support
      if (!window.WebSocket) {
        console.warn('⚠️ WebSocket not supported');
        return false;
      }

      // Check for crypto support
      if (!window.crypto || !window.crypto.subtle) {
        console.warn('⚠️ Web Crypto API not supported');
        return false;
      }

      // Check for required APIs
      if (!window.TextEncoder || !window.TextDecoder) {
        console.warn('⚠️ TextEncoder/TextDecoder not supported');
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Browser compatibility check failed:', error);
      return false;
    }
  }

  /**
   * Handle initialization errors with specific recovery strategies
   */
  handleInitializationError(error) {
    const errorMessage = error.message || error.toString();
    
    if (errorMessage.includes('WebSocket')) {
      console.warn('🔧 WebSocket connectivity issue detected - ensure firewall allows WebSocket connections');
    } else if (errorMessage.includes('bootstrap')) {
      console.warn('🔧 Bootstrap node connectivity issue - trying fallback configuration');
      this.bootstrapNodes = []; // Clear bootstrap nodes for retry
    } else if (errorMessage.includes('noise') || errorMessage.includes('encryption')) {
      console.warn('🔧 Encryption setup failed - crypto libraries may be incompatible');
    } else if (errorMessage.includes('peer')) {
      console.warn('🔧 Peer discovery issue - reducing discovery requirements');
    } else {
      console.warn('🔧 Unknown P2P error - check browser console for details');
    }
  }

  /**
   * Start P2P networking
   */
  async start() {
    if (this.isStarted) {
      console.log('🚀 P2P node already started');
      return true;
    }

    if (!this.isInitialized) {
      const initSuccess = await this.initialize();
      if (!initSuccess) {
        return false;
      }
    }

    try {
      await this.node.start();
      this.isStarted = true;
      this.startTime = Date.now();
      
      console.log('🚀 P2P node started');
      console.log('🔗 Listening addresses:', this.node.getMultiaddrs());
      
      // Process any queued messages
      await this.processMessageQueue();
      
      return true;
    } catch (error) {
      console.error('❌ P2P start failed:', error);
      this.isStarted = false;
      return false;
    }
  }

  /**
   * Stop P2P networking
   */
  async stop() {
    if (this.node && this.isStarted) {
      try {
        // Stop traffic obfuscation first
        this.stopTrafficObfuscation();
        
        await this.node.stop();
        this.isStarted = false;
        this.isInitialized = false;
        this.startTime = null;
        
        // Clear peers
        this.peers.clear();
        
        console.log('⏹️ P2P node stopped');
      } catch (error) {
        console.error('❌ P2P stop error:', error);
        // Force reset state even if stop fails
        this.isStarted = false;
        this.isInitialized = false;
      }
    }
  }

  /**
   * Set up event handlers for peer management
   */
  setupEventHandlers() {
    // Peer connected
    this.node.addEventListener('peer:connect', (event) => {
      const peerId = event.detail.toString();
      console.log('🔗 Peer connected:', peerId);
      
      this.peers.set(peerId, {
        id: peerId,
        connectedAt: Date.now(),
        messageCount: 0
      });
    });

    // Peer disconnected
    this.node.addEventListener('peer:disconnect', (event) => {
      const peerId = event.detail.toString();
      console.log('💔 Peer disconnected:', peerId);
      this.peers.delete(peerId);
    });

    // Handle incoming messages
    this.node.handle('/cyphr/message/1.0.0', ({ stream }) => {
      this.handleIncomingMessage(stream);
    });
  }

  /**
   * Handle incoming P2P messages
   */
  async handleIncomingMessage(stream) {
    try {
      const chunks = [];
      
      for await (const chunk of stream.source) {
        chunks.push(chunk);
      }
      
      const messageBuffer = Buffer.concat(chunks);
      const encryptedMessage = JSON.parse(messageBuffer.toString());
      
      // Decrypt message using Kyber1024
      const decryptedMessage = await this.kyber.decryptMessage(
        encryptedMessage.content,
        encryptedMessage.symmetricKey
      );
      
      console.log('📥 Received P2P message:', decryptedMessage);
      
      // Forward to message handler
      this.onMessageReceived?.(decryptedMessage);
      
    } catch (error) {
      console.error('❌ Error handling P2P message:', error);
    }
  }

  /**
   * Send message through P2P network
   */
  async sendMessage(message, targetPeerId = null) {
    if (!this.isStarted) {
      console.warn('⚠️ P2P not started, queuing message');
      this.messageQueue.push({ message, targetPeerId });
      return false;
    }

    try {
      // Record real message activity for adaptive obfuscation (but not for dummy packets)
      if (message.type !== 'obfuscation') {
        this.recordRealMessageActivity();
      }

      // Encrypt message with Kyber1024
      const encryptedMessage = await this.kyber.encryptMessage(
        JSON.stringify(message),
        null, // Will use session key
        null
      );

      const messageBuffer = Buffer.from(JSON.stringify(encryptedMessage));

      if (targetPeerId) {
        // Direct message to specific peer
        await this.sendDirectMessage(targetPeerId, messageBuffer);
      } else {
        // Broadcast to all connected peers
        await this.broadcastMessage(messageBuffer);
      }

      if (message.type !== 'obfuscation') {
        console.log('📤 Real message sent via P2P');
      }
      return true;
      
    } catch (error) {
      console.error('❌ P2P send failed:', error);
      return false;
    }
  }

  /**
   * Send direct message to specific peer
   */
  async sendDirectMessage(peerId, messageBuffer) {
    try {
      const stream = await this.node.dialProtocol(peerId, '/cyphr/message/1.0.0');
      await stream.sink([messageBuffer]);
      await stream.close();
      
    } catch (error) {
      console.error('❌ Direct message failed:', error);
      throw error;
    }
  }

  /**
   * Broadcast message to all connected peers
   */
  async broadcastMessage(messageBuffer) {
    const connections = this.node.getConnections();
    const sendPromises = [];

    for (const connection of connections) {
      sendPromises.push(
        this.sendDirectMessage(connection.remotePeer, messageBuffer)
          .catch(err => console.warn('Failed to send to peer:', err))
      );
    }

    await Promise.allSettled(sendPromises);
  }

  /**
   * Enable/disable privacy mode (traffic obfuscation)
   */
  setPrivacyMode(enabled, config = {}) {
    this.privacyMode = enabled;
    this.obfuscationConfig.enabled = enabled;
    
    // Apply custom configuration if provided
    if (config.minInterval !== undefined) this.obfuscationConfig.minInterval = config.minInterval;
    if (config.maxInterval !== undefined) this.obfuscationConfig.maxInterval = config.maxInterval;
    if (config.adaptiveMode !== undefined) this.obfuscationConfig.adaptiveMode = config.adaptiveMode;
    if (config.burstMode !== undefined) this.obfuscationConfig.burstMode = config.burstMode;
    
    console.log(`🔒 Privacy mode: ${enabled ? 'ON' : 'OFF'}`, config);
    
    if (enabled) {
      this.startOptimizedTrafficObfuscation();
    } else {
      this.stopTrafficObfuscation();
    }
  }

  /**
   * Configure traffic obfuscation parameters
   */
  configureTrafficObfuscation(config) {
    this.obfuscationConfig = { ...this.obfuscationConfig, ...config };
    console.log('🎭 Traffic obfuscation reconfigured:', this.obfuscationConfig);
    
    // Restart obfuscation if active
    if (this.obfuscationConfig.enabled) {
      this.stopTrafficObfuscation();
      this.startOptimizedTrafficObfuscation();
    }
  }

  /**
   * Start optimized traffic obfuscation
   */
  startOptimizedTrafficObfuscation() {
    if (this.obfuscationInterval) return;
    
    console.log('🎭 Starting optimized traffic obfuscation...', this.obfuscationConfig);
    
    const scheduleNextPacket = () => {
      if (!this.obfuscationConfig.enabled || !this.isStarted) return;
      
      const interval = this.calculateOptimalInterval();
      
      this.obfuscationInterval = setTimeout(async () => {
        if (this.peers.size > 0 && this.isStarted && this.obfuscationConfig.enabled) {
          try {
            await this.sendOptimizedDummyPacket();
            scheduleNextPacket(); // Schedule next packet
          } catch (error) {
            console.warn('⚠️ Optimized obfuscation packet failed:', error);
            scheduleNextPacket(); // Continue despite failure
          }
        }
      }, interval);
    };
    
    scheduleNextPacket();
  }

  /**
   * Calculate optimal interval based on network activity and configuration
   */
  calculateOptimalInterval() {
    this.updateActivityMetrics();
    
    const { minInterval, maxInterval, adaptiveMode, throttleOnHighActivity } = this.obfuscationConfig;
    let interval = minInterval + Math.random() * (maxInterval - minInterval);
    
    if (adaptiveMode) {
      const activityLevel = this.activityMetrics.realMessagesPerMinute;
      
      if (throttleOnHighActivity && activityLevel > 10) {
        // Reduce dummy packet frequency during high activity
        interval *= (1 + (activityLevel / 20)); // Increase interval by up to 50% for 20+ msgs/min
        console.log(`🎭 Throttling obfuscation due to high activity: ${activityLevel} msgs/min`);
      } else if (activityLevel < 2) {
        // Increase dummy packet frequency during low activity
        interval *= 0.7; // Reduce interval by 30% for very low activity
        console.log(`🎭 Boosting obfuscation due to low activity: ${activityLevel} msgs/min`);
      }
    }
    
    // Apply burst mode if enabled
    if (this.obfuscationConfig.burstMode && Math.random() < 0.2) {
      interval *= 0.3; // 20% chance of burst (reduce interval by 70%)
      console.log('🎭 Burst mode activated');
    }
    
    // Ensure interval stays within bounds
    return Math.max(minInterval * 0.5, Math.min(maxInterval * 1.5, interval));
  }

  /**
   * Update activity metrics for adaptive obfuscation
   */
  updateActivityMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean old activity entries
    this.activityMetrics.recentActivity = this.activityMetrics.recentActivity.filter(
      timestamp => timestamp > oneMinuteAgo
    );
    
    // Update messages per minute
    this.activityMetrics.realMessagesPerMinute = this.activityMetrics.recentActivity.length;
    this.activityMetrics.lastActivityCheck = now;
  }

  /**
   * Record real message activity for adaptive obfuscation
   */
  recordRealMessageActivity() {
    this.activityMetrics.recentActivity.push(Date.now());
  }

  /**
   * Send optimized dummy packet with variable size and content
   */
  async sendOptimizedDummyPacket() {
    const { minPacketSize, maxPacketSize } = this.obfuscationConfig;
    const packetSize = minPacketSize + Math.floor(Math.random() * (maxPacketSize - minPacketSize));
    
    // Create variable-sized padding
    const padding = new Uint8Array(packetSize);
    window.crypto.getRandomValues(padding);
    
    // Add realistic-looking metadata to make detection harder
    const dummyMessage = {
      type: 'obfuscation',
      timestamp: Date.now(),
      id: Math.random().toString(36).substring(2, 15),
      padding: Array.from(padding),
      // Add fake metadata that looks like real message data
      meta: {
        version: '1.0',
        encoding: 'utf-8',
        checksum: Math.random().toString(16).substring(2, 10)
      }
    };
    
    await this.sendMessage(dummyMessage);
    console.log(`🎭 Optimized dummy packet sent (${packetSize}B)`);
  }

  /**
   * Legacy method for backward compatibility
   */
  startTrafficObfuscation() {
    this.startOptimizedTrafficObfuscation();
  }

  /**
   * Get randomized interval for traffic obfuscation (backward compatibility)
   */
  getRandomInterval() {
    return this.calculateOptimalInterval();
  }

  /**
   * Stop traffic obfuscation
   */
  stopTrafficObfuscation() {
    if (this.obfuscationInterval) {
      clearTimeout(this.obfuscationInterval); // Changed from clearInterval to clearTimeout
      this.obfuscationInterval = null;
      console.log('🎭 Traffic obfuscation stopped');
    }
    this.obfuscationConfig.enabled = false;
  }

  /**
   * Get current P2P status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isStarted: this.isStarted,
      peerId: this.node?.peerId?.toString() || null,
      connectedPeers: this.peers.size,
      privacyMode: this.privacyMode,
      queuedMessages: this.messageQueue.length,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      obfuscation: {
        enabled: this.obfuscationConfig.enabled,
        config: this.obfuscationConfig,
        metrics: this.getObfuscationMetrics()
      }
    };
  }

  /**
   * Get traffic obfuscation metrics
   */
  getObfuscationMetrics() {
    this.updateActivityMetrics();
    
    return {
      realMessagesPerMinute: this.activityMetrics.realMessagesPerMinute,
      lastActivityCheck: this.activityMetrics.lastActivityCheck,
      recentActivity: this.activityMetrics.recentActivity.length,
      nextPacketEstimate: this.obfuscationInterval ? 'scheduled' : 'none',
      config: {
        currentInterval: `${this.obfuscationConfig.minInterval}-${this.obfuscationConfig.maxInterval}ms`,
        packetSizeRange: `${this.obfuscationConfig.minPacketSize}-${this.obfuscationConfig.maxPacketSize}B`,
        adaptiveMode: this.obfuscationConfig.adaptiveMode,
        burstMode: this.obfuscationConfig.burstMode
      }
    };
  }

  /**
   * Get traffic obfuscation performance recommendations
   */
  getObfuscationRecommendations() {
    this.updateActivityMetrics();
    
    const recommendations = [];
    const activityLevel = this.activityMetrics.realMessagesPerMinute;
    
    if (activityLevel > 15) {
      recommendations.push({
        type: 'performance',
        message: 'High message activity detected - consider increasing obfuscation intervals',
        suggestion: 'Increase minInterval to 30000ms and maxInterval to 90000ms'
      });
    } else if (activityLevel < 1) {
      recommendations.push({
        type: 'security',
        message: 'Low message activity detected - consider more aggressive obfuscation',
        suggestion: 'Enable burst mode and decrease intervals for better traffic masking'
      });
    }
    
    if (this.peers.size > 20) {
      recommendations.push({
        type: 'efficiency',
        message: 'Many peers connected - optimize obfuscation for bandwidth',
        suggestion: 'Reduce packet sizes to minimize bandwidth overhead'
      });
    }
    
    if (!this.obfuscationConfig.adaptiveMode) {
      recommendations.push({
        type: 'optimization',
        message: 'Static obfuscation mode active',
        suggestion: 'Enable adaptive mode for better performance/security balance'
      });
    }
    
    return recommendations;
  }

  /**
   * Get connected peers list
   */
  getPeers() {
    return Array.from(this.peers.values());
  }

  /**
   * Set message received callback
   */
  onMessage(callback) {
    this.onMessageReceived = callback;
  }

  /**
   * Process queued messages when P2P starts
   */
  async processMessageQueue() {
    if (this.messageQueue.length === 0) return;
    
    console.log(`📤 Processing ${this.messageQueue.length} queued messages`);
    
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    for (const { message, targetPeerId } of queue) {
      await this.sendMessage(message, targetPeerId);
    }
  }

  /**
   * Get network statistics
   */
  getNetworkStats() {
    if (!this.node) return null;
    
    return {
      connections: this.node.getConnections().length,
      peers: this.peers.size,
      multiaddrs: this.node.getMultiaddrs().map(ma => ma.toString()),
      uptime: this.isStarted ? Date.now() - this.startTime : 0
    };
  }
}

// Create singleton instance
export const p2pService = new P2PService();
export default p2pService;