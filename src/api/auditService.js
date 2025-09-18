/**
 * Audit Service - Lightweight Activity Logging
 * Global compliance-friendly audit logging without region-specific requirements
 * Focuses on transparency and basic activity monitoring
 */

class AuditService {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000; // Keep last 1000 logs
    this.isEnabled = true;
    this.retentionDays = 30; // Default 30-day retention
    this.excludePatterns = []; // Patterns to exclude from logging
  }

  /**
   * Initialize audit service
   */
  initialize(config = {}) {
    this.isEnabled = config.enabled !== false;
    this.maxLogs = config.maxLogs || this.maxLogs;
    this.retentionDays = config.retentionDays || this.retentionDays;
    this.excludePatterns = config.excludePatterns || [];
    
    // Load existing logs from storage
    this.loadLogs();
    
    // Set up periodic cleanup
    this.startCleanupSchedule();
    
    console.log('📋 Audit service initialized');
  }

  /**
   * Log an audit event
   */
  log(eventType, details = {}, severity = 'low') {
    if (!this.isEnabled) return;
    
    // Check if event should be excluded
    if (this.shouldExclude(eventType)) return;
    
    const logEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      eventType: this.sanitizeEventType(eventType),
      details: this.sanitizeDetails(details),
      severity: this.validateSeverity(severity),
      sessionId: this.getSessionId(),
      userAgent: this.getUserAgent(),
      version: '1.0'
    };
    
    this.logs.unshift(logEntry);
    
    // Maintain log size limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    
    // Save to storage (debounced)
    this.debouncedSave();
    
    console.log(`📝 Audit: ${eventType}`, logEntry);
  }

  /**
   * Log wallet-related events
   */
  logWalletEvent(action, details = {}) {
    this.log(`wallet_${action}`, {
      ...details,
      category: 'wallet'
    }, action.includes('error') ? 'high' : 'medium');
  }

  /**
   * Log security-related events
   */
  logSecurityEvent(action, details = {}) {
    this.log(`security_${action}`, {
      ...details,
      category: 'security'
    }, 'high');
  }

  /**
   * Log privacy-related events
   */
  logPrivacyEvent(action, details = {}) {
    this.log(`privacy_${action}`, {
      ...details,
      category: 'privacy'
    }, 'medium');
  }

  /**
   * Log system events
   */
  logSystemEvent(action, details = {}) {
    this.log(`system_${action}`, {
      ...details,
      category: 'system'
    }, 'low');
  }

  /**
   * Get filtered logs
   */
  getLogs(filters = {}) {
    let filtered = [...this.logs];
    
    // Apply date range filter
    if (filters.startDate || filters.endDate) {
      const start = filters.startDate ? new Date(filters.startDate).getTime() : 0;
      const end = filters.endDate ? new Date(filters.endDate).getTime() : Date.now();
      
      filtered = filtered.filter(log => 
        log.timestamp >= start && log.timestamp <= end
      );
    }
    
    // Apply event type filter
    if (filters.eventType) {
      filtered = filtered.filter(log => 
        log.eventType.includes(filters.eventType)
      );
    }
    
    // Apply severity filter
    if (filters.severity) {
      filtered = filtered.filter(log => log.severity === filters.severity);
    }
    
    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(log =>
        log.eventType.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.details).toLowerCase().includes(searchLower)
      );
    }
    
    // Apply limit
    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }
    
    return filtered;
  }

  /**
   * Export logs to CSV format
   */
  exportLogs(filters = {}) {
    const logs = this.getLogs(filters);
    
    const headers = [
      'Timestamp',
      'Date',
      'Event Type',
      'Category',
      'Severity',
      'Session ID',
      'Details'
    ];
    
    const rows = logs.map(log => [
      log.timestamp,
      new Date(log.timestamp).toISOString(),
      log.eventType,
      log.details.category || 'unknown',
      log.severity,
      log.sessionId?.substring(0, 8) || 'unknown',
      JSON.stringify(log.details).replace(/"/g, '""') // Escape quotes for CSV
    ]);
    
    return [headers, ...rows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
  }

  /**
   * Get audit statistics
   */
  getStatistics(days = 7) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentLogs = this.logs.filter(log => log.timestamp >= cutoff);
    
    const stats = {
      totalEvents: recentLogs.length,
      byEventType: {},
      bySeverity: {},
      byCategory: {},
      byDay: {},
      errorRate: 0
    };
    
    recentLogs.forEach(log => {
      // Count by event type
      stats.byEventType[log.eventType] = (stats.byEventType[log.eventType] || 0) + 1;
      
      // Count by severity
      stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
      
      // Count by category
      const category = log.details.category || 'unknown';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      
      // Count by day
      const day = new Date(log.timestamp).toDateString();
      stats.byDay[day] = (stats.byDay[day] || 0) + 1;
    });
    
    // Calculate error rate
    const errorEvents = recentLogs.filter(log => 
      log.eventType.includes('error') || 
      log.eventType.includes('failed') ||
      log.severity === 'high'
    ).length;
    
    stats.errorRate = recentLogs.length > 0 ? 
      Math.round((errorEvents / recentLogs.length) * 100) : 0;
    
    return stats;
  }

  /**
   * Clear old logs based on retention policy
   */
  cleanupOldLogs() {
    const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
    const beforeCount = this.logs.length;
    
    this.logs = this.logs.filter(log => log.timestamp >= cutoff);
    
    const removed = beforeCount - this.logs.length;
    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} old audit logs`);
      this.debouncedSave();
    }
  }

  /**
   * Private helper methods
   */
  
  generateLogId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
  
  sanitizeEventType(eventType) {
    // Remove any sensitive information from event type
    return eventType.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  }
  
  sanitizeDetails(details) {
    // Remove sensitive fields and sanitize data
    const sanitized = { ...details };
    
    // Remove common sensitive fields
    const sensitiveFields = [
      'password', 'pin', 'seed', 'privateKey', 'mnemonic', 
      'secret', 'token', 'auth', 'credential'
    ];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    // Limit detail size
    const detailString = JSON.stringify(sanitized);
    if (detailString.length > 1000) {
      return { summary: 'Large details object', size: detailString.length };
    }
    
    return sanitized;
  }
  
  validateSeverity(severity) {
    const validSeverities = ['low', 'medium', 'high'];
    return validSeverities.includes(severity) ? severity : 'low';
  }
  
  shouldExclude(eventType) {
    return this.excludePatterns.some(pattern => 
      new RegExp(pattern).test(eventType)
    );
  }
  
  getSessionId() {
    // Get or create session ID
    let sessionId = sessionStorage.getItem('cyphr_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      sessionStorage.setItem('cyphr_session_id', sessionId);
    }
    return sessionId;
  }
  
  getUserAgent() {
    return navigator.userAgent?.substring(0, 100) || 'unknown';
  }
  
  loadLogs() {
    try {
      const stored = localStorage.getItem('cyphr_audit_logs');
      if (stored) {
        this.logs = JSON.parse(stored);
        console.log(`📋 Loaded ${this.logs.length} audit logs from storage`);
      }
    } catch (error) {
      console.error('❌ Failed to load audit logs:', error);
      this.logs = [];
    }
  }
  
  saveLogs() {
    try {
      localStorage.setItem('cyphr_audit_logs', JSON.stringify(this.logs));
    } catch (error) {
      console.error('❌ Failed to save audit logs:', error);
    }
  }
  
  debouncedSave() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.saveLogs(), 1000);
  }
  
  startCleanupSchedule() {
    // Clean up old logs every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldLogs();
    }, 60 * 60 * 1000);
  }
  
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveLogs(); // Final save
  }
}

// Create singleton instance
export const auditService = new AuditService();

// Auto-initialize with default settings
auditService.initialize({
  enabled: true,
  maxLogs: 1000,
  retentionDays: 30,
  excludePatterns: [
    'heartbeat',
    'ping',
    'typing_indicator'
  ]
});

export default auditService;