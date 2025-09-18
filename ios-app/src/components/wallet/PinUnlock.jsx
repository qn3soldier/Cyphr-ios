/**
 * PIN Unlock Component
 * Allows users to unlock their wallet with PIN instead of seed phrase
 */

import React, { useState, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import { Shield, Delete, Eye, EyeOff, Fingerprint } from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../ui/button';
import { toast } from 'react-native-toast-message';

const PinUnlock = ({ onUnlock, onCancel, allowBiometric = false }) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const MAX_ATTEMPTS = 5;
  const PIN_LENGTH = 6;

  useEffect(() => {
    // Check if biometric authentication is available
    const checkBiometric = async () => {
      if (allowBiometric && 'credentials' in navigator) {
        try {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setBiometricAvailable(available);
        } catch (error) {
          setBiometricAvailable(false);
        }
      }
    };
    checkBiometric();
  }, [allowBiometric]);

  const handlePinInput = (digit) => {
    if (pin.length < PIN_LENGTH) {
      setPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handlePinSubmit = async () => {
    if (pin.length !== PIN_LENGTH) {
      toast.error('Please enter a 6-digit PIN');
      return;
    }

    setLoading(true);
    try {
      const success = await onUnlock(pin, 'pin');
      if (success) {
        toast.success('Wallet unlocked successfully!');
      } else {
        setAttempts(prev => prev + 1);
        setPin('');
        
        if (attempts + 1 >= MAX_ATTEMPTS) {
          toast.error('Too many failed attempts. Please restore with seed phrase.');
          onCancel();
        } else {
          toast.error(`Invalid PIN. ${MAX_ATTEMPTS - attempts - 1} attempts remaining.`);
        }
      }
    } catch (error) {
      console.error('PIN unlock error:', error);
      toast.error('Failed to unlock wallet');
      setAttempts(prev => prev + 1);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricUnlock = async () => {
    if (!biometricAvailable) return;

    setLoading(true);
    try {
      // Use WebAuthn API for biometric authentication
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          allowCredentials: [{
            type: 'public-key',
            id: new TextEncoder().encode('wallet-unlock')
          }],
          userVerification: 'required'
        }
      });

      if (credential) {
        const success = await onUnlock(null, 'biometric');
        if (success) {
          toast.success('Wallet unlocked with biometrics!');
        } else {
          toast.error('Biometric authentication failed');
        }
      }
    } catch (error) {
      console.error('Biometric unlock error:', error);
      toast.error('Biometric authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gray-900 rounded-2xl p-6 max-w-md w-full"
      >
        <div className="text-center mb-6">
          <Shield className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Unlock Wallet</h2>
          <p className="text-gray-400">Enter your 6-digit PIN to unlock your wallet</p>
          {attempts > 0 && (
            <p className="text-red-400 text-sm mt-2">
              {MAX_ATTEMPTS - attempts} attempts remaining
            </p>
          )}
        </div>

        {/* PIN Display */}
        <div className="flex justify-center mb-6">
          <div className="flex gap-3">
            {Array.from({ length: PIN_LENGTH }).map((_, index) => (
              <div
                key={index}
                className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center ${
                  index < pin.length
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-gray-600 bg-gray-800'
                }`}
              >
                {index < pin.length && (
                  <div className={`w-3 h-3 rounded-full ${showPin ? 'bg-white' : 'bg-blue-400'}`}>
                    {showPin && <span className="text-white text-lg">{pin[index]}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowPin(!showPin)}
            className="ml-3 p-2 text-gray-400 hover:text-white"
          >
            {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {/* PIN Keypad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {digits.map((digit, index) => (
            <motion.button
              key={index}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (digit === '⌫') {
                  handleBackspace();
                } else if (digit !== '') {
                  handlePinInput(digit.toString());
                }
              }}
              disabled={loading || (digit === '' || (digit === '⌫' && pin.length === 0))}
              className={`h-14 rounded-lg flex items-center justify-center text-xl font-bold transition-colors ${
                digit === ''
                  ? 'invisible'
                  : digit === '⌫'
                  ? 'bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30'
                  : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {digit === '⌫' ? <Delete className="w-6 h-6" /> : digit}
            </motion.button>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handlePinSubmit}
            disabled={pin.length !== PIN_LENGTH || loading}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 text-lg"
          >
            {loading ? 'Unlocking...' : 'Unlock Wallet'}
          </Button>

          {biometricAvailable && (
            <Button
              variant="outline"
              onClick={handleBiometricUnlock}
              disabled={loading}
              className="w-full py-3 text-lg border-gray-600 text-white hover:bg-gray-800"
            >
              <Fingerprint className="w-5 h-5 mr-2" />
              Use Biometric
            </Button>
          )}

          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="w-full py-3 text-lg border-gray-600 text-white hover:bg-gray-800"
          >
            Use Seed Phrase Instead
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PinUnlock;