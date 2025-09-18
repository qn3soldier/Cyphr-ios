/**
 * Browser-compatible Compliance Logger for Cyphr Messenger
 * Lightweight version without Node.js dependencies
 */

import { ipfsService } from '../ipfsService.js';

class BrowserComplianceLogger {
  constructor() {
    this.logBatch = [];
    this.batchSize = 10;
    this.batchTimeout = 30000; // 30 seconds
    this.batchTimer = null;
    this.sensitiveFields = ['pin', 'password', 'mnemonic', 'privateKey', 'seed'];
  }

  log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata: this.sanitizeData(metadata),
      compliance: true
    };

    // Console output for development
    if (level === 'error') {
      console.error(`[ComplianceLogger] ${message}`, metadata);
    } else if (level === 'warn') {
      console.warn(`[ComplianceLogger] ${message}`, metadata);
    } else {
      console.log(`[ComplianceLogger] ${message}`, metadata);
    }

    // Add to batch
    this.logBatch.push(logEntry);

    // Process batch if full or start timer
    if (this.logBatch.length >= this.batchSize) {
      this.processBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.batchTimeout);
    }
  }

  async processBatch() {
    if (this.logBatch.length === 0) return;

    try {
      const batchId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const auditBatch = {
        batchId,
        timestamp: new Date().toISOString(),
        logs: [...this.logBatch],
        compliance: true,
        retention: '7_years'
      };

      // TODO: Re-enable IPFS after fixing core app issues
      // Store encrypted audit logs on IPFS
      // const result = await ipfsService.storeData(batchId, auditBatch, {
      //   type: 'compliance_audit',
      //   batchSize: this.logBatch.length,
      //   complianceLevel: 'AML_KYC'
      // });

      const result = { success: false, error: 'IPFS temporarily disabled' };

      if (result.success) {
        console.log(`📋 Audit batch ${batchId} stored on IPFS: ${result.cid}`);
      } else {
        // Fallback: store locally
        localStorage.setItem(`audit_backup_${batchId}`, JSON.stringify(auditBatch));
      }

      // Clear batch
      this.logBatch = [];
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }
    } catch (error) {
      console.error('❌ Audit batch processing failed:', error);
    }
  }

  sanitizeData(data) {
    if (!data || typeof data !== 'object') return data;

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (this.sensitiveFields.includes(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  // Authentication logging
  logAuthentication(userId, action, success, metadata = {}) {
    this.log('info', `Authentication: ${action}`, {
      userId,
      action,
      success,
      ...this.sanitizeData(metadata),
      category: 'AUTHENTICATION',
      compliance: true
    });
  }

  // Transaction logging
  logTransaction(userId, transactionData) {
    this.log('info', 'Transaction executed', {
      userId,
      ...this.sanitizeData(transactionData),
      category: 'TRANSACTION',
      compliance: true
    });
  }

  // Wallet operations
  logWalletCreation(userId, metadata = {}) {
    this.log('info', 'Wallet created', {
      userId,
      ...this.sanitizeData(metadata),
      category: 'WALLET',
      compliance: true
    });
  }

  // Privacy mode changes
  logPrivacyMode(userId, enabled, metadata = {}) {
    this.log('info', `Privacy mode ${enabled ? 'enabled' : 'disabled'}`, {
      userId,
      enabled,
      ...metadata,
      category: 'PRIVACY',
      compliance: true
    });
  }

  // Multi-sig operations
  logMultiSigCreation(userId, metadata = {}) {
    this.log('info', 'Multi-signature wallet created', {
      userId,
      ...this.sanitizeData(metadata),
      category: 'MULTISIG',
      compliance: true
    });
  }

  logMultiSigSignerAdded(userId, metadata = {}) {
    this.log('info', 'Signer added to multi-sig wallet', {
      userId,
      ...this.sanitizeData(metadata),
      category: 'MULTISIG',
      compliance: true
    });
  }

  logMultiSigSignerRemoved(userId, metadata = {}) {
    this.log('info', 'Signer removed from multi-sig wallet', {
      userId,
      ...this.sanitizeData(metadata),
      category: 'MULTISIG',
      compliance: true
    });
  }

  logMultiSigTransactionInitiated(userId, metadata = {}) {
    this.log('info', 'Multi-sig transaction initiated', {
      userId,
      ...this.sanitizeData(metadata),
      category: 'MULTISIG',
      compliance: true
    });
  }

  logMultiSigTransactionSigned(userId, metadata = {}) {
    this.log('info', 'Multi-sig transaction signed', {
      userId,
      ...this.sanitizeData(metadata),
      category: 'MULTISIG',
      compliance: true
    });
  }

  logMultiSigTransactionExecuted(userId, metadata = {}) {
    this.log('info', 'Multi-sig transaction executed', {
      userId,
      ...this.sanitizeData(metadata),
      category: 'MULTISIG',
      compliance: true
    });
  }

  // Hardware wallet operations
  logHardwareWalletConnection(userId, metadata = {}) {
    this.log('info', 'Hardware wallet connected', {
      userId,
      ...this.sanitizeData(metadata),
      category: 'HARDWARE',
      compliance: true
    });
  }

  logHardwareWalletSigning(userId, metadata = {}) {
    this.log('info', 'Hardware wallet transaction signed', {
      userId,
      ...this.sanitizeData(metadata),
      category: 'HARDWARE',
      compliance: true
    });
  }

  // Get compliance status
  getComplianceStatus() {
    return {
      serviceName: 'cyphr-messenger',
      complianceActive: true,
      auditLogActive: true,
      retentionPeriod: '7_years',
      ipfsBackup: ipfsService.isInitialized,
      pendingLogs: this.logBatch.length,
      categories: ['AUTHENTICATION', 'TRANSACTION', 'WALLET', 'PRIVACY', 'MULTISIG', 'HARDWARE']
    };
  }
}

// Export singleton instance
export const complianceLogger = new BrowserComplianceLogger();
export default complianceLogger;