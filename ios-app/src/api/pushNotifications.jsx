import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { toast } from 'react-native-toast-message';
import { supabase } from './awsClient';

// Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

/**
 * Push Notifications Service
 * WITHOUT AUTOMATIC PERMISSION REQUESTS
 */

class PushNotificationService {
  constructor() {
    this.isSupported = this.checkSupport();
    this.permission = 'default';
    // НЕ ЗАПРАШИВАЕМ РАЗРЕШЕНИЯ АВТОМАТИЧЕСКИ
  }

  checkSupport() {
    return 'Notification' in window && 
           'serviceWorker' in navigator;
  }

  /**
   * ПРОВЕРЯЕМ статус БЕЗ запроса разрешений
   */
  getPermissionStatus() {
    if (!this.isSupported) return 'not-supported';
    return Notification.permission;
  }

  /**
   * ТОЛЬКО ДЛЯ НАСТРОЕК - запрос разрешений вручную
   */
  async requestPermissionFromSettings() {
    if (!this.isSupported) {
      throw new Error('Push notifications not supported');
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    // ТОЛЬКО когда пользователь ЯВНО нажал в настройках
    const permission = await Notification.requestPermission();
    this.permission = permission;
    return permission;
  }

  /**
   * Показать уведомление ТОЛЬКО если разрешение уже есть
   */
  async showNotification(title, options = {}) {
    if (Notification.permission !== 'granted') {
      console.log('Notifications not permitted - skipping');
      return null;
    }

    try {
      const notification = new Notification(title, {
        ...options,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });

      return notification;
    } catch (error) {
      console.error('Show notification error:', error);
      return null;
    }
  }

  /**
   * Initialize FCM token when user grants permission
   */
  async init() {
    if (Notification.permission === 'granted') {
      try {
        await this.registerServiceWorker();
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
        });
        
        if (token) {
          console.log('FCM Token:', token);
          // Store token in Supabase for sending notifications
          await this.storeToken(token);
          this.setupForegroundListener();
          return token;
        }
      } catch (error) {
        console.error('FCM initialization error:', error);
      }
    }
    return null;
  }

  async storeToken(token) {
    try {
      const userId = sessionStorage.getItem('userId');
      if (!userId) return;

      const { error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: userId,
          token: token,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error storing FCM token:', error);
      }
    } catch (error) {
      console.error('Store token error:', error);
    }
  }

  setupForegroundListener() {
    onMessage(messaging, (payload) => {
      console.log('Foreground message:', payload);
      
      const { title, body, icon } = payload.notification || {};
      
      if (title) {
        this.showNotification(title, {
          body,
          icon: icon || '/favicon.ico',
          tag: 'cyphr-message'
        });
      }
    });
  }

  /**
   * Регистрация service worker БЕЗ запроса разрешений
   */
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service Worker registered');
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }
}

// НЕ ИНИЦИАЛИЗИРУЕМ автоматически
export const pushNotificationService = new PushNotificationService(); 
export const pushNotifications = new PushNotificationService(); 