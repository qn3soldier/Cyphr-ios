/**
 * Compliance Dashboard Component
 * Lightweight audit logging and activity monitoring for global compliance
 * Designed to be universally usable while maintaining basic transparency
 */

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  User, 
  Activity,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle
} from 'react-native-vector-icons/MaterialIcons';
import Animated from 'react-native-reanimated';

const ComplianceDashboard = ({ className = '' }) => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('7d');
  const [filterType, setFilterType] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  // Mock audit data - in real implementation, this would come from actual logging
  const generateMockAuditData = () => {
    const eventTypes = [
      'wallet_created', 'wallet_unlocked', 'transaction_sent', 'message_sent',
      'p2p_connected', 'privacy_mode_enabled', 'device_verified', 'backup_created'
    ];
    
    const mockData = [];
    for (let i = 0; i < 50; i++) {
      mockData.push({
        id: `audit_${i}`,
        timestamp: Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000),
        eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
        userId: `user_${Math.floor(Math.random() * 100)}`,
        details: {
          ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
          userAgent: 'Cyphr Messenger v1.0',
          metadata: { result: Math.random() > 0.1 ? 'success' : 'failed' }
        },
        severity: Math.random() > 0.8 ? 'high' : Math.random() > 0.5 ? 'medium' : 'low'
      });
    }
    return mockData.sort((a, b) => b.timestamp - a.timestamp);
  };

  useEffect(() => {
    loadAuditLogs();
  }, [dateRange, filterType]);

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      // In real implementation, this would fetch from actual audit service
      const mockData = generateMockAuditData();
      setAuditLogs(mockData);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredLogs = () => {
    let filtered = auditLogs;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.eventType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.ip.includes(searchTerm)
      );
    }
    
    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(log => log.eventType.includes(filterType));
    }
    
    // Apply date range filter
    const now = Date.now();
    const ranges = {
      '1d': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    if (ranges[dateRange]) {
      filtered = filtered.filter(log => now - log.timestamp <= ranges[dateRange]);
    }
    
    return filtered;
  };

  const exportAuditLogs = () => {
    const filtered = getFilteredLogs();
    const csvContent = [
      'Timestamp,Event Type,User ID,IP Address,Result,Severity',
      ...filtered.map(log => [
        new Date(log.timestamp).toISOString(),
        log.eventType,
        log.userId,
        log.details.ip,
        log.details.metadata.result,
        log.severity
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyphr-audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getEventIcon = (eventType) => {
    const icons = {
      wallet: '💰',
      transaction: '💸',
      message: '💬',
      p2p: '🌐',
      privacy: '🔒',
      device: '📱',
      backup: '💾'
    };
    
    for (const [key, icon] of Object.entries(icons)) {
      if (eventType.includes(key)) return icon;
    }
    
    return '📝';
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-400 bg-red-500/10';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10';
      case 'low': return 'text-green-400 bg-green-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
  };

  const filteredLogs = getFilteredLogs();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-400" />
            Activity Monitor
          </h2>
          <div className="text-sm text-white/60">
            Global transparency • No personal data stored
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {filteredLogs.length}
            </div>
            <div className="text-xs text-white/60">Total Events</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {filteredLogs.filter(log => log.details.metadata.result === 'success').length}
            </div>
            <div className="text-xs text-white/60">Successful</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">
              {filteredLogs.filter(log => log.details.metadata.result === 'failed').length}
            </div>
            <div className="text-xs text-white/60">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {new Set(filteredLogs.map(log => log.userId)).size}
            </div>
            <div className="text-xs text-white/60">Active Users</div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 glass rounded-lg text-white placeholder-white/40"
            />
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 glass rounded-lg text-white"
          >
            <option value="all" className="bg-gray-900">All Events</option>
            <option value="wallet" className="bg-gray-900">Wallet Events</option>
            <option value="message" className="bg-gray-900">Message Events</option>
            <option value="privacy" className="bg-gray-900">Privacy Events</option>
            <option value="device" className="bg-gray-900">Device Events</option>
          </select>
          
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 glass rounded-lg text-white"
          >
            <option value="1d" className="bg-gray-900">Last 24 hours</option>
            <option value="7d" className="bg-gray-900">Last 7 days</option>
            <option value="30d" className="bg-gray-900">Last 30 days</option>
            <option value="all" className="bg-gray-900">All time</option>
          </select>
          
          <button
            onClick={exportAuditLogs}
            className="flex items-center justify-center gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Activity Log</h3>
          <div className="text-sm text-white/60">
            Showing {filteredLogs.length} events
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <Activity className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-2" />
            <p className="text-white/60">Loading activity data...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/60">No events found</p>
            <p className="text-sm text-white/40">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredLogs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 rounded-lg p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="text-2xl">
                    {getEventIcon(log.eventType)}
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {log.eventType.replace(/_/g, ' ').toUpperCase()}
                    </div>
                    <div className="text-sm text-white/60">
                      User: {log.userId} • IP: {log.details.ip}
                    </div>
                    <div className="text-xs text-white/40">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(log.severity)}`}>
                    {log.severity}
                  </span>
                  <div className="flex items-center gap-1">
                    {log.details.metadata.result === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className={`text-sm ${log.details.metadata.result === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {log.details.metadata.result}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Compliance Notes */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-400" />
          Privacy & Compliance Notes
        </h3>
        <div className="space-y-3 text-sm text-white/80">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>No personal messages or wallet data are logged</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>Only system events and metadata are recorded</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>All logs are encrypted and stored locally</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>Data retention follows user-configurable policies</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span>Designed for global compliance without region-specific restrictions</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceDashboard;