/**
 * 🚀 PATCH: ADD DISCOVERY ROUTES TO MAIN SERVER
 * Integrates revolutionary discovery system into existing backend
 */

const fs = require('fs');

// Read existing server.cjs
const serverPath = '/var/www/cyphr/server.cjs';
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Discovery endpoints integration code
const discoveryIntegration = `
// 🚀 CYPHR DISCOVERY SYSTEM INTEGRATION
const discoveryEndpoints = require('./discovery-api-endpoints.cjs');

// =============================================================================
// DISCOVERY API ROUTES
// =============================================================================

// 🆔 CYPHR ID ROUTES
app.post('/api/discovery/check-cyphr-id', discoveryEndpoints.checkCyphrIdAvailable);
app.post('/api/discovery/set-cyphr-id', discoveryEndpoints.setCyphrId);
app.get('/api/discovery/search-cyphr-id/:cyphrId', discoveryEndpoints.searchByCyphrId);

// 📱 QR CODE ROUTES
app.post('/api/discovery/generate-qr-token', discoveryEndpoints.generateQRToken);
app.post('/api/discovery/scan-qr-token', discoveryEndpoints.scanQRToken);

// 🔗 SHARE LINK ROUTES
app.post('/api/discovery/generate-share-link', discoveryEndpoints.generateShareLink);
app.get('/api/discovery/share-profile/:cyphrId', discoveryEndpoints.getShareProfile);

// 🗺️ NEARBY DISCOVERY ROUTES
app.post('/api/discovery/enable-nearby', discoveryEndpoints.enableNearbyDiscovery);
app.get('/api/discovery/nearby-users', discoveryEndpoints.getNearbyUsers);

// 📞 PHONE DISCOVERY ROUTES
app.post('/api/discovery/enable-phone-discovery', discoveryEndpoints.enablePhoneDiscovery);
app.post('/api/discovery/search-phone-hash', discoveryEndpoints.searchByPhoneHash);

// ⚙️ DISCOVERY SETTINGS ROUTES
app.post('/api/discovery/update-settings', discoveryEndpoints.updateDiscoverySettings);

console.log('🚀 CYPHR DISCOVERY ROUTES ACTIVATED');
console.log('✅ 6 revolutionary discovery methods available:');
console.log('   🆔 Cyphr ID System');
console.log('   📱 QR Code Dynamic Generation');  
console.log('   🔗 Share Links');
console.log('   🌊 Quantum Handshake (P2P)');
console.log('   🗺️ Secure Nearby');
console.log('   📞 Phone Discovery (Optional)');

`;

// Find the right place to insert discovery routes (before static files)
const insertPoint = serverContent.indexOf('// Static files');

if (insertPoint === -1) {
  console.error('❌ Could not find insertion point in server.cjs');
  console.error('Looking for alternative insertion points...');
  
  // Try other insertion points
  const altPoints = [
    serverContent.indexOf('app.use(express.static'),
    serverContent.lastIndexOf('});') - 50, // Before last closing bracket
    serverContent.length - 500 // Near end of file
  ];
  
  let foundPoint = -1;
  for (const point of altPoints) {
    if (point > 0) {
      foundPoint = point;
      break;
    }
  }
  
  if (foundPoint === -1) {
    console.error('❌ No suitable insertion point found');
    process.exit(1);
  }
  
  console.log(`✅ Using alternative insertion point at position ${foundPoint}`);
  insertPoint = foundPoint;
}

// Insert discovery integration before server start
const beforeServer = serverContent.substring(0, insertPoint);
const afterServer = serverContent.substring(insertPoint);

const newServerContent = beforeServer + discoveryIntegration + '\n' + afterServer;

// Write updated server.cjs
fs.writeFileSync(serverPath, newServerContent, 'utf8');

console.log('✅ DISCOVERY ROUTES INTEGRATED INTO MAIN SERVER');
console.log('🚀 Revolutionary 6-method user discovery system activated!');
console.log('📋 Routes added:');
console.log('   POST /api/discovery/check-cyphr-id');
console.log('   POST /api/discovery/set-cyphr-id');  
console.log('   GET  /api/discovery/search-cyphr-id/:cyphrId');
console.log('   POST /api/discovery/generate-qr-token');
console.log('   POST /api/discovery/scan-qr-token');
console.log('   POST /api/discovery/generate-share-link');
console.log('   GET  /api/discovery/share-profile/:cyphrId');
console.log('   POST /api/discovery/enable-nearby');
console.log('   GET  /api/discovery/nearby-users');
console.log('   POST /api/discovery/enable-phone-discovery');
console.log('   POST /api/discovery/search-phone-hash');
console.log('   POST /api/discovery/update-settings');
console.log('🎯 Server ready for restart with discovery features!');