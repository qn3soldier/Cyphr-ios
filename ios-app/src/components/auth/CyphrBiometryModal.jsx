import { useState } from 'react';
import Animated from 'react-native-reanimated';
import { Fingerprint, X } from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../ui/button';
import { toast } from 'react-native-toast-message';

export default function CyphrBiometryModal({ isOpen, onClose, cyphrUserData, onSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBiometryAuth = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        throw new Error('Biometric authentication not supported');
      }

      // Create challenge for biometric auth
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          userVerification: 'required',
          timeout: 30000
        }
      });

      if (assertion) {
        // Biometry successful - perform login
        const response = await fetch('/api/auth/cyphr-id-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cyphrId: cyphrUserData.cyphrId,
            biometricAuth: true
          })
        });

        const result = await response.json();

        if (result.success) {
          toast.success('Biometric authentication successful!');
          onSuccess(result);
        } else {
          setError(result.error || 'Biometric authentication failed');
        }
      }
    } catch (error) {
      console.error('❌ Biometric authentication failed:', error);
      setError(error.message || 'Biometric authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl border border-gray-700 shadow-2xl max-w-sm w-full p-6 relative"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          {/* Header */}
          <div className="text-center mb-6">
            <motion.div
              animate={{ 
                scale: isLoading ? [1, 1.1, 1] : 1,
              }}
              transition={{ 
                duration: 1.5, 
                repeat: isLoading ? Infinity : 0,
                ease: "easeInOut" 
              }}
              className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <Fingerprint size={32} className="text-white" />
            </motion.div>
            <h2 className="text-xl font-bold text-white">Biometric Authentication</h2>
            <p className="text-gray-300 text-sm mt-1">
              Welcome back, {cyphrUserData?.userInfo?.fullName || 'Cyphr User'}
            </p>
            <p className="text-gray-400 text-xs mt-1">
              @{cyphrUserData?.cyphrId}
            </p>
          </div>

          {/* Content */}
          <div className="text-center space-y-4">
            <p className="text-gray-300 text-sm">
              Use your fingerprint, Face ID, or device security to continue
            </p>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <Button
              onClick={handleBiometryAuth}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  <span>Authenticating...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Fingerprint size={18} />
                  <span>Use Biometrics</span>
                </div>
              )}
            </Button>
          </div>

          {/* Footer */}
          <p className="text-xs text-gray-500 text-center mt-6">
            🛡️ Your biometric data never leaves your device
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}