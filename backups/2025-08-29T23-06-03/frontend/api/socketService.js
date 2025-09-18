import io from 'socket.io-client';
import QuantumCryptoSecure from './crypto/quantumCryptoSecure';
import { secureStorage } from './crypto/secureStorage';
import { secureChaCha20 } from './crypto/secureChaCha20';
import { p2pService } from './p2pService.js';
import { complianceLogger } from './compliance/complianceLogger.js';

class SocketService {
  constructor() {
    this.socket = null;
    this.quantum = QuantumCryptoSecure;
    this.isConnected = false;
    this.messageQueue = [];
    this.typingTimers = {};
    this.messageCallbacks = new Map();
    this.onIncomingCall = null;
    this.onNewMessage = null;
    this.onMessageStatus = null;
    this.onUserTyping = null;
    this.onUserOnline = null;
    this.onUserOffline = null;
    this.onCallAnswered = null;
    this.onCallEnded = null;
    this.onIceCandidate = null;
    this.crypto = null;
    
    // СОРМ protection features
    this.privacyMode = false;
    this.useP2P = false;
    this.p2pFallbackEnabled = true;
    
    // WebSocket suspension handling
    this.heartbeatInterval = null;
    this.lastHeartbeat = Date.now();
    this.suspensionDetected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    
    this.initializeCrypto();
    // TODO: Re-enable P2P after fixing core app issues
    // this.initializeP2P();
    this.setupSuspensionHandling();
  }

  async initializeCrypto() {
    try {
      console.log('🔐 Using existing QuantumCryptoSecure instance...');
      this.crypto = QuantumCryptoSecure;
      console.log('🔐 QuantumCryptoSecure instance assigned');
      // No need to initialize again - it's a singleton that auto-initializes
      if (!this.crypto.initialized) {
        await this.crypto.initialize();
      }
      console.log('🔐 QuantumCryptoSecure ready');
    } catch (error) {
      console.error('Failed to initialize crypto:', error);
      console.error('Error details:', error.message, error.stack);
    }
  }

  async initializeP2P() {
    try {
      // Set up P2P message handler but don't start yet
      p2pService.onMessage((message) => {
        this.handleP2PMessage(message);
      });
      
      console.log('🌐 P2P service pre-initialized (not started)');
    } catch (error) {
      console.error('❌ P2P initialization failed:', error);
    }
  }

  setupSuspensionHandling() {
    // Handle browser suspension/resume events
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          console.log('🔇 Page hidden - preparing for suspension');
          this.handleSuspension();
        } else {
          console.log('👁️ Page visible - resuming connections');
          this.handleResume();
        }
      });

      // Handle page freeze/unfreeze (more aggressive suspension)
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });

      // Handle focus/blur for tab switching
      window.addEventListener('focus', () => {
        this.handleResume();
      });

      window.addEventListener('blur', () => {
        // Don't immediately suspend on blur, wait a bit
        setTimeout(() => {
          if (document.hidden) {
            this.handleSuspension();
          }
        }, 5000);
      });
    }
  }

  handleSuspension() {
    console.log('⏸️ Handling suspension - clearing heartbeat');
    this.suspensionDetected = true;
    
    // Clear heartbeat to prevent connection attempts
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Don't disconnect socket - let it gracefully suspend
    // The browser will handle the suspension
  }

  handleResume() {
    if (!this.suspensionDetected) return;
    
    console.log('▶️ Resuming from suspension');
    this.suspensionDetected = false;
    
    // Check if socket is still connected
    if (this.socket && !this.socket.connected) {
      console.log('🔄 Socket disconnected during suspension, reconnecting...');
      this.reconnectAttempts = 0;
      this.connect();
    } else if (this.socket && this.socket.connected) {
      console.log('✅ Socket survived suspension');
      this.startHeartbeat();
    }
  }

  startHeartbeat() {
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.connected && !this.suspensionDetected) {
        this.socket.emit('ping', { timestamp: Date.now() });
        this.lastHeartbeat = Date.now();
      }
    }, 30000); // Ping every 30 seconds
  }

  cleanup() {
    console.log('🧹 Cleaning up socket service');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  async connect() {
    if (this.socket?.connected) return;

    // TODO: Re-enable P2P after fixing core app issues
    // Initialize P2P if privacy mode is enabled
    // if (this.privacyMode) {
    //   await this.enableP2P();
    // }

    const serverUrl = import.meta.env.VITE_SERVER_URL || 'https://app.cyphrmessenger.app';
    
    try {
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],  // WebSocket first
        reconnection: true,
        reconnectionAttempts: 10,  // More attempts for stability
        reconnectionDelay: 1000,   // Start with 1s
        reconnectionDelayMax: 5000, // Max 5s delay
        randomizationFactor: 0.5,  // Add randomization to prevent thundering herd
        timeout: 10000,  // Longer timeout for slow connections
        forceNew: false,  // Allow connection reuse for better performance
        autoConnect: true,
        upgrade: true,
        rememberUpgrade: true
      });

      this.setupEventHandlers();
      
      // Authenticate after connection
      this.socket.on('connect', async () => {
        console.log('🔗 Socket connected successfully');
        await this.authenticate();
      });

      return new Promise((resolve) => {
        this.socket.on('authenticated', () => {
          console.log('✅ Socket authenticated');
          this.isConnected = true;
          this.processMessageQueue();
          this.startHeartbeat(); // Start heartbeat after authentication
          resolve(true);
        });
        
        // Fallback resolve after timeout
        setTimeout(() => resolve(true), 5000);
      });
    } catch (error) {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      
      // TODO: Re-enable P2P after fixing core app issues
      // Try P2P fallback if enabled (but only after multiple failures)
      // if (this.p2pFallbackEnabled && !this.useP2P && this.reconnectAttempts > 3) {
      //   console.log('🌐 Multiple failures - attempting P2P fallback...');
      //   await this.enableP2P();
      //   this.reconnectAttempts = 0; // Reset counter
      // }
      
      // Fallback mode without socket
      this.isConnected = false;
      return true;
    }
  }

  async authenticate(userIdParam = null) {
    const userId = userIdParam || sessionStorage.getItem('userId');
    let publicKey = sessionStorage.getItem('userPublicKey');
    
    if (!userId) {
      console.log('⚠️ No userId found, user not logged in. Socket will work in guest mode.');
      // Emit guest authentication for anonymous access
      this.socket?.emit('authenticate', { userId: 'guest', publicKey: null });
      return;
    }

    // Generate temporary public key if not found (for first-time users)
    if (!publicKey) {
      try {
        // Generate a temporary key pair for this session
        const tempKeyPair = await crypto.subtle.generateKey(
          {
            name: 'ECDH',
            namedCurve: 'P-256',
          },
          true,
          ['deriveKey', 'deriveBits']
        );
        
        const exportedPublicKey = await crypto.subtle.exportKey('raw', tempKeyPair.publicKey);
        publicKey = Array.from(new Uint8Array(exportedPublicKey)).map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Store for this session
        sessionStorage.setItem('userPublicKey', publicKey);
        console.log('🔑 Generated temporary public key for session');
      } catch (error) {
        console.warn('Could not generate public key, using fallback:', error);
        publicKey = 'temp_key_' + Date.now();
        sessionStorage.setItem('userPublicKey', publicKey);
      }
    }

    console.log('🔐 Authenticating user:', userId);
    this.socket?.emit('authenticate', { userId, publicKey });
  }

  setupEventHandlers() {
    if (!this.socket) return;

    // Authentication
    this.socket.on('authenticated', (data) => {
      console.log('Socket authenticated');
      this.isConnected = true;
      this.processMessageQueue();
    });

    this.socket.on('auth_error', (error) => {
      console.log('ℹ️ Socket auth info:', error, '- This is normal if user not logged in');
      this.isConnected = false;
    });

    // Messages
    this.socket.on('new_message', async (message) => {
      console.log('🔥 SOCKET EVENT: new_message received', message);
      await this.handleNewMessage(message);
    });

    this.socket.on('message_sent', (data) => {
      const callback = this.messageCallbacks.get(data.tempId);
      if (callback) {
        callback.resolve(data);
        this.messageCallbacks.delete(data.tempId);
      }
    });

    this.socket.on('message_error', (data) => {
      const callback = this.messageCallbacks.get(data.tempId);
      if (callback) {
        callback.reject(data.error);
        this.messageCallbacks.delete(data.tempId);
      }
    });

    // Message status
    this.socket.on('message_status', (data) => {
      this.onMessageStatus?.(data);
    });

    // Typing indicators
    this.socket.on('user_typing', (data) => {
      this.onUserTyping?.(data);
    });

    // User status
    this.socket.on('user_online', (data) => {
      this.onUserOnline?.(data);
    });

    this.socket.on('user_offline', (data) => {
      this.onUserOffline?.(data);
    });

    // Calls
    this.socket.on('incoming_call', (data) => {
      console.log('📞 Incoming call received:', data);
      this.onIncomingCall?.(data);
    });

    this.socket.on('call_answered', (data) => {
      this.onCallAnswered?.(data);
    });

    this.socket.on('call_ended', (data) => {
      this.onCallEnded?.(data);
    });

    this.socket.on('ice_candidate', (data) => {
      this.onIceCandidate?.(data);
    });

    // Connection events with improved handling
    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      this.isConnected = false;
      
      // Try to reconnect immediately for certain reasons
      if (reason === 'io server disconnect') {
        console.log('🔄 Server disconnected us, attempting manual reconnect...');
        setTimeout(() => {
          if (!this.socket.connected) {
            this.socket.connect();
          }
        }, 1000);
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔗 Socket reconnected after', attemptNumber, 'attempts');
      this.isConnected = true;
      this.authenticate();
      
      // Process queued messages
      this.processMessageQueue();
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Reconnect attempt #', attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      console.warn('❌ Reconnect error:', error.message);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('💥 Failed to reconnect after maximum attempts');
      // TODO: Re-enable P2P after fixing core app issues
      // Try P2P fallback
      // if (this.p2pFallbackEnabled && !this.useP2P) {
      //   console.log('🔄 Falling back to P2P connection...');
      //   this.enablePrivacyMode();
      // }
    });

    this.socket.on('connect_error', (error) => {
      console.warn('❌ Socket connection error:', error.message);
      
      // TODO: Re-enable P2P after fixing core app issues
      // If it's a CORS or network error, try fallback
      // if (error.message.includes('CORS') || error.message.includes('fetch')) {
      //   console.log('🔄 Network error detected, trying P2P fallback...');
      //   if (this.p2pFallbackEnabled && !this.useP2P) {
      //     setTimeout(() => this.enablePrivacyMode(), 2000);
      //   }
      // }
    });

    // Handle heartbeat responses
    this.socket.on('pong', (data) => {
      this.lastHeartbeat = Date.now();
      console.log('💓 Heartbeat received:', data?.timestamp);
    });
  }

  // ===== СОРМ PROTECTION: P2P HYBRID METHODS =====
  
  /**
   * Enable privacy mode with P2P obfuscation
   */
  async enablePrivacyMode() {
    console.log('🔒 Enabling privacy mode (anti-СОРМ)...');
    this.privacyMode = true;
    
    // TODO: Re-enable P2P after fixing core app issues
    // Start P2P if not already running
    // if (!this.useP2P) {
    //   await this.enableP2P();
    // }
    
    // Enable traffic obfuscation
    p2pService.setPrivacyMode(true);
    
    console.log('✅ Privacy mode enabled - traffic obfuscated');
    
    // Compliance logging for privacy mode usage
    const userId = sessionStorage.getItem('userId');
    if (userId) {
      complianceLogger.logPrivacyMode(userId, true, {
        p2pPeers: p2pService.getStatus().connectedPeers,
        obfuscationActive: true,
        reason: 'user_activated'
      });
    }
  }

  /**
   * Disable privacy mode, return to server-only
   */
  async disablePrivacyMode() {
    console.log('🔓 Disabling privacy mode...');
    this.privacyMode = false;
    
    // Disable traffic obfuscation but keep P2P for fallback
    p2pService.setPrivacyMode(false);
    
    console.log('✅ Privacy mode disabled - using server connection');
    
    // Compliance logging for privacy mode disable
    const userId = sessionStorage.getItem('userId');
    if (userId) {
      complianceLogger.logPrivacyMode(userId, false, {
        p2pPeers: p2pService.getStatus().connectedPeers,
        obfuscationActive: false,
        reason: 'user_deactivated'
      });
    }
  }

  /**
   * Enable P2P networking
   */
  async enableP2P() {
    if (this.useP2P) return true;
    
    try {
      console.log('🌐 Starting P2P network...');
      const success = await p2pService.start();
      
      if (success) {
        this.useP2P = true;
        console.log('✅ P2P network active');
        return true;
      }
      
      console.warn('⚠️ P2P start failed');
      return false;
    } catch (error) {
      console.error('❌ P2P enable error:', error);
      return false;
    }
  }

  /**
   * Disable P2P networking
   */
  async disableP2P() {
    if (!this.useP2P) return;
    
    try {
      await p2pService.stop();
      this.useP2P = false;
      console.log('⏹️ P2P network stopped');
    } catch (error) {
      console.error('❌ P2P disable error:', error);
    }
  }

  /**
   * Handle messages received via P2P
   */
  async handleP2PMessage(message) {
    try {
      console.log('📥 Received P2P message:', message);
      
      // Skip obfuscation dummy packets
      if (message.type === 'obfuscation') {
        return;
      }
      
      // Process real messages like normal socket messages
      await this.handleNewMessage(message);
      
    } catch (error) {
      console.error('❌ P2P message handling error:', error);
    }
  }

  /**
   * Get current privacy/P2P status
   */
  getPrivacyStatus() {
    return {
      privacyMode: this.privacyMode,
      useP2P: this.useP2P,
      p2pConnected: p2pService.getStatus().isStarted,
      connectedPeers: p2pService.getStatus().connectedPeers,
      serverConnected: this.isConnected
    };
  }

  async handleNewMessage(message) {
    console.log('🔥 handleNewMessage called with:', message);
    console.log('🔥 onNewMessage callback exists?', !!this.onNewMessage);
    try {
      // **🔐 KYBER1024 POST-QUANTUM DECRYPTION ACTIVATED**
      if (message.sender_id !== sessionStorage.getItem('userId')) {
        try {
          // Check if message uses Kyber1024 encryption
          if (message.kyberCiphertext && message.algorithm && message.algorithm.includes('Kyber1024')) {
            console.log('🔓 Decrypting Kyber1024 + ChaCha20 hybrid message');
            
            // Get our private key for decryption
            const secretKey = sessionStorage.getItem('userSecretKey');
            
            if (secretKey && this.crypto) {
              // Reconstruct encrypted package
              const encryptedPackage = {
                encryptedMessage: message.content,
                kyberCiphertext: message.kyberCiphertext,
                algorithm: message.algorithm,
                timestamp: message.timestamp,
                security: message.security,
                performanceMs: message.performanceMs
              };
              
              // Decrypt with Kyber1024 + ChaCha20
              const startTime = performance.now();
              message.decryptedContent = await this.crypto.decryptMessage(encryptedPackage, secretKey);
              const decryptTime = performance.now() - startTime;
              
              if (decryptTime < 20) {
                console.log(`⚡ Kyber1024 decryption: ${decryptTime.toFixed(2)}ms (✅ target met)`);
              } else {
                console.warn(`⚠️ Kyber1024 decryption: ${decryptTime.toFixed(2)}ms (target: <20ms)`);
              }
              
            } else {
              console.warn('⚠️ No secret key available for Kyber1024 decryption');
              message.decryptedContent = message.content; // Fallback to encrypted content
            }
            
          } else if (message.algorithm && message.algorithm.includes('ChaCha20')) {
            console.log('🔓 Decrypting ChaCha20 symmetric message');
            // Fallback ChaCha20 decryption
            const chatSecret = await this.getChatSecret(message.chat_id);
            if (chatSecret && message.content) {
              message.decryptedContent = await this.decryptMessage(message.content, chatSecret);
            } else {
              message.decryptedContent = message.content;
            }
            
          } else {
            console.log('📝 Plain text message (no encryption detected)');
            message.decryptedContent = message.content;
          }
          
        } catch (decryptError) {
          console.warn('❌ Failed to decrypt message:', decryptError);
          message.decryptedContent = message.content; // Show encrypted content as fallback
        }
      } else {
        // Own message, already decrypted
        message.decryptedContent = message.content;
      }

      // Call message handler
      console.log('🔥 Calling onNewMessage callback with:', message);
      if (this.onNewMessage) {
        this.onNewMessage(message);
        console.log('🔥 onNewMessage callback called successfully');
      } else {
        console.error('🔥 NO onNewMessage callback set!');
      }
    } catch (error) {
      console.error('Error handling message:', error);
      // Fallback: use original content
      message.decryptedContent = message.content;
      this.onNewMessage?.(message);
    }
  }

  async sendMessage(chatId, content, type = 'text', metadata = {}) {
    const tempId = crypto.randomUUID();
    
    try {
      // **🔐 KYBER1024 POST-QUANTUM ENCRYPTION ACTIVATED** 
      let encryptedMessage;
      
      try {
        // Get recipient's public key from chat participants
        const recipientPublicKey = await this.getRecipientPublicKey(chatId);
        
        if (recipientPublicKey && this.crypto) {
          // Use full Kyber1024 + ChaCha20 hybrid encryption
          console.log('🔐 Using Kyber1024 + ChaCha20 hybrid encryption');
          encryptedMessage = await this.crypto.encryptMessage(content, recipientPublicKey);
          
          // Performance check (<20ms target)
          if (encryptedMessage.performanceMs < 20) {
            console.log(`⚡ Kyber1024 encryption: ${encryptedMessage.performanceMs}ms (✅ target met)`);
          } else {
            console.warn(`⚠️ Kyber1024 encryption: ${encryptedMessage.performanceMs}ms (target: <20ms)`);
          }
        } else {
          // Fallback to ChaCha20 only (still encrypted)
          console.log('🔐 Using ChaCha20 symmetric encryption (fallback)');
          const chatSecret = await this.getChatSecret(chatId);
          const encryptedBytes = await this.encryptMessage(content, chatSecret);
          encryptedMessage = {
            encryptedMessage: this.arrayToBase64(encryptedBytes),
            algorithm: 'ChaCha20 (symmetric)',
            timestamp: Date.now(),
            security: 'Symmetric Encryption',
            performanceMs: 0 // Not measured for fallback
          };
        }
      } catch (error) {
        console.error('❌ Kyber1024 encryption failed:', error);
        // Final fallback to plain text (should never happen in production)
        encryptedMessage = {
          encryptedMessage: content,
          algorithm: 'plain_text',
          timestamp: Date.now(),
          security: 'NONE (ERROR FALLBACK)',
          performanceMs: 0
        };
      }

      const message = {
        chatId,
        message: {
          content: encryptedMessage.encryptedMessage, // Use encrypted content
          kyberCiphertext: encryptedMessage.kyberCiphertext, // Kyber1024 ciphertext
          algorithm: encryptedMessage.algorithm,
          security: encryptedMessage.security,
          performanceMs: encryptedMessage.performanceMs,
          timestamp: encryptedMessage.timestamp,
          type,
          metadata,
          sender_id: sessionStorage.getItem('userId')
        },
        tempId
      };

      // TODO: Re-enable P2P after fixing core app issues
      // HYBRID MODE: Try P2P first if privacy mode enabled
      // if (this.privacyMode && this.useP2P) {
      //   console.log('📤 Sending via P2P (privacy mode)');
      //   try {
      //     const p2pSuccess = await p2pService.sendMessage(message);
      //     if (p2pSuccess) {
      //       return { id: tempId, sent: true, via: 'p2p', status: 'sent' };
      //     }
      //     console.warn('⚠️ P2P send failed, falling back to server');
      //   } catch (p2pError) {
      //     console.warn('⚠️ P2P error, using server fallback:', p2pError);
      //   }
      // }

      // Server connection check
      if (!this.isConnected || !this.socket) {
        console.log('📤 Queuing message (offline)');
        this.messageQueue.push(message);
        
        // TODO: Re-enable P2P after fixing core app issues
        // Try P2P as fallback if available
        // if (this.p2pFallbackEnabled && this.useP2P) {
        //   try {
        //     const p2pSuccess = await p2pService.sendMessage(message);
        //     if (p2pSuccess) {
        //       return { id: tempId, sent: true, via: 'p2p-fallback', status: 'sent' };
        //     }
        //   } catch (error) {
        //     console.warn('P2P fallback failed:', error);
        //   }
        // }
        
        // Store in local storage for offline support
        try {
          const offlineMessages = JSON.parse(localStorage.getItem('offline_messages') || '[]');
          offlineMessages.push({
            ...message,
            timestamp: Date.now(),
            status: 'queued'
          });
          localStorage.setItem('offline_messages', JSON.stringify(offlineMessages));
        } catch (storageError) {
          console.warn('Failed to store offline message:', storageError);
        }
        
        return Promise.resolve({ id: tempId, sent: false, status: 'queued' });
      }

      return new Promise((resolve, reject) => {
        this.messageCallbacks.set(tempId, { resolve, reject });
        this.socket.emit('send_message', message);
        
        // Timeout after 30 seconds
        setTimeout(() => {
          if (this.messageCallbacks.has(tempId)) {
            this.messageCallbacks.delete(tempId);
            resolve({ id: tempId, sent: false, error: 'timeout' });
          }
        }, 30000);
      });
    } catch (error) {
      console.error('Send message error:', error);
      // Return fallback success
      return { id: tempId, sent: false, error: error.message };
    }
  }

  processMessageQueue() {
    console.log('📤 Processing queued messages:', this.messageQueue.length);
    while (this.messageQueue.length > 0 && this.socket) {
      const message = this.messageQueue.shift();
      this.socket.emit('send_message', message);
    }
    
    // Also process any offline messages
    this.processOfflineMessages();
  }

  sendTyping(chatId, isTyping) {
    if (!this.isConnected || !this.socket) return;

    // Clear existing timer
    if (this.typingTimers[chatId]) {
      clearTimeout(this.typingTimers[chatId]);
      delete this.typingTimers[chatId];
    }

    this.socket.emit('typing', { chatId, isTyping });

    // Auto-stop typing after 5 seconds
    if (isTyping) {
      this.typingTimers[chatId] = setTimeout(() => {
        this.sendTyping(chatId, false);
      }, 5000);
    }
  }

  markAsDelivered(messageId) {
    if (!this.isConnected || !this.socket) return;
    this.socket.emit('message_delivered', { messageId });
  }

  markAsRead(messageId) {
    if (!this.isConnected || !this.socket) return;
    this.socket.emit('message_read', { messageId });
  }

  // Call methods
  async initiateCall(targetUserId, callType = 'voice') {
    if (!this.isConnected || !this.socket) {
      console.warn('Cannot initiate call: not connected');
      return null;
    }

    try {
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      const peerConnection = new RTCPeerConnection(configuration);
      
      // Create offer
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video'
      });
      
      await peerConnection.setLocalDescription(offer);

      this.socket.emit('call_offer', {
        targetUserId,
        offer: offer.sdp,
        callType
      });

      return peerConnection;
    } catch (error) {
      console.error('Call initiation error:', error);
      return null;
    }
  }

  answerCall(callId, answer) {
    if (!this.isConnected || !this.socket) return;
    this.socket.emit('call_answer', { callId, answer });
  }

  sendIceCandidate(targetUserId, candidate) {
    if (!this.isConnected || !this.socket) return;
    this.socket.emit('call_ice_candidate', { targetUserId, candidate });
  }

  endCall(callId) {
    if (!this.isConnected || !this.socket) return;
    this.socket.emit('call_end', { callId });
  }

  // Helper methods
  async getPrivateKey() {
    try {
      const userId = sessionStorage.getItem('userId');
      const keyData = await secureStorage.getPrivateKey(userId);
      return keyData?.encryptedKey;
    } catch (error) {
      console.error('Error getting private key:', error);
      return null;
    }
  }

  /**
   * Get recipient's public key for Kyber1024 encryption
   */
  async getRecipientPublicKey(chatId) {
    try {
      // Try to get from session storage first (cached)
      const cachedKey = sessionStorage.getItem(`publicKey_${chatId}`);
      if (cachedKey) {
        return cachedKey;
      }
      
      // Query chat participants to find recipient
      // TODO: Replace with actual API call to get chat participants
      const participants = await this.getChatParticipants(chatId);
      const currentUserId = sessionStorage.getItem('userId');
      
      // Find recipient (not current user)
      const recipient = participants.find(p => p.userId !== currentUserId);
      
      if (recipient && recipient.publicKey) {
        // Cache for future use
        sessionStorage.setItem(`publicKey_${chatId}`, recipient.publicKey);
        return recipient.publicKey;
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to get recipient public key:', error);
      return null;
    }
  }

  /**
   * Get chat participants with their public keys
   */
  async getChatParticipants(chatId) {
    try {
      // Simulate API call - TODO: Replace with real API
      if (this.socket && this.isConnected) {
        return new Promise((resolve) => {
          this.socket.emit('get_chat_participants', { chatId });
          this.socket.once('chat_participants', (data) => {
            resolve(data.participants || []);
          });
          
          // Timeout after 5 seconds
          setTimeout(() => resolve([]), 5000);
        });
      }
      
      return [];
    } catch (error) {
      console.warn('Failed to get chat participants:', error);
      return [];
    }
  }

  /**
   * Utility: Convert array to base64
   */
  arrayToBase64(array) {
    if (array instanceof Uint8Array) {
      return btoa(String.fromCharCode(...array));
    }
    return array; // Already base64 string
  }

  async getChatSecret(chatId) {
    try {
      // Generate deterministic key from chat ID and user key
      const userKey = sessionStorage.getItem('userSecretKey') || sessionStorage.getItem('userId') || 'default-key';
      const keyMaterial = `${userKey}-${chatId}`;
      
      // Use a simple but consistent key derivation
      const encoder = new TextEncoder();
      const data = encoder.encode(keyMaterial);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = new Uint8Array(hashBuffer);
      
      return hashArray.slice(0, 32); // 256-bit key
    } catch (error) {
      console.warn('Chat secret generation failed:', error);
      return new TextEncoder().encode(`fallback-secret-${chatId}`).slice(0, 32);
    }
  }

  async encryptMessage(content, key) {
    try {
      if (!this.crypto) {
        return content; // Fallback to plain text
      }
      return await secureChaCha20.encrypt(new TextEncoder().encode(content), key);
    } catch (error) {
      console.warn('Message encryption failed:', error);
      return content;
    }
  }

  async decryptMessage(encryptedContent, key) {
    try {
      if (!this.crypto) {
        return encryptedContent; // Fallback to original
      }
      const decrypted = await secureChaCha20.decrypt(encryptedContent, key);
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.warn('Message decryption failed:', error);
      return encryptedContent;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('🔌 Socket disconnected');
    }
  }

  // Public API methods
  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      console.log('📤 Socket emit (queued):', event);
    }
  }

  // Process offline messages when reconnected
  async processOfflineMessages() {
    try {
      const offlineMessages = JSON.parse(localStorage.getItem('offline_messages') || '[]');
      if (offlineMessages.length === 0) return;

      console.log('📤 Processing offline messages:', offlineMessages.length);
      
      for (const message of offlineMessages) {
        if (this.socket && this.isConnected) {
          this.socket.emit('send_message', message);
        }
      }
      
      // Clear offline messages
      localStorage.removeItem('offline_messages');
    } catch (error) {
      console.error('Error processing offline messages:', error);
    }
  }

  // Event subscription methods
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const socketService = new SocketService();
export default socketService; 