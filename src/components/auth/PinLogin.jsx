import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/ui/button';
import CyphrLogo from '@/components/CyphrLogo';
import { motion } from 'framer-motion';
import { ArrowRight, Fingerprint, Mail, Shield, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { hashPassword as argon2Hash } from '@/api/argon2Wrapper';

export default function PinLogin({ userEmail, onSuccess, onForgotPin, onSwitchToEmail }) {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [showBiometric, setShowBiometric] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  const inputRefs = useRef([]);
  const navigate = useNavigate();
  
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_TIME = 15; // minutes

  useEffect(() => {
    // Check if biometric is available and enabled
    const checkBiometric = async () => {
      try {
        const biometricEnabled = localStorage.getItem('biometric_enabled') === 'true';
        const hasCredentials = await navigator.credentials && 
          window.PublicKeyCredential && 
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          
        setShowBiometric(biometricEnabled && hasCredentials);
      } catch (error) {
        console.log('Biometric check failed:', error);
        setShowBiometric(false);
      }
    };

    checkBiometric();

    // Focus first input
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }

    // Check for lockout
    const lockoutTime = localStorage.getItem('pin_lockout_until');
    if (lockoutTime && Date.now() < parseInt(lockoutTime)) {
      const remainingTime = Math.ceil((parseInt(lockoutTime) - Date.now()) / 1000 / 60);
      setError(`Too many failed attempts. Try again in ${remainingTime} minutes.`);
    }
  }, []);

  const handlePinInput = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only digits

    const newPin = pin.split('');
    newPin[index] = value;
    const updatedPin = newPin.join('').slice(0, 6);
    
    setPin(updatedPin);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) nextInput.focus();
    }

    // Auto-submit when 6 digits entered
    if (updatedPin.length === 6) {
      setTimeout(() => verifyPin(updatedPin), 100);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      const prevInput = inputRefs.current[index - 1];
      if (prevInput) prevInput.focus();
    }
  };

  const verifyPin = async (pinToVerify = pin) => {
    if (pinToVerify.length !== 6) {
      setError('Please enter a 6-digit PIN');
      return;
    }

    // Check lockout
    const lockoutTime = localStorage.getItem('pin_lockout_until');
    if (lockoutTime && Date.now() < parseInt(lockoutTime)) {
      const remainingTime = Math.ceil((parseInt(lockoutTime) - Date.now()) / 1000 / 60);
      setError(`Account locked. Try again in ${remainingTime} minutes.`);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Import authService for PIN verification
      const { zeroKnowledgeAuth } = await import('@/api/authService');
      
      // Check if this is phone authentication
      const isPhoneAuth = userEmail.startsWith('phone:');
      const identifier = isPhoneAuth ? userEmail.slice(6) : userEmail; // Remove 'phone:' prefix
      
      // Verify PIN through backend API (support both email and phone)
      const result = await zeroKnowledgeAuth.verifyUserPin(identifier, pinToVerify, rememberMe);
      
      if (result.success) {
        // PIN correct - clear attempts and lockout
        localStorage.removeItem('pin_attempts');
        localStorage.removeItem('pin_lockout_until');
        
        toast.success('Welcome back!', { duration: 3000 });
        
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/chats');
        }
      } else {
        // PIN incorrect
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        localStorage.setItem('pin_attempts', newAttempts.toString());
        
        if (newAttempts >= MAX_ATTEMPTS) {
          // Lock account
          const lockoutUntil = Date.now() + (LOCKOUT_TIME * 60 * 1000);
          localStorage.setItem('pin_lockout_until', lockoutUntil.toString());
          setError(`Too many failed attempts. Account locked for ${LOCKOUT_TIME} minutes.`);
        } else {
          const remaining = MAX_ATTEMPTS - newAttempts;
          setError(`Incorrect PIN. ${remaining} attempts remaining.`);
        }
        
        // Clear PIN input
        setPin('');
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      }
    } catch (error) {
      console.error('PIN verification error:', error);
      setError(error.message || 'Failed to verify PIN. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      setIsLoading(true);
      
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [],
          userVerification: 'required',
          timeout: 60000
        }
      });

      if (credential) {
        // Biometric successful
        const sessionDuration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        const sessionExpiry = Date.now() + sessionDuration;
        
        localStorage.setItem('session_expiry', sessionExpiry.toString());
        localStorage.setItem('remember_me', rememberMe.toString());
        
        toast.success('Biometric authentication successful!');
        
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/chats');
        }
      }
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Biometric authentication was cancelled or failed. Please use your PIN.');
      } else {
        toast.error('Biometric authentication failed. Please use your PIN.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isLocked = () => {
    const lockoutTime = localStorage.getItem('pin_lockout_until');
    return lockoutTime && Date.now() < parseInt(lockoutTime);
  };

  return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md bg-black/20 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-blue-500/10"
      >
        <div className="flex flex-col items-center text-center">
          <CyphrLogo size="small" />
          
          <div className="mt-6 mb-2">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold">Welcome Back</h1>
            <p className="text-zinc-300 mt-2 text-sm">
              Enter your PIN to continue
            </p>
            {userEmail && (
              <p className="text-violet-400 mt-1 text-xs">{userEmail}</p>
            )}
          </div>

          {/* Biometric Option */}
          {showBiometric && !isLocked() && (
            <div className="mb-6">
              <Button
                onClick={handleBiometricAuth}
                disabled={isLoading}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Fingerprint className="w-5 h-5 mr-2" />
                Use Biometric Authentication
              </Button>
              
              <div className="flex items-center gap-3 my-4">
                <div className="h-px bg-white/20 flex-1"></div>
                <span className="text-xs text-gray-400">or enter PIN</span>
                <div className="h-px bg-white/20 flex-1"></div>
              </div>
            </div>
          )}

          {/* PIN Input */}
          <div className="mb-8 flex justify-center gap-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <input
                key={index}
                ref={(el) => inputRefs.current[index] = el}
                type="password"
                maxLength={1}
                value={pin[index] || ''}
                onChange={(e) => handlePinInput(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={isLoading || isLocked()}
                className={`w-14 h-16 text-2xl text-center bg-white/10 border rounded-lg text-white focus:bg-white/15 focus:outline-none transition-all ${
                  isLocked() 
                    ? 'border-red-400/50 bg-red-400/10' 
                    : error 
                      ? 'border-red-400 focus:border-red-400' 
                      : 'border-white/20 focus:border-violet-400'
                }`}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-400 text-sm text-left">{error}</p>
            </div>
          )}

          {/* Remember Me Toggle */}
          <div className="mb-6 flex items-center justify-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-600 bg-gray-800"
              />
              <span>Remember me for 30 days</span>
            </label>
          </div>

          {/* Submit Button */}
          {pin.length === 6 && (
            <Button 
              onClick={() => verifyPin()}
              disabled={isLoading || isLocked()}
              className="w-full group mb-4"
              size="lg"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              ) : (
                <span className="flex items-center justify-center">
                  Unlock
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              )}
            </Button>
          )}

          {/* Alternative Options */}
          <div className="space-y-3 w-full">
            <Button
              variant="outline"
              onClick={onForgotPin || (() => toast.info('Use email verification to reset your PIN'))}
              className="w-full text-violet-400 border-violet-400/30 hover:bg-violet-400/10"
              disabled={isLoading}
            >
              <Mail className="w-4 h-4 mr-2" />
              Forgot PIN? Use Email
            </Button>

            {onSwitchToEmail && (
              <Button
                variant="ghost"
                onClick={onSwitchToEmail}
                className="w-full text-gray-400 hover:text-white"
                disabled={isLoading}
              >
                Switch to Email Authentication
              </Button>
            )}
          </div>

          <p className="text-xs text-zinc-500 mt-6 flex items-center justify-center">
            <Shield className="w-3 h-3 mr-1.5" /> 
            Protected with post-quantum encryption
          </p>
        </div>
      </motion.div>
  );
}