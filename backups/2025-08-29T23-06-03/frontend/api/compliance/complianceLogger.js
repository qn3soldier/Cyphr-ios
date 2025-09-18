/**
 * Compliance Logger for Cyphr Messenger
 * Auto-selects browser or Node.js implementation
 */

// Browser environment - use lightweight version
export { complianceLogger, default } from './browserComplianceLogger.js';