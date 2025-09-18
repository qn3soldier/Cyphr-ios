import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { zeroKnowledgeAuth } from '@/api/authService';
import { Button } from '@/ui/button';
import CyphrLogo from '@/components/CyphrLogo';
import PinSetup from '@/components/wallet/PinSetup';
import PinLogin from '@/components/auth/PinLogin';
import { motion } from 'framer-motion';
import { Shield, Lock, Zap, MessageSquare, ArrowRight, Mail, AtSign, Phone, Fingerprint, Key } from 'lucide-react';
import 'react-phone-number-input/style.css'
import PhoneInput from 'react-phone-number-input'
import { toast } from 'sonner';
import { hashPassword as argon2Hash } from '@/api/argon2Wrapper';

export default function Welcome() {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cyphrId, setCyphrId] = useState('');
  const [loginMethod, setLoginMethod] = useState('phone'); // 'phone', 'email', 'cyphr_id'
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(true); // Toggle between Sign Up and Login
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showPinLogin, setShowPinLogin] = useState(false);
  const [userHasPin, setUserHasPin] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check if user already has a session
    const userId = sessionStorage.getItem('userId');
    if (userId) {
      navigate('/chats');
    }
  }, [navigate]);


  const handleSignIn = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      if (loginMethod === 'phone') {
        if (!phone) {
          setError("Please enter a phone number.");
          return;
        }
        
        console.log('📱 Phone authentication:', isNewUser ? 'SIGN UP' : 'LOGIN');
        
        // ENTERPRISE LOGIC: Check if phone already exists (same as email)
        const pinCheck = await checkUserPin(phone);
        
        if (isNewUser) {
          // SIGN UP: Prevent registration if user already exists
          if (pinCheck.hasPIN || pinCheck.success) {
            setError('This phone is already registered. Please use Login instead.');
            toast.error('Phone already registered. Switching to Login.');
            setIsNewUser(false); // Switch to Login mode
            return;
          }
          console.log('✅ New phone, proceeding with Sign Up');
        } else {
          // LOGIN: Check if they have PIN first
          if (pinCheck.hasPIN) {
            console.log('✅ User has PIN, showing PIN login');
            setUserHasPin(true);
            setShowPinLogin(true);
            return;
          } else {
            console.log('⚠️ User has no PIN, using phone OTP');
          }
        }
        
        // Continue with phone OTP (for new users or existing users without PIN)
        console.log('📱 DEBUG: About to navigate with isNewUser =', isNewUser);
        const result = await zeroKnowledgeAuth.initiatePhoneAuth(phone);
        console.log('📱 InitiatePhoneAuth result:', result);
        
        if (!result.success) {
          console.error('❌ Phone OTP failed:', result.error);
          throw new Error(result.error || 'Failed to send phone OTP.');
        }
        
        toast.success(`SMS verification code sent for ${isNewUser ? 'registration' : 'login'}`, { duration: 5000 });
        console.log('📱 DEBUG: Navigating to phone-registration with state:', { phone, isNewUser });
        navigate('/phone-registration', { state: { phone, isNewUser } });
        
      } else if (loginMethod === 'email') {
        if (!email) {
          setError("Please enter an email address.");
          return;
        }
        
        console.log('📧 Email authentication:', isNewUser ? 'SIGN UP' : 'LOGIN');
        
        // ENTERPRISE LOGIC: Check user status first
        const userStatus = await zeroKnowledgeAuth.checkUserStatus(email);
        
        if (isNewUser) {
          // SIGN UP: Prevent registration if user already exists
          if (userStatus.success && userStatus.userExists) {
            setError('This email is already registered. Please use Login instead.');
            toast.error('Email already registered. Switching to Login.');
            setIsNewUser(false); // Switch to Login mode
            return;
          }
          console.log('✅ New email, proceeding with Sign Up');
        } else {
          // LOGIN: Check if user exists and has PIN
          if (userStatus.success && !userStatus.userExists) {
            setError('Email not registered. Please use Sign Up instead.');
            toast.error('Email not found. Switching to Sign Up.');
            setIsNewUser(true); // Switch to Sign Up mode
            return;
          }
          
          if (userStatus.success && userStatus.hasPIN) {
            console.log('✅ User has PIN, showing PIN login');
            setUserHasPin(true);
            setShowPinLogin(true);
            return;
          } else {
            console.log('⚠️ User exists but has no PIN, using email OTP');
          }
        }
        
        // Continue with email OTP (for new users or existing users without PIN)
        console.log('📧 DEBUG: About to navigate with isNewUser =', isNewUser);
        const result = await zeroKnowledgeAuth.sendEmailOTP(email, isNewUser);
        console.log('📧 Email OTP result:', result);
        
        if (!result.success) {
          // Handle enterprise validation switches
          if (result.shouldSwitchToSignIn) {
            setIsNewUser(false);
            setError(result.error);
            return;
          }
          if (result.shouldSwitchToSignUp) {
            setIsNewUser(true);
            setError(result.error);
            return;
          }
          console.error('❌ Email OTP failed:', result.error);
          throw new Error(result.error || 'Failed to send email OTP.');
        }
        
        toast.success(`Email verification code sent for ${isNewUser ? 'registration' : 'login'}`, { duration: 5000 });
        console.log('📧 DEBUG: Navigating to email-verification with state:', { email, isNewUser });
        navigate('/email-verification', { state: { email, isNewUser } });
        
      } else if (loginMethod === 'cyphr_id') {
        if (!cyphrId) {
          setError("Please enter your Cyphr ID.");
          return;
        }
        
        if (isNewUser) {
          // New users need to register first with another method
          toast.error('New users must register with phone or email first, then set up Cyphr ID');
          return;
        }
        
        // For existing users, navigate to password entry
        navigate('/cyphr-id-login', { state: { cyphrId } });
        
      } else if (loginMethod === 'cyphr_identity') {
        if (!isNewUser) {
          toast.error('Cyphr Identity login not yet implemented. Use other methods to sign in.');
          return;
        }
        
        // New users: Navigate to Cyphr Identity creation
        console.log('🔐 Starting Cyphr Identity creation...');
        navigate('/crypto-signup');
      }
    } catch (err) {
      console.error('❌ Welcome handleSignIn error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔐 PIN Setup Handler - После успешной регистрации
  const handlePinSetupComplete = async (pin, biometricEnabled) => {
    try {
      console.log('🔐 PIN setup completed:', { pin: pin.length + ' digits', biometricEnabled });
      
      // Сохраняем PIN локально (зашифрованно)
      const encryptedPin = await argon2Hash(pin);
      localStorage.setItem('user_pin_hash', encryptedPin);
      localStorage.setItem('biometric_enabled', biometricEnabled.toString());
      
      toast.success(`Security setup completed! ${biometricEnabled ? 'Biometric authentication enabled.' : 'PIN authentication enabled.'}`);
      setShowPinSetup(false);
      
      // Перенаправляем в главное приложение
      navigate('/chats');
      
    } catch (error) {
      console.error('❌ PIN setup error:', error);
      throw new Error('Failed to setup security. Please try again.');
    }
  };

  const handlePinSetupSkip = () => {
    console.log('⏭️ PIN setup skipped by user');
    setShowPinSetup(false);
    navigate('/chats');
  };

  // 🔐 PIN Login Handlers for existing users
  const handlePinLoginSuccess = () => {
    console.log('✅ PIN login successful');
    setShowPinLogin(false);
    toast.success('Welcome back!', { duration: 3000 });
    navigate('/chats');
  };

  const handleSwitchToEmail = () => {
    console.log('📧 Switching from PIN to email authentication');
    setShowPinLogin(false);
    // Continue with email OTP flow
    handleEmailOTPFallback();
  };

  const handleForgotPin = () => {
    console.log('❓ User forgot PIN, using email OTP for reset');
    setShowPinLogin(false);
    handleEmailOTPFallback();
  };

  const handleEmailOTPFallback = async () => {
    try {
      setIsLoading(true);
      const result = await zeroKnowledgeAuth.sendEmailOTP(email);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send email OTP.');
      }
      
      toast.success('Email verification code sent', { duration: 5000 });
      // Navigate with isNewUser = false for existing users
      navigate('/email-verification', { state: { email, isNewUser: false, resetPin: true } });
    } catch (err) {
      console.error('❌ Email OTP fallback error:', err);
      setError(err.message || 'Failed to send verification email.');
    } finally {
      setIsLoading(false);
    }
  };

  const primaryMethods = [
    { id: 'phone', label: 'Phone Number', icon: Phone, description: 'Quick & familiar' },
    { id: 'email', label: 'Email Address', icon: Mail, description: 'Simple & secure' },
    { id: 'cyphr_identity', label: 'Cyphr Identity', icon: Key, description: 'Next-generation security', premium: true }
  ];

  // If showing PIN login, don't show the regular form
  if (showPinLogin) {
    return (
      <div className="relative min-h-screen w-full bg-gradient-to-b from-[#1a1a2e] to-[#16213e] text-white flex items-center justify-center p-4 overflow-hidden font-sans">
        <div className="absolute top-0 left-0 w-64 h-64 bg-purple-600 rounded-full filter blur-3xl opacity-20"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-600 rounded-full filter blur-3xl opacity-20"></div>
        
        <PinLogin 
          userEmail={email}
          onSuccess={handlePinLoginSuccess}
          onForgotPin={handleForgotPin}
          onSwitchToEmail={handleSwitchToEmail}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-[#1a1a2e] to-[#16213e] text-white flex items-center justify-center p-4 overflow-hidden font-sans">
       <div className="absolute top-0 left-0 w-64 h-64 bg-purple-600 rounded-full filter blur-3xl opacity-20"></div>
       <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-600 rounded-full filter blur-3xl opacity-20"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md bg-black/20 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-blue-500/10"
      >
        <form onSubmit={handleSignIn} className="flex flex-col items-center">
          <div className="mb-6">
            <CyphrLogo size="small" />
          </div>
          
          <h1 className="text-3xl font-bold tracking-tight text-white text-center">Cyphr Messenger</h1>
          <p className="text-zinc-300 mt-2 text-sm text-center">Secure messaging with post-quantum encryption</p>
          
          {/* Toggle between Sign Up and Login */}
          <div className="flex gap-2 mt-6 mb-4 p-1 bg-white/5 rounded-lg">
            <button
              type="button"
              onClick={() => setIsNewUser(true)}
              className={`px-4 py-2 rounded-md transition-all ${
                isNewUser ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => setIsNewUser(false)}
              className={`px-4 py-2 rounded-md transition-all ${
                !isNewUser ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              Login
            </button>
          </div>

          {/* Primary Authentication Methods - ENTERPRISE DESIGN */}
          <div className="mb-6 w-full space-y-3">
            {primaryMethods.slice(0, 2).map((method) => {
              const Icon = method.icon;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setLoginMethod(method.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                    loginMethod === method.id
                      ? 'bg-gradient-to-r from-violet-600/20 to-purple-600/20 border border-violet-500/50 shadow-lg shadow-violet-500/20'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    loginMethod === method.id ? 'bg-violet-500' : 'bg-white/10'
                  }`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-white">{method.label}</h3>
                    <p className="text-sm text-zinc-400">{method.description}</p>
                  </div>
                </button>
              );
            })}
            
            {/* Cyphr Identity - Premium Feature */}
            <button
              type="button"
              onClick={() => setLoginMethod('cyphr_identity')}
              className={`w-full relative overflow-hidden rounded-xl transition-all ${
                loginMethod === 'cyphr_identity'
                  ? 'bg-gradient-to-r from-purple-600/30 to-blue-600/30 border border-purple-500/50 shadow-lg shadow-purple-500/20'
                  : 'bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/20 hover:border-purple-500/40'
              }`}
            >
              <div className="absolute top-2 right-2">
                <div className="px-2 py-1 bg-gradient-to-r from-gold-500 to-yellow-500 rounded-full">
                  <span className="text-xs font-bold text-black">PREMIUM</span>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  loginMethod === 'cyphr_identity' 
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500' 
                    : 'bg-gradient-to-r from-purple-600/50 to-blue-600/50'
                }`}>
                  <Key className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-white">Cyphr Identity</h3>
                  <p className="text-sm text-blue-300">Next-generation quantum-safe security</p>
                </div>
              </div>
            </button>
          </div>
          
          {/* Input Fields Based on Selected Method */}
          <div className="w-full mb-6">
            {loginMethod === 'phone' && (
              <div className="phone-input-container">
                <PhoneInput
                  international
                  defaultCountry="US"
                  placeholder="Enter phone number"
                  value={phone}
                  onChange={setPhone}
                  className="w-full"
                />
              </div>
            )}
            
            {loginMethod === 'email' && (
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full glass rounded-lg px-4 py-3 text-white placeholder-white/60 border border-white/20 focus:border-purple-400 focus:outline-none"
              />
            )}
            
            {loginMethod === 'cyphr_id' && (
              <input
                type="text"
                placeholder="@username"
                value={cyphrId}
                onChange={(e) => setCyphrId(e.target.value)}
                className="w-full glass rounded-lg px-4 py-3 text-white placeholder-white/60 border border-white/20 focus:border-purple-400 focus:outline-none"
              />
            )}
            
            {loginMethod === 'cyphr_identity' && (
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center mb-6 mx-auto relative">
                  <Key className="w-10 h-10 text-white" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-gold-500 to-yellow-500 rounded-full flex items-center justify-center">
                    <Shield className="w-3 h-3 text-black" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  Cyphr Identity
                </h3>
                <p className="text-zinc-300 text-sm mb-6 max-w-sm mx-auto">
                  Create your sovereign digital identity protected by quantum-safe cryptography. 
                  No emails, passwords, or third parties required.
                </p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/5">
                    <Shield className="w-4 h-4 text-green-400" />
                    <span className="text-green-300">Quantum-Safe</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/5">
                    <Fingerprint className="w-4 h-4 text-blue-400" />
                    <span className="text-blue-300">Device-Bound</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/5">
                    <Key className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-300">Self-Sovereign</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {error && <p className="text-red-400/90 text-sm mb-4 text-left w-full">{error}</p>}
          
          <Button 
            type="submit" 
            disabled={isLoading || 
              (!phone && loginMethod === 'phone') || 
              (!email && loginMethod === 'email') || 
              (!cyphrId && loginMethod === 'cyphr_id') ||
              (loginMethod === 'cyphr_identity' && !isNewUser)
            } 
            size="lg" 
            className={`w-full group ${
              loginMethod === 'cyphr_identity' 
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700' 
                : ''
            }`}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            ) : (
              <span className="flex items-center justify-center">
                {loginMethod === 'cyphr_identity' 
                  ? 'Create Cyphr Identity' 
                  : (isNewUser ? 'Continue' : 'Login')
                }
                <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            )}
          </Button>

          {/* Cyphr ID Login Option - Only for Login */}
          {!isNewUser && (
            <div className="mt-4 text-center">
              <p className="text-xs text-zinc-500 mb-2">Already have a Cyphr ID?</p>
              <Button
                variant="outline"
                onClick={() => {
                  const cyphrIdInput = prompt('Enter your Cyphr ID:', '@');
                  if (cyphrIdInput && cyphrIdInput.length > 1) {
                    navigate('/cyphr-id-login', { state: { cyphrId: cyphrIdInput } });
                  }
                }}
                className="text-violet-400 border-violet-400/30 hover:bg-violet-400/10"
                size="sm"
              >
                <AtSign className="w-4 h-4 mr-2" />
                Login with Cyphr ID
              </Button>
            </div>
          )}

          {/* Biometric Login Option */}
          <button
            type="button"
            className="mt-4 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            onClick={() => toast.info('Biometric authentication coming soon!')}
          >
            <Fingerprint className="w-4 h-4" />
            <span className="text-sm">Use Biometric Authentication</span>
          </button>

          <p className="text-xs text-zinc-500 mt-6 flex items-center">
            <Lock className="w-3 h-3 mr-1.5" /> End-to-end and post-quantum encrypted.
          </p>
        </form>
      </motion.div>

      {/* 🔐 PIN Setup Modal - Показывается после успешной регистрации */}
      {showPinSetup && (
        <PinSetup 
          onComplete={handlePinSetupComplete}
          onSkip={handlePinSetupSkip}
        />
      )}
    </div>
  );
}