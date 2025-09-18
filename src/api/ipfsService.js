/**
 * IPFS Service for Decentralized Storage
 * Uses Helia (modern IPFS) for encrypted wallet seed backup and metadata protection
 * Part of Cyphr's anti-СОРМ security measures (Phase 4)
 */

import { createHelia } from 'helia';
import { unixfs } from '@helia/unixfs';
import { dagCbor } from '@helia/dag-cbor';
import { secureChaCha20 } from './crypto/secureChaCha20.ts';
import { secureStorage } from './secureStorage.js';

class IPFSService {
  constructor() {
    this.helia = null;
    this.fs = null;
    this.cbor = null;
    this.isInitialized = false;
    this.pins = new Map(); // Track pinned content
    this.encryptionKey = null;
  }

  /**
   * Initialize Helia IPFS node
   */
  async initialize() {
    if (this.isInitialized) return true;

    try {
      // TODO: Re-enable IPFS after fixing core app issues
      console.log('📴 IPFS temporarily disabled during initialization');
      
      // // Create Helia node with minimal browser configuration
      // this.helia = await createHelia({
      //   // Remove all libp2p config - let Helia use browser defaults
      // });

      // // Initialize filesystem and DAG interfaces
      // this.fs = unixfs(this.helia);
      // this.cbor = dagCbor(this.helia);

      // // Generate or load encryption key for IPFS data
      // await this.initializeEncryption();

      this.isInitialized = false; // Keep disabled
      console.log('📴 IPFS node disabled');
      // console.log('📍 Peer ID:', this.helia.libp2p.peerId.toString());

      return false; // Return false to indicate disabled
    } catch (error) {
      console.error('❌ IPFS initialization failed:', error);
      return false;
    }
  }

  /**
   * Initialize encryption for IPFS data
   */
  async initializeEncryption() {
    try {
      // Try to load existing key
      const storedKey = await secureStorage.getItem('ipfs_encryption_key');
      
      if (storedKey) {
        this.encryptionKey = new Uint8Array(storedKey);
      } else {
        // Generate new 256-bit key
        this.encryptionKey = crypto.getRandomValues(new Uint8Array(32));
        await secureStorage.setItem('ipfs_encryption_key', Array.from(this.encryptionKey));
      }

      console.log('🔐 IPFS encryption key ready');
    } catch (error) {
      console.error('❌ IPFS encryption init failed:', error);
      // Fallback to session key
      this.encryptionKey = crypto.getRandomValues(new Uint8Array(32));
    }
  }

  /**
   * Stop IPFS node
   */
  async stop() {
    if (this.helia) {
      await this.helia.stop();
      this.isInitialized = false;
      console.log('⏹️ IPFS node stopped');
    }
  }

  /**
   * Store encrypted wallet seed on IPFS
   */
  async storeWalletSeed(userId, encryptedSeed, metadata = {}) {
    // TODO: Re-enable IPFS after fixing core app issues
    console.log('📴 IPFS storeWalletSeed temporarily disabled for user:', userId);
    return {
      success: false,
      error: 'IPFS temporarily disabled'
    };

    // if (!this.isInitialized) {
    //   await this.initialize();
    // }

    try {
      console.log('💾 Storing encrypted wallet seed on IPFS...');

      // Get device ID for conflict resolution
      const deviceId = await this.getDeviceId();

      // Create wallet backup object
      const walletBackup = {
        userId,
        encryptedSeed,
        metadata: {
          ...metadata,
          timestamp: Date.now(),
          version: '1.0.0',
          deviceId,
          syncVersion: this.generateSyncVersion()
        }
      };

      // Double encrypt for IPFS storage - ensure encryption key exists
      if (!this.encryptionKey) {
        await this.initializeEncryption();
      }
      
      const walletData = JSON.stringify(walletBackup);
      const encryptedData = await secureChaCha20.encrypt(
        new TextEncoder().encode(walletData),
        this.encryptionKey
      );

      // Store on IPFS using DAG-CBOR
      const cid = await this.cbor.add({
        type: 'cyphr-wallet-backup',
        data: Array.from(encryptedData),
        userId
      });

      // Pin the content to prevent garbage collection
      await this.helia.pins.add(cid);
      this.pins.set(userId, cid.toString());

      console.log('✅ Wallet seed stored on IPFS:', cid.toString());
      
      // Notify about sync event
      this.notifySyncEvent({
        type: 'wallet_backup_created',
        userId,
        cid: cid.toString(),
        deviceId,
        timestamp: walletBackup.metadata.timestamp
      });
      
      return {
        cid: cid.toString(),
        success: true,
        metadata: walletBackup.metadata
      };

    } catch (error) {
      console.error('❌ IPFS wallet storage failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retrieve encrypted wallet seed from IPFS
   */
  async retrieveWalletSeed(userId, cid) {
    // TODO: Re-enable IPFS after fixing core app issues
    console.log('📴 IPFS retrieveWalletSeed temporarily disabled for user:', userId);
    return {
      success: false,
      error: 'IPFS temporarily disabled'
    };

    // if (!this.isInitialized) {
    //   await this.initialize();
    // }

    try {
      console.log('📥 Retrieving wallet seed from IPFS...');

      // If no CID provided, try to find latest backup
      if (!cid) {
        cid = this.pins.get(userId);
        if (!cid) {
          throw new Error('No IPFS backup found for user');
        }
      }

      // Retrieve from IPFS
      const walletObject = await this.cbor.get(cid);
      
      if (walletObject.userId !== userId) {
        throw new Error('User ID mismatch in IPFS backup');
      }

      // Decrypt the data
      const encryptedData = new Uint8Array(walletObject.data);
      const decryptedData = await secureChaCha20.decrypt(
        encryptedData,
        this.encryptionKey
      );

      const walletBackup = JSON.parse(new TextDecoder().decode(decryptedData));

      console.log('✅ Wallet seed retrieved from IPFS');
      
      return {
        success: true,
        encryptedSeed: walletBackup.encryptedSeed,
        metadata: walletBackup.metadata
      };

    } catch (error) {
      console.error('❌ IPFS wallet retrieval failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Store arbitrary encrypted data on IPFS
   */
  async storeData(key, data, metadata = {}) {
    // TODO: Re-enable IPFS after fixing core app issues
    console.log('📴 IPFS storeData temporarily disabled for key:', key);
    return {
      success: false,
      error: 'IPFS temporarily disabled'
    };

    // if (!this.isInitialized) {
    //   await this.initialize();
    // }

    // try {
    //   const dataObject = {
    //     key,
    //     data,
    //     metadata: {
    //       ...metadata,
    //       timestamp: Date.now()
    //     }
    //   };

    //   // Encrypt before storing - ensure encryption key exists
    //   if (!this.encryptionKey) {
    //     await this.initializeEncryption();
    //   }
    //   
    //   const jsonData = JSON.stringify(dataObject);
    //   const encryptedData = await secureChaCha20.encrypt(
    //     new TextEncoder().encode(jsonData),
    //     this.encryptionKey
    //   );

    //   // Store using UnixFS for file-like data
    //   const cid = await this.fs.addBytes(encryptedData);
    //   
    //   // Pin the content
    //   await this.helia.pins.add(cid);
    //   this.pins.set(key, cid.toString());

    //   console.log('✅ Data stored on IPFS:', cid.toString());
    //   
    //   return {
    //     cid: cid.toString(),
    //     success: true
    //   };

    // } catch (error) {
    //   console.error('❌ IPFS data storage failed:', error);
    //   return {
    //     success: false,
    //     error: error.message
    //   };
    // }
  }

  /**
   * Retrieve arbitrary encrypted data from IPFS
   */
  async retrieveData(key, cid) {
    // TODO: Re-enable IPFS after fixing core app issues
    console.log('📴 IPFS retrieveData temporarily disabled for key:', key);
    return {
      success: false,
      error: 'IPFS temporarily disabled'
    };

    // if (!this.isInitialized) {
    //   await this.initialize();
    // }

    try {
      // If no CID provided, try to find by key
      if (!cid) {
        cid = this.pins.get(key);
        if (!cid) {
          throw new Error(`No IPFS data found for key: ${key}`);
        }
      }

      // Retrieve from IPFS
      const encryptedData = new Uint8Array();
      const chunks = [];
      
      for await (const chunk of this.fs.cat(cid)) {
        chunks.push(chunk);
      }
      
      const fullData = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        fullData.set(chunk, offset);
        offset += chunk.length;
      }

      // Decrypt the data
      const decryptedData = await secureChaCha20.decrypt(
        fullData,
        this.encryptionKey
      );

      const dataObject = JSON.parse(new TextDecoder().decode(decryptedData));

      console.log('✅ Data retrieved from IPFS');
      
      return {
        success: true,
        data: dataObject.data,
        metadata: dataObject.metadata
      };

    } catch (error) {
      console.error('❌ IPFS data retrieval failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List all pinned content for current user
   */
  async listBackups() {
    const backups = [];
    
    for (const [key, cid] of this.pins.entries()) {
      backups.push({
        key,
        cid,
        pinned: true
      });
    }

    return backups;
  }

  /**
   * Remove content from IPFS (unpin)
   */
  async removeData(key) {
    try {
      const cid = this.pins.get(key);
      if (cid) {
        await this.helia.pins.rm(cid);
        this.pins.delete(key);
        console.log('🗑️ Removed from IPFS:', cid);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ IPFS removal failed:', error);
      return false;
    }
  }

  /**
   * Get IPFS node status
   */
  getStatus() {
    if (!this.helia) {
      return {
        isInitialized: false,
        peers: 0,
        pinnedContent: 0
      };
    }

    return {
      isInitialized: this.isInitialized,
      peerId: this.helia.libp2p.peerId.toString(),
      peers: this.helia.libp2p.getConnections().length,
      pinnedContent: this.pins.size,
      version: 'Helia 5.x'
    };
  }

  /**
   * Get device ID for sync tracking
   */
  async getDeviceId() {
    try {
      let deviceId = localStorage.getItem('cyphr_device_id');
      
      if (!deviceId) {
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
   * Generate sync version for conflict resolution
   */
  generateSyncVersion() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * Set sync event callback for notifications
   */
  setSyncCallback(callback) {
    this.syncCallback = callback;
  }

  /**
   * Notify about sync events
   */
  notifySyncEvent(event) {
    if (this.syncCallback) {
      try {
        this.syncCallback(event);
      } catch (error) {
        console.error('❌ Sync callback failed:', error);
      }
    }
  }

  /**
   * Connect to IPFS bootstrap nodes
   */
  async connectToBootstraps() {
    if (!this.helia) return;

    const bootstraps = [
      '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZKMIiGdpyAhsD1f4Cz2aMBv4n8JjwZ',
      '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa'
    ];

    for (const addr of bootstraps) {
      try {
        await this.helia.libp2p.dial(addr);
        console.log('🔗 Connected to IPFS bootstrap:', addr);
      } catch (error) {
        console.warn('⚠️ Bootstrap connection failed:', addr);
      }
    }
  }
}

// Create singleton instance
export const ipfsService = new IPFSService();
export default ipfsService;