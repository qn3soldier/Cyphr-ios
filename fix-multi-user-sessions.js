/**
 * Fix Multi-User Session Collision
 * Problem: Multiple users in same browser overwrite each other's session data
 */

// Issues found:
// 1. userId generation using Date.now() can create collisions
// 2. sessionStorage keys are not unique per user/tab
// 3. secureStorage keys collide between users
// 4. Session data gets overwritten when second user registers

const fixes = {
  
  // Fix 1: Better userId generation
  generateUniqueUserId: () => {
    // Use crypto.randomUUID if available, fallback to secure random
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback: more secure random generation
    const timestamp = Date.now();
    const randomPart = crypto.getRandomValues(new Uint32Array(2));
    return `user_${timestamp}_${randomPart[0].toString(36)}_${randomPart[1].toString(36)}`;
  },
  
  // Fix 2: Tab-specific session storage
  getTabId: () => {
    // Generate unique tab ID that persists for this tab session
    let tabId = sessionStorage.getItem('cyphr_tab_id');
    if (!tabId) {
      tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('cyphr_tab_id', tabId);
    }
    return tabId;
  },
  
  // Fix 3: Unique storage keys per user
  getUserStorageKey: (baseKey, userId) => {
    const tabId = fixes.getTabId();
    return `${baseKey}:${userId}:${tabId}`;
  },
  
  // Fix 4: Safe session storage that doesn't collide
  storeUserSession: (userId, sessionData) => {
    const tabId = fixes.getTabId();
    const sessionKey = `cyphr_session:${userId}:${tabId}`;
    sessionStorage.setItem(sessionKey, JSON.stringify(sessionData));
    
    // Also store current user ID for this tab
    sessionStorage.setItem('cyphr_current_user', userId);
  },
  
  getCurrentUserSession: () => {
    const currentUserId = sessionStorage.getItem('cyphr_current_user');
    if (!currentUserId) return null;
    
    const tabId = fixes.getTabId();
    const sessionKey = `cyphr_session:${currentUserId}:${tabId}`;
    const sessionData = sessionStorage.getItem(sessionKey);
    
    return sessionData ? JSON.parse(sessionData) : null;
  }
};

export default fixes;

// Patch instructions for authService.js:
/*
1. Replace userId generation:
   OLD: const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
   NEW: const userId = fixes.generateUniqueUserId();

2. Replace session storage:
   OLD: sessionStorage.setItem('userId', userId);
   NEW: fixes.storeUserSession(userId, { userId, publicKey, phone });

3. Update secureStorage calls:
   OLD: await secureStorage.storePrivateKey('kyber_secret', encryptedSecretKey, userId);
   NEW: await secureStorage.storePrivateKey(fixes.getUserStorageKey('kyber_secret', userId), encryptedSecretKey, userId);

4. Update tempUser storage in PhoneRegistration.jsx:
   OLD: sessionStorage.setItem('tempUser', JSON.stringify({...}));
   NEW: sessionStorage.setItem(fixes.getUserStorageKey('tempUser', user.id), JSON.stringify({...}));
*/