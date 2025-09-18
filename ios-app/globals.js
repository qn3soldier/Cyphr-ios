/**
 * Global polyfills for React Native
 * Required for crypto libraries that expect Node.js environment
 */

import { Buffer } from 'buffer';
import process from 'process/browser';

// Make Buffer and process global
global.Buffer = Buffer;
global.process = process;

// Polyfill crypto module
global.crypto = require('crypto-browserify');

// Polyfill stream module
global.stream = require('stream-browserify');

// Make require work for polyfills
const originalRequire = global.require || (() => {});
global.require = (module) => {
  switch(module) {
    case 'crypto': return global.crypto;
    case 'stream': return global.stream;
    case 'buffer': return { Buffer: global.Buffer };
    case 'process': return global.process;
    case 'events': return require('events');
    case 'util': return require('util');
    case 'string_decoder': return require('string_decoder');
    case 'inherits': return require('inherits');
    case 'safe-buffer': return require('safe-buffer');
    default: return originalRequire(module);
  }
};

console.log('✅ Global polyfills loaded for enterprise crypto libraries');