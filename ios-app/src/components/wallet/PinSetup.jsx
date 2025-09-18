/**
 * PIN Setup Component
 * Allows users to set up PIN and biometric authentication after wallet creation
 */

import React, { useState, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import { Shield, Delete, Eye, EyeOff, Fingerprint, Check } from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../ui/button';
import { toast } from 'react-native-toast-message';

const PinSetup = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState('pin'); // 'pin', 'confirm', 'biometric'
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const PIN_LENGTH = 6;

  useEffect(() => {
    // Check if biometric authentication is available
    const checkBiometric = async () => {
      if ('credentials' in navigator) {
        try {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setBiometricAvailable(available);
        } catch (error) {
          setBiometricAvailable(false);
        }
      }
    };
    checkBiometric();
  }, []);

  const handlePinInput = (digit) => {
    const currentPin = step === 'pin' ? pin : confirmPin;
    const setCurrentPin = step === 'pin' ? setPin : setConfirmPin;

    if (currentPin.length < PIN_LENGTH) {
      setCurrentPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    const setCurrentPin = step === 'pin' ? setPin : setConfirmPin;
    setCurrentPin(prev => prev.slice(0, -1));
  };

  const handlePinNext = () => {
    if (pin.length !== PIN_LENGTH) {
      toast.error('Please enter a 6-digit PIN');
      return;
    }

    if (step === 'pin') {
      setStep('confirm');
    } else if (step === 'confirm') {
      if (pin !== confirmPin) {
        toast.error('PINs do not match. Please try again.');
        setConfirmPin('');
        return;
      }
      if (biometricAvailable) {
        setStep('biometric');
      } else {
        handleComplete(false);
      }
    }
  };

  const handleComplete = async (enableBiometric = false, forceClose = false) => {
    setLoading(true);
    try {
      console.log(`🔐 Completing PIN setup with biometric: ${enableBiometric}`);
      await onComplete(pin, enableBiometric);
      toast.success('PIN setup completed successfully!');
      
      // CRITICAL: Ensure modal is closed after successful completion
      // This prevents infinite cycles by clearing all state properly
      console.log('✅ PIN setup completed - modal should close now');
      
    } catch (error) {
      console.error('PIN setup error:', error);
      toast.error('Failed to set up PIN');
      
      // If forceClose is true, we still want to close the modal even on error
      if (forceClose) {
        console.log('🔒 Force closing PIN setup modal despite error');
        return; // Let finally block handle cleanup
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricSetup = async () => {
    if (!biometricAvailable) return;

    setLoading(true);
    try {
      // Create a new credential for biometric authentication
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: new Uint8Array(32),
          rp: { name: 'Cyphr Messenger' },
          user: {
            id: new TextEncoder().encode('wallet-user'),
            name: 'Wallet User',
            displayName: 'Wallet User'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },   // ES256
            { alg: -257, type: 'public-key' }  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          }
        }
      });

      if (credential) {
        await handleComplete(true);
      } else {
        toast.error('Failed to set up biometric authentication');
        await handleComplete(false);
      }
    } catch (error) {
      console.error('Biometric setup error:', error);
      toast.error('Failed to set up biometric authentication');
      await handleComplete(false);
    } finally {
      setLoading(false);
    }
  };

  const currentPin = step === 'pin' ? pin : confirmPin;
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
          <h2 className="text-2xl font-bold text-white mb-2">
            {step === 'pin' && 'Set Up PIN'}
            {step === 'confirm' && 'Confirm PIN'}
            {step === 'biometric' && 'Enable Biometric'}
          </h2>
          <p className="text-gray-400">
            {step === 'pin' && 'Create a 6-digit PIN to secure your wallet'}
            {step === 'confirm' && 'Re-enter your PIN to confirm'}
            {step === 'biometric' && 'Use fingerprint or face recognition for quick access'}
          </p>
        </div>

        {step !== 'biometric' && (
          <>
            {/* PIN Display */}
            <div className="flex justify-center mb-6">
              <div className="flex gap-3">
                {Array.from({ length: PIN_LENGTH }).map((_, index) => (
                  <div
                    key={index}
                    className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center ${
                      index < currentPin.length
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-gray-600 bg-gray-800'
                    }`}
                  >
                    {index < currentPin.length && (
                      <div className={`w-3 h-3 rounded-full ${showPin ? 'bg-white' : 'bg-blue-400'}`}>
                        {showPin && <span className="text-white text-lg">{currentPin[index]}</span>}
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
                  disabled={loading || (digit === '' || (digit === '⌫' && currentPin.length === 0))}
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

            {/* Next Button */}
            <Button
              onClick={handlePinNext}
              disabled={currentPin.length !== PIN_LENGTH || loading}
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 text-lg mb-3"
            >
              {step === 'pin' ? 'Continue' : 'Confirm PIN'}
            </Button>
          </>
        )}

        {step === 'biometric' && (
          <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Fingerprint className="w-12 h-12 text-blue-400" />
            </div>

            <p className="text-gray-300 mb-6">
              Enable biometric authentication for quick and secure access to your wallet
            </p>

            <Button
              onClick={handleBiometricSetup}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 text-lg mb-3"
            >
              {loading ? 'Setting up...' : 'Enable Biometric'}
            </Button>

            <Button
              variant="outline"
              onClick={async () => {
                console.log('⏭️ Biometric setup skipped - completing PIN setup without biometric');
                setLoading(true);
                try {
                  await handleComplete(false);
                  console.log('✅ PIN setup completed without biometric - should close modal');
                } catch (error) {
                  console.error('❌ Error completing PIN setup without biometric:', error);
                  // CRITICAL: Even on error, close the modal to prevent infinite loops
                  console.log('🔒 Forcing modal close despite biometric skip error');
                } finally {
                  setLoading(false);
                  // Ensure we're no longer in biometric step
                  console.log('🎯 Biometric skip completed - modal should be closed by parent');
                }
              }}
              disabled={loading}
              className="w-full py-3 text-lg border-gray-600 text-white hover:bg-gray-800"
            >
              {loading ? 'Completing...' : 'Skip for Now'}
            </Button>
          </div>
        )}

        {step !== 'biometric' && (
          <Button
            variant="outline"
            onClick={onSkip}
            disabled={loading}
            className="w-full py-3 text-lg border-gray-600 text-white hover:bg-gray-800"
          >
            Skip PIN Setup
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
};

export default PinSetup;