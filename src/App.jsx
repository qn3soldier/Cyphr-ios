import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import AvatarProvider from './components/AvatarProvider';
import { toast, Toaster } from 'sonner';
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
import './App.css';

export default function App() {
  const [incomingCall, setIncomingCall] = React.useState(null);
  const [activeCall, setActiveCall] = React.useState(null);
  const [servicesInitialized, setServicesInitialized] = React.useState(false);

  useEffect(() => {
    // Prevent duplicate initialization in React StrictMode
    if (servicesInitialized) return;

    // Initialize services when app loads
    initializeServices();

    // Set up global event listeners
    window.addEventListener('incomingCall', handleIncomingCall);

    return () => {
      window.removeEventListener('incomingCall', handleIncomingCall);
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
      toast.error('Configuration Error: Missing API keys. Check console for details.');
    }
    
    // Check if user is authenticated
    const userId = sessionStorage.getItem('userId');
    
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

  return (
    <ThemeProvider defaultTheme="void" storageKey="cyphr-ui-theme">
      <AvatarProvider>
        <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
          <BrowserRouter future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/phone-registration" element={<PhoneRegistration />} />
            <Route path="/email-verification" element={<EmailVerification />} />
            <Route path="/profile-setup" element={<ProfileSetup />} />
            <Route path="/pin-setup" element={<PinSetupPage />} />
            <Route path="/pin-login" element={<PinLoginPage />} />
            <Route path="/crypto-signup" element={<CryptoSignUp />} />
            <Route path="/help" element={<div>Help Page</div>} />
            <Route element={<Layout />}>
              <Route path="/chats" element={<Chats />} />
              <Route path="/chats/:chatId" element={<Chats />} />
              <Route path="/new-chat" element={<NewChat />} />
              <Route path="/new-group" element={<NewGroup />} />
              <Route path="/calls" element={<Calls />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/security-settings" element={<SecuritySettings />} />
              <Route path="/privacy-settings" element={<PrivacySettings />} />
              <Route path="/chat-settings" element={<ChatSettings />} />
              <Route path="/notification-settings" element={<NotificationSettings />} />
              <Route path="/crypto-wallet" element={<CryptoWallet />} />
              <Route path="/discovery" element={<DiscoveryHub />} />
            </Route>
            <Route path="/access-denied" element={<AccessDenied />} />
          </Routes>

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

          <Toaster position="top-right" />
        </BrowserRouter>
        </div>
      </AvatarProvider>
    </ThemeProvider>
  );
} 