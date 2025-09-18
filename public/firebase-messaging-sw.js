// Import Firebase libraries
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyDkoAfLdM_v61h7alxvhEvm-6MrCktMseU",
  authDomain: "cyphrmessenger.firebaseapp.com",
  projectId: "cyphrmessenger",
  storageBucket: "cyphrmessenger.firebasestorage.app",
  messagingSenderId: "114084534357",
  appId: "1:114084534357:web:5b1f7c619e4ca67af29cdc"
});

const messaging = firebase.messaging();

// Handle background messages with enhanced security
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  try {
    // Parse notification data
    const data = payload.data || {};
    const messageType = data.type || 'message';
    
    // Determine notification content based on type and privacy settings
    let notificationTitle = 'Cyphr Messenger';
    let notificationBody = 'You have a new notification';
    let icon = '/favicon.ico';
    let badge = '/favicon.ico';
    let sound = '/notification-sound.wav';
    
    // Customize based on message type
    switch (messageType) {
      case 'message':
        notificationTitle = data.senderName || 'New Message';
        // For encrypted messages, show generic preview for privacy
        notificationBody = data.encrypted === 'true' 
          ? '🔒 New encrypted message' 
          : (data.preview || 'You have a new message');
        icon = data.senderAvatar || '/favicon.ico';
        break;
        
      case 'call':
        notificationTitle = '📞 Incoming Call';
        notificationBody = `${data.callerName || 'Unknown'} is calling you`;
        sound = '/ringtone.wav';
        break;
        
      case 'crypto_transaction':
        notificationTitle = '💰 Crypto Transaction';
        notificationBody = data.amount 
          ? `Received ${data.amount} ${data.currency || 'XLM'}`
          : 'New cryptocurrency transaction';
        break;
        
      case 'group_message':
        notificationTitle = data.groupName || 'Group Chat';
        notificationBody = data.encrypted === 'true'
          ? `🔒 ${data.senderName || 'Someone'}: New encrypted message`
          : `${data.senderName || 'Someone'}: ${data.preview || 'New message'}`;
        break;
        
      default:
        notificationTitle = payload.notification?.title || 'Cyphr Messenger';
        notificationBody = payload.notification?.body || 'You have a new notification';
    }
    
    // Enhanced notification options with security features
    const notificationOptions = {
      body: notificationBody,
      icon: icon,
      badge: badge,
      vibrate: [200, 100, 200, 100, 200], // Distinctive vibration pattern
      silent: false,
      requireInteraction: messageType === 'call', // Calls require interaction
      data: {
        ...data,
        timestamp: Date.now(),
        messageType: messageType,
        url: generateNotificationUrl(messageType, data)
      },
      actions: getNotificationActions(messageType),
      tag: data.chatId || messageType, // Group similar notifications
      renotify: messageType === 'call', // Re-alert for calls
      
      // Security and privacy enhancements
      dir: 'auto',
      lang: 'en',
      
      // Custom properties for notification management
      persistent: messageType === 'call',
      sticky: messageType === 'call'
    };

    // Show notification with enhanced error handling
    return self.registration.showNotification(notificationTitle, notificationOptions);
    
  } catch (error) {
    console.error('[firebase-messaging-sw.js] Error processing background message:', error);
    
    // Fallback notification
    return self.registration.showNotification('Cyphr Messenger', {
      body: 'You have a new notification',
      icon: '/favicon.ico',
      data: payload.data || {}
    });
  }
});

// Generate appropriate URL based on notification type
function generateNotificationUrl(messageType, data) {
  const baseUrl = self.location.origin;
  
  switch (messageType) {
    case 'message':
    case 'group_message':
      return data.chatId ? `${baseUrl}/chat/${data.chatId}` : `${baseUrl}/chats`;
    case 'call':
      return `${baseUrl}/calls`;
    case 'crypto_transaction':
      return `${baseUrl}/crypto-wallet`;
    default:
      return baseUrl;
  }
}

// Get context-appropriate notification actions
function getNotificationActions(messageType) {
  switch (messageType) {
    case 'call':
      return [
        { action: 'answer', title: '📞 Answer', icon: '/icons/phone.png' },
        { action: 'decline', title: '📵 Decline', icon: '/icons/phone-off.png' }
      ];
    case 'message':
    case 'group_message':
      return [
        { action: 'reply', title: '💬 Reply', icon: '/icons/reply.png' },
        { action: 'view', title: '👁️ View', icon: '/icons/view.png' },
        { action: 'dismiss', title: '✕ Dismiss' }
      ];
    case 'crypto_transaction':
      return [
        { action: 'view_wallet', title: '💰 View Wallet', icon: '/icons/wallet.png' },
        { action: 'dismiss', title: '✕ Dismiss' }
      ];
    default:
      return [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ];
  }
}

// Enhanced notification click handler with action support
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click:', event);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  // Handle different actions
  switch (action) {
    case 'dismiss':
      notification.close();
      return;
      
    case 'answer':
      // For call notifications - answer the call
      notification.close();
      handleCallAction('answer', data);
      return;
      
    case 'decline':
      // For call notifications - decline the call
      notification.close();
      handleCallAction('decline', data);
      return;
      
    case 'reply':
      // For message notifications - open quick reply
      notification.close();
      openAppWithAction('reply', data);
      return;
      
    case 'view_wallet':
      // For crypto notifications - open wallet
      notification.close();
      openAppWithAction('view_wallet', data);
      return;
      
    default:
      // Default action - open the app
      notification.close();
      break;
  }
  
  // Determine target URL
  const targetUrl = data.url || generateNotificationUrl(data.messageType || data.type, data);
  
  // Enhanced window management
  event.waitUntil(
    handleNotificationNavigation(targetUrl, data)
  );
});

// Handle call-specific actions
async function handleCallAction(action, data) {
  try {
    // Send message to all active clients about call action
    const clients = await self.clients.matchAll({ type: 'window' });
    
    const message = {
      type: 'CALL_ACTION',
      action: action,
      callId: data.callId,
      callerId: data.callerId,
      timestamp: Date.now()
    };
    
    clients.forEach(client => {
      client.postMessage(message);
    });
    
    // If no active clients, open the app
    if (clients.length === 0) {
      await self.clients.openWindow(`${self.location.origin}/calls?action=${action}&callId=${data.callId}`);
    }
    
  } catch (error) {
    console.error('[firebase-messaging-sw.js] Error handling call action:', error);
  }
}

// Open app with specific action context
async function openAppWithAction(action, data) {
  try {
    let url = self.location.origin;
    
    switch (action) {
      case 'reply':
        url = data.chatId ? `${url}/chat/${data.chatId}?action=reply` : `${url}/chats`;
        break;
      case 'view_wallet':
        url = `${url}/crypto-wallet`;
        break;
      default:
        url = data.url || url;
    }
    
    await handleNotificationNavigation(url, data);
    
  } catch (error) {
    console.error('[firebase-messaging-sw.js] Error opening app with action:', error);
  }
}

// Enhanced navigation handling with better client management
async function handleNotificationNavigation(targetUrl, data) {
  try {
    const clients = await self.clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    });
    
    // Try to find existing window with the app
    for (const client of clients) {
      if (client.url.includes(self.location.origin)) {
        try {
          // Focus existing window and navigate
          await client.focus();
          
          // Send navigation message to client
          client.postMessage({
            type: 'NOTIFICATION_NAVIGATION',
            url: targetUrl,
            data: data,
            timestamp: Date.now()
          });
          
          return client;
        } catch (error) {
          console.warn('[firebase-messaging-sw.js] Failed to focus existing client:', error);
        }
      }
    }
    
    // No existing window found, open new one
    if (self.clients.openWindow) {
      return await self.clients.openWindow(targetUrl);
    }
    
  } catch (error) {
    console.error('[firebase-messaging-sw.js] Error in navigation handling:', error);
    
    // Fallback - try to open the base URL
    if (self.clients.openWindow) {
      return await self.clients.openWindow(self.location.origin);
    }
  }
}

// Cache static assets
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker activated');
  event.waitUntil(clients.claim());
}); 