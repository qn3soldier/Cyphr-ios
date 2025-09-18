/**
 * WebRTC Configuration Service
 * Provides production-ready STUN/TURN server configuration for reliable peer-to-peer connections
 * Including fallback mechanisms and connection quality optimization
 */

class WebRTCConfigService {
  constructor() {
    this.stunServers = this.parseStunServers();
    this.turnServer = this.parseTurnServer();
    this.iceTransportPolicy = import.meta.env.VITE_WEBRTC_ICE_TRANSPORT_POLICY || 'all';
  }

  /**
   * Parse STUN servers from environment variable
   */
  parseStunServers() {
    const stunServersEnv = import.meta.env.VITE_WEBRTC_STUN_SERVERS;
    if (!stunServersEnv) {
      // Fallback to Google STUN servers
      return [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302'
      ];
    }
    return stunServersEnv.split(',').map(server => server.trim());
  }

  /**
   * Parse TURN server configuration
   */
  parseTurnServer() {
    const turnServer = import.meta.env.VITE_WEBRTC_TURN_SERVER;
    const turnUsername = import.meta.env.VITE_WEBRTC_TURN_USERNAME;
    const turnCredential = import.meta.env.VITE_WEBRTC_TURN_CREDENTIAL;

    if (!turnServer || !turnUsername || !turnCredential) {
      console.warn('⚠️ TURN server not configured. Calls may fail behind restrictive NATs/firewalls.');
      return null;
    }

    return {
      urls: turnServer,
      username: turnUsername,
      credential: turnCredential
    };
  }

  /**
   * Get complete RTCConfiguration for RTCPeerConnection
   */
  getRTCConfiguration() {
    const iceServers = [];

    // Add STUN servers
    this.stunServers.forEach(stunUrl => {
      iceServers.push({ urls: stunUrl });
    });

    // Add TURN server if configured
    if (this.turnServer) {
      iceServers.push(this.turnServer);
    }

    const config = {
      iceServers,
      iceCandidatePoolSize: 10, // Pre-gather ICE candidates for faster connection
      iceTransportPolicy: this.iceTransportPolicy,
      bundlePolicy: 'max-bundle', // Bundle all media streams
      rtcpMuxPolicy: 'require', // Require RTCP multiplexing
      
      // Additional configuration for production reliability
      sdpSemantics: 'unified-plan',
      
      // Certificate configuration for enhanced security
      certificates: undefined // Will be auto-generated
    };

    console.log('🌐 WebRTC Configuration:', {
      stunServers: this.stunServers.length,
      turnServer: !!this.turnServer,
      iceTransportPolicy: this.iceTransportPolicy,
      iceCandidatePoolSize: config.iceCandidatePoolSize
    });

    return config;
  }

  /**
   * Create RTCPeerConnection with optimized configuration
   */
  createPeerConnection() {
    const config = this.getRTCConfiguration();
    const peerConnection = new RTCPeerConnection(config);

    // Add connection state monitoring
    peerConnection.onconnectionstatechange = () => {
      console.log('🔗 WebRTC Connection State:', peerConnection.connectionState);
      
      switch (peerConnection.connectionState) {
        case 'connected':
          console.log('✅ WebRTC connection established successfully');
          break;
        case 'disconnected':
          console.log('⚠️ WebRTC connection temporarily disconnected');
          break;
        case 'failed':
          console.log('❌ WebRTC connection failed - attempting restart');
          this.handleConnectionFailure(peerConnection);
          break;
        case 'closed':
          console.log('🔌 WebRTC connection closed');
          break;
      }
    };

    // Monitor ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE Connection State:', peerConnection.iceConnectionState);
      
      if (peerConnection.iceConnectionState === 'failed') {
        console.log('❌ ICE connection failed - may need TURN server');
      }
    };

    // Monitor ICE gathering state
    peerConnection.onicegatheringstatechange = () => {
      console.log('📡 ICE Gathering State:', peerConnection.iceGatheringState);
    };

    return peerConnection;
  }

  /**
   * Handle connection failure with restart attempt
   */
  async handleConnectionFailure(peerConnection) {
    try {
      console.log('🔄 Attempting ICE restart...');
      
      // Attempt ICE restart
      const offer = await peerConnection.createOffer({ iceRestart: true });
      await peerConnection.setLocalDescription(offer);
      
      console.log('🔄 ICE restart initiated');
    } catch (error) {
      console.error('❌ ICE restart failed:', error);
    }
  }

  /**
   * Test STUN/TURN server connectivity
   */
  async testConnectivity() {
    console.log('🧪 Testing WebRTC connectivity...');
    
    const results = {
      stunServers: [],
      turnServer: null,
      overall: false
    };

    // Test STUN servers
    for (const stunUrl of this.stunServers) {
      try {
        const testConfig = { iceServers: [{ urls: stunUrl }] };
        const testPC = new RTCPeerConnection(testConfig);
        
        // Create a test offer to trigger ICE gathering
        await testPC.createOffer();
        
        const testResult = await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(false), 5000);
          
          testPC.onicecandidate = (event) => {
            if (event.candidate && event.candidate.type === 'srflx') {
              clearTimeout(timeout);
              resolve(true);
            }
          };
          
          testPC.setLocalDescription(testPC.localDescription);
        });

        results.stunServers.push({ url: stunUrl, working: testResult });
        testPC.close();
        
      } catch (error) {
        results.stunServers.push({ url: stunUrl, working: false, error: error.message });
      }
    }

    // Test TURN server if configured
    if (this.turnServer) {
      try {
        const testConfig = { iceServers: [this.turnServer] };
        const testPC = new RTCPeerConnection(testConfig);
        
        await testPC.createOffer();
        
        const turnResult = await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(false), 5000);
          
          testPC.onicecandidate = (event) => {
            if (event.candidate && event.candidate.type === 'relay') {
              clearTimeout(timeout);
              resolve(true);
            }
          };
          
          testPC.setLocalDescription(testPC.localDescription);
        });

        results.turnServer = { working: turnResult };
        testPC.close();
        
      } catch (error) {
        results.turnServer = { working: false, error: error.message };
      }
    }

    results.overall = results.stunServers.some(s => s.working) || 
                     (results.turnServer && results.turnServer.working);

    console.log('🧪 WebRTC Connectivity Test Results:', results);
    return results;
  }

  /**
   * Get media constraints optimized for quality and compatibility
   */
  getMediaConstraints(options = {}) {
    const {
      video = false,
      audio = true,
      preferredVideoResolution = '720p',
      preferredAudioQuality = 'high'
    } = options;

    const constraints = { audio: false, video: false };

    // Audio constraints
    if (audio) {
      constraints.audio = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: preferredAudioQuality === 'high' ? 48000 : 16000,
        channelCount: 1 // Mono for better bandwidth usage
      };
    }

    // Video constraints
    if (video) {
      const videoConstraints = {
        facingMode: 'user', // Front camera by default
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 }
      };

      // Adjust based on preferred resolution
      switch (preferredVideoResolution) {
        case '1080p':
          videoConstraints.width = { ideal: 1920 };
          videoConstraints.height = { ideal: 1080 };
          break;
        case '480p':
          videoConstraints.width = { ideal: 854 };
          videoConstraints.height = { ideal: 480 };
          break;
        case '360p':
          videoConstraints.width = { ideal: 640 };
          videoConstraints.height = { ideal: 360 };
          break;
      }

      constraints.video = videoConstraints;
    }

    return constraints;
  }
}

// Create singleton instance
export const webrtcConfig = new WebRTCConfigService();
export default webrtcConfig;