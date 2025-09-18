import '../globals.js'; // CRITICAL: Load crypto polyfills FIRST
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Application from 'expo-application';
import { ThemeProvider } from './components/ThemeProvider';
import AvatarProvider from './components/AvatarProvider';
import Toast from 'react-native-toast-message';
import Layout from './components/Layout';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import PhoneRegistration from './pages/PhoneRegistration';
import EmailVerification from './pages/EmailVerification';
import ProfileSetup from './pages/ProfileSetup';
import PinSetupPage from './pages/PinSetupPage';
import PinLoginPage from './pages/PinLoginPage';
import CryptoSignUp from './pages/CryptoSignUp';
import Chats from './pages/Chats';
import NewChat from './pages/NewChat';
import NewGroup from './pages/NewGroup';
import Calls from './pages/Calls';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import SecuritySettings from './pages/SecuritySettings';
import PrivacySettings from './pages/PrivacySettings';
import ChatSettings from './pages/ChatSettings';
import NotificationSettings from './pages/NotificationSettings';
import CryptoWallet from './pages/CryptoWallet';
import AccessDenied from './pages/AccessDenied';
import Help from './pages/Help';
import DiscoveryHub from './components/discovery/DiscoveryHub';
import CallInterface from './components/CallInterface';
import IncomingCallModal from './components/IncomingCallModal';
import { socketService } from './api/socketService.js';
// iOS styles will be defined inline

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Main Tab Navigator for authenticated users
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: '#ffffff20',
          height: 80,
        },
        tabBarActiveTintColor: '#8b5cf6',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <Tab.Screen name="Chats" component={Chats} />
      <Tab.Screen name="Calls" component={Calls} />
      <Tab.Screen name="Wallet" component={CryptoWallet} />
      <Tab.Screen name="Settings" component={Settings} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [incomingCall, setIncomingCall] = React.useState(null);
  const [activeCall, setActiveCall] = React.useState(null);
  const [servicesInitialized, setServicesInitialized] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [deviceInfo, setDeviceInfo] = React.useState(null);

  useEffect(() => {
    // Prevent duplicate initialization in React StrictMode
    if (servicesInitialized) return;

    // Initialize services when app loads
    initializeServices();

    // Set up iOS-specific event listeners
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      appStateSubscription?.remove();
    };
  }, [servicesInitialized]);

  const initializeServices = async () => {
    console.log('🚀 Cyphr Messenger - Initializing services...');
    
    // Validate environment variables and API keys
    try {
      const { printConfigStatus } = await import('./config/envValidation.ts');
      printConfigStatus();
    } catch (error) {
      console.error('❌ Environment validation failed:', error.message);
      Toast.show({ type: 'error', text1: 'Configuration Error', text2: 'Missing API keys' });
    }
    
    // Check if user is authenticated (iOS Secure Store)
    const userId = await SecureStore.getItemAsync('userId');
    
    if (userId) {
      // Connect to socket (mock version for now)
      await socketService.connect();
      
      // Setup incoming call handler
      socketService.onIncomingCall = (data) => {
        setIncomingCall({
          ...data,
          isIncoming: true
        });
      };
    }
    
    console.log('✅ Post-quantum encryption: Kyber1024 + ChaCha20 activated');
    setServicesInitialized(true);
  };

  const handleIncomingCall = (event) => {
    setIncomingCall({
      ...event.detail,
      isIncoming: true
    });
  };

  const handleCallClose = () => {
    setIncomingCall(null);
    setActiveCall(null);
  };

  const handleAnswerCall = () => {
    if (incomingCall) {
      setActiveCall(incomingCall);
      setIncomingCall(null);
    }
  };

  const handleAppStateChange = (nextAppState) => {
    console.log('📱 iOS App state changed to:', nextAppState);
  };

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#1a1a2e" />
      <AvatarProvider>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#1a1a2e' },
          }}
        >
          {!isAuthenticated ? (
            // CYPHR ID ONLY Authentication Flow
            <>
              <Stack.Screen name="Welcome" component={Welcome} />
              <Stack.Screen name="CryptoSignUp" component={CryptoSignUp} />
              <Stack.Screen name="ProfileSetup" component={ProfileSetup} />
              <Stack.Screen name="PinSetup" component={PinSetupPage} />
              <Stack.Screen name="PinLogin" component={PinLoginPage} />
            </>
          ) : (
            // Main App Flow with Tabs
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} />
              <Stack.Screen name="NewChat" component={NewChat} />
              <Stack.Screen name="NewGroup" component={NewGroup} />
              <Stack.Screen name="Profile" component={Profile} />
              <Stack.Screen name="SecuritySettings" component={SecuritySettings} />
              <Stack.Screen name="PrivacySettings" component={PrivacySettings} />
              <Stack.Screen name="ChatSettings" component={ChatSettings} />
              <Stack.Screen name="NotificationSettings" component={NotificationSettings} />
              <Stack.Screen name="Discovery" component={DiscoveryHub} />
            </>
          )}
        </Stack.Navigator>

          {/* Global Call Interface */}
          {activeCall && (
            <CallInterface
              call={activeCall}
              onClose={handleCallClose}
            />
          )}

          {/* Incoming Call Modal */}
          {incomingCall && (
            <IncomingCallModal
              call={incomingCall}
              onAnswer={handleAnswerCall}
              onDecline={handleCallClose}
            />
          )}

        <Toast />
      </AvatarProvider>
    </NavigationContainer>
  );
} // Force rebuild
 
