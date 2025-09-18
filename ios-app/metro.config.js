const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Node.js polyfills for crypto libraries
config.resolver.alias = {
  crypto: 'crypto-browserify',
  stream: 'stream-browserify',
  buffer: 'buffer',
  process: 'process/browser',
};

// Add WASM support for post-quantum cryptography
config.resolver.assetExts.push('wasm');

// Add support for .ts/.tsx imports without extensions
config.resolver.sourceExts.push('ts', 'tsx');

module.exports = config;