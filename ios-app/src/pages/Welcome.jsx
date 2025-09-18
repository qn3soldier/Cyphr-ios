import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  SafeAreaView 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { zeroKnowledgeAuth } from '../api/authService.js';
import { cryptoAuth } from '../api/cryptoAuth.js';
import Toast from 'react-native-toast-message';
import { hashPassword as argon2Hash } from '../api/argon2Wrapper.js';

export default function Welcome() {
  // CYPHR ID ONLY STATE
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(true);
  const [showCyphrPinModal, setShowCyphrPinModal] = useState(false);
  const [showCyphrBiometryModal, setShowCyphrBiometryModal] = useState(false);
  const [cyphrUserData, setCyphrUserData] = useState(null);
  const [checkingCredentials, setCheckingCredentials] = useState(true);
  const navigation = useNavigation();
  
  useEffect(() => {
    checkForStoredCredentials();
  }, []);

  // AUTO-TRIGGER when user selects Login + Cyphr Identity
  useEffect(() => {
    if (!isNewUser) {
      console.log('🔍 Auto-triggering Cyphr Identity login...');
      handleCyphrIdLogin();
    }
  }, [isNewUser]);

  const checkForStoredCredentials = async () => {
    try {
      console.log('🔍 Checking for stored Cyphr Identity credentials...');
      
      // Check if user already has a session (iOS Secure Store)
      const userId = await SecureStore.getItemAsync('userId');
      if (userId) {
        console.log('✅ Found existing iOS session, navigating to chats');
        navigation.navigate('MainTabs');
        return;
      }

      // Check for stored device credentials
      const credentialResult = await cryptoAuth.getStoredDeviceCredentials();
      
      if (credentialResult.success) {
        console.log('✅ Found stored credentials for:', credentialResult.cyphrId);
        
        // Check user status (PIN/Biometry) from backend
        const statusResult = await zeroKnowledgeAuth.checkCyphrIdStatus(credentialResult.cyphrId);
        
        if (statusResult.success) {
          setCyphrUserData({
            cyphrId: credentialResult.cyphrId,
            publicKey: credentialResult.publicKey,
            hasPin: statusResult.hasPin,
            hasBiometry: statusResult.hasBiometry,
            userInfo: statusResult.userInfo
          });

          // AUTO-LOGIN LOGIC
          if (!statusResult.hasPin && !statusResult.hasBiometry) {
            console.log('🚀 Direct login - no PIN/biometry required');
            await performAutoLogin(credentialResult);
          } else if (statusResult.hasPin) {
            console.log('🔐 PIN required for login');
            setShowCyphrPinModal(true);
          } else if (statusResult.hasBiometry) {
            console.log('👆 Biometry required for login');
            setShowCyphrBiometryModal(true);
          }
        }
      } else {
        console.log('ℹ️ No stored credentials found - showing welcome screen');
      }
    } catch (error) {
      console.error('❌ Error checking stored credentials:', error);
    } finally {
      setCheckingCredentials(false);
    }
  };

  const performAutoLogin = async (credentialData) => {
    try {
      // Store session and navigate to chats
      const userProfile = {
        id: credentialData.cyphrId,
        name: cyphrUserData?.userInfo?.fullName || `Cyphr User`,
        cyphr_id: credentialData.cyphrId,
        avatar_url: cyphrUserData?.userInfo?.avatarUrl,
        authMethod: 'cryptographic'
      };
      
      await SecureStore.setItemAsync('user_profile', JSON.stringify(userProfile));
      await SecureStore.setItemAsync('userId', credentialData.cyphrId);
      await SecureStore.setItemAsync('authMethod', 'cryptographic');
      
      Toast.show({ type: 'success', text1: 'Welcome back!' });
      navigation.navigate('MainTabs');
    } catch (error) {
      console.error('❌ Auto-login failed:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Auto-login failed' });
    }
  };

  const handleCyphrAuthSuccess = (result) => {
    // Store session from successful authentication
    const userProfile = {
      id: result.user.id,
      name: result.user.fullName || result.user.name || 'Cyphr User',
      cyphr_id: result.user.cyphrId,
      avatar_url: result.user.avatar,
      authMethod: 'cryptographic'
    };
    
    SecureStore.setItemAsync('user_profile', JSON.stringify(userProfile));
    SecureStore.setItemAsync('userId', result.user.id);
    SecureStore.setItemAsync('authMethod', 'cryptographic');
    
    // Close modals
    setShowCyphrPinModal(false);
    setShowCyphrBiometryModal(false);
    
    Toast.show({ type: 'success', text1: 'Login successful!' });
    navigation.navigate('MainTabs');
  };

  const handleCyphrIdLogin = async () => {
    console.log('🚀 handleCyphrIdLogin triggered!');
    
    setIsLoading(true);
    setError('');
    
    try {
      console.log('🔍 Starting Cyphr ID login process...');
      
      // Try to get stored device credentials
      const credentialResult = await cryptoAuth.getStoredDeviceCredentials();
      
      if (credentialResult.success) {
        console.log('✅ Found stored credentials for:', credentialResult.cyphrId);
        
        // Check user status (PIN/Biometry) from backend
        const statusResult = await zeroKnowledgeAuth.checkCyphrIdStatus(credentialResult.cyphrId);
        
        if (statusResult.success) {
          setCyphrUserData({
            cyphrId: credentialResult.cyphrId,
            publicKey: credentialResult.publicKey,
            hasPin: statusResult.hasPin,
            hasBiometry: statusResult.hasBiometry,
            userInfo: statusResult.userInfo
          });

          // AUTO-LOGIN LOGIC
          if (!statusResult.hasPin && !statusResult.hasBiometry) {
            console.log('🚀 Direct Cyphr ID login - no PIN/biometry required');
            await performAutoLogin(credentialResult);
          } else if (statusResult.hasPin) {
            console.log('🔐 PIN required for Cyphr ID login');
            setShowCyphrPinModal(true);
          } else if (statusResult.hasBiometry) {
            console.log('👆 Biometry required for Cyphr ID login');
            setShowCyphrBiometryModal(true);
          }
        } else {
          throw new Error(statusResult.error || 'Failed to check account status');
        }
      } else {
        console.log('ℹ️ No stored Cyphr ID credentials found');
        setError('No Cyphr Identity found on this device. Please use Sign Up → Cyphr Identity to create one.');
      }
    } catch (error) {
      console.error('❌ Cyphr ID login failed:', error);
      setError('Cyphr ID login failed: ' + error.message);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Cyphr ID login failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (isNewUser) {
      navigation.navigate('CryptoSignUp');
    } else {
      handleCyphrIdLogin();
    }
  };

  // Show loading screen while checking credentials
  if (checkingCredentials) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.title}>Cyphr Messenger</Text>
          <ActivityIndicator size="large" color="#8b5cf6" style={styles.loader} />
          <Text style={styles.loadingText}>Checking for stored credentials...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Cyphr Messenger</Text>
          <Text style={styles.subtitle}>Secure messaging with post-quantum encryption</Text>
          
          {/* Toggle between Sign Up and Login */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              onPress={() => setIsNewUser(true)}
              style={[styles.toggleButton, isNewUser && styles.toggleButtonActive]}
            >
              <Text style={styles.toggleButtonText}>Sign Up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsNewUser(false)}
              style={[styles.toggleButton, !isNewUser && styles.toggleButtonActive]}
            >
              <Text style={styles.toggleButtonText}>Login</Text>
            </TouchableOpacity>
          </View>

          {/* Cyphr Identity Card */}
          <View style={styles.cyphrCard}>
            {isNewUser ? (
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Cyphr Identity</Text>
                <Text style={styles.cardDescription}>
                  Create your sovereign digital identity protected by quantum-safe cryptography. 
                  No emails, phones, or passwords required.
                </Text>
                <View style={styles.featuresGrid}>
                  <View style={styles.feature}>
                    <Text style={styles.featureText}>Quantum-Safe</Text>
                  </View>
                  <View style={styles.feature}>
                    <Text style={styles.featureText}>Device-Bound</Text>
                  </View>
                  <View style={styles.feature}>
                    <Text style={styles.featureText}>Self-Sovereign</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Checking Device Credentials...</Text>
                <Text style={styles.cardDescription}>
                  Searching for stored Cyphr Identity on this device.
                </Text>
                {isLoading && (
                  <ActivityIndicator size="small" color="#8b5cf6" style={styles.smallLoader} />
                )}
              </View>
            )}
          </View>
          
          {error && <Text style={styles.errorText}>{error}</Text>}
          
          {/* Main Action Button */}
          <TouchableOpacity 
            onPress={handleSignIn}
            disabled={isLoading}
            style={[styles.button, isLoading && styles.buttonDisabled]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>
                {isNewUser ? 'Create Cyphr Identity' : 'Login to Cyphr Identity'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// React Native Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 24,
    padding: 32,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#a1a1aa',
    textAlign: 'center',
    marginBottom: 24,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  toggleButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  cyphrCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  cardContent: {
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 14,
    color: '#a1a1aa',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  feature: {
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    minWidth: 80,
  },
  featureText: {
    fontSize: 12,
    color: '#8b5cf6',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(139, 92, 246, 0.5)',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  loader: {
    marginVertical: 20,
  },
  smallLoader: {
    marginTop: 8,
  },
  loadingText: {
    color: '#a1a1aa',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
});