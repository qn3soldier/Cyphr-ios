import { useState, useEffect } from 'react';
import { useLocation, useNavigation } from '@react-navigation/native';
import { zeroKnowledgeAuth } from '../api/authService';
import { Button } from '../ui/button.tsx';
import CyphrLogo from '../components/CyphrLogo';
import Animated from 'react-native-reanimated';
import { ArrowRight, Upload, User, Shield, Fingerprint, Camera } from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../api/supabaseClient';
import { toast } from 'react-native-toast-message';
import SecureTOTPSetup from '../components/auth/SecureTOTPSetup';

export default function PhoneRegistration() {
  const navigate = useNavigation();
  const location = useLocation();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [isNewUser, setIsNewUser] = useState(location.state?.isNewUser ?? true);
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(true); // Set to true since we came from Welcome after OTP was sent
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState('otp'); // 'otp', 'totp_setup', 'profile', 'security'
  const [useTOTP, setUseTOTP] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [countdown, setCountdown] = useState(60); // Start 60 second countdown
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [enableBiometric, setEnableBiometric] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [useEmailFallback, setUseEmailFallback] = useState(false);
  const [email, setEmail] = useState('');
  const [isRussianUser, setIsRussianUser] = useState(false);

  useEffect(() => {
    if (!phone) {
      navigate('/');
      return;
    }
    
    // Check biometric support
    checkBiometricSupport();
    
    // Detect Russian users for fallback
    detectRussianUser();
    
    // КРИТИЧНО: Проверить статус пользователя СРАЗУ при загрузке
    checkPhoneUserStatusAndRedirect();
  }, [phone, navigate]);
  
  // Проверка статуса пользователя по телефону и перенаправление для существующих
  const checkPhoneUserStatusAndRedirect = async () => {
    if (!isNewUser && phone) {
      console.log('🔍 Checking existing phone user status for:', phone);
      setIsLoading(true);
      
      try {
        const userStatus = await zeroKnowledgeAuth.checkUserByPhone(phone);
        console.log('👤 Phone user status:', userStatus);
        
        if (userStatus.userExists) {
          if (userStatus.hasPIN || userStatus.biometricEnabled) {
            // Существующий пользователь с PIN/Biometry - сразу на PIN экран
            console.log('🔐 Phone user has PIN/Biometry, redirecting to PIN login');
            navigate('/pin-login', { 
              state: { 
                userEmail: `phone:${phone}`, // Специальный формат для phone 
                userStatus: userStatus,
                isPhoneAuth: true
              } 
            });
            return;
          } else if (userStatus.userName) {
            // Существующий пользователь без PIN - сразу в чаты
            console.log('✅ Existing phone user without PIN, going to chats');
            sessionStorage.setItem('userId', userStatus.userId);
            sessionStorage.setItem('userPhone', phone);
            sessionStorage.setItem('userName', userStatus.userName);
            toast.success(`Welcome back, ${userStatus.userName}!`);
            navigate('/chats');
            return;
          }
        }
      } catch (error) {
        console.log('ℹ️ Phone user not found or error checking status, showing OTP for signup');
      } finally {
        setIsLoading(false);
      }
    }
    
    // Новый пользователь или не найден - показываем OTP
    console.log('📱 New phone user or not found, OTP flow will continue...');
  };
  
  const detectRussianUser = async () => {
    try {
      // Check phone number for +7 prefix
      const isRuPhone = phone.startsWith('+7');
      
      // Check IP geolocation (optional)
      let isRuIP = false;
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        isRuIP = data.country_code === 'RU';
      } catch (error) {
        console.log('IP geolocation failed:', error);
      }
      
      const ruDetected = isRuPhone || isRuIP;
      setIsRussianUser(ruDetected);
      
      if (ruDetected) {
        toast.info('📧 Email verification available as alternative to SMS');
        setUseEmailFallback(true);
      }
    } catch (error) {
      console.error('Russian user detection failed:', error);
    }
  };

  const checkBiometricSupport = async () => {
    try {
      if (window.PublicKeyCredential && 
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) {
        setBiometricSupported(true);
      }
    } catch (error) {
      console.log('Biometric not supported:', error);
      setBiometricSupported(false);
    }
  };

  useEffect(() => {
    const timer = countdown > 0 && setInterval(() => setCountdown(countdown - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerifyOtp = async () => {
    if (otp.length < 6) return;
    setIsLoading(true);
    setError('');
    try {
      console.log('📱 Attempting to verify OTP:', otp, 'for phone:', phone);
      
      // Verify OTP (local TOTP or Twilio SMS)
      console.log('🔍 DEBUG: PhoneRegistration verifying OTP with isNewUser =', isNewUser);
      const result = useTOTP 
        ? await zeroKnowledgeAuth.verifyLocalOTP(phone, otp)
        : await zeroKnowledgeAuth.verifyOTP(phone, otp, isNewUser);
      console.log('📱 Verification result:', result);
      
      if (result.success) {
        // User creation is now handled by the backend during OTP verification
        // The backend returns the created/found user in the result
        const user = result.user;
        
        // Store temporary user data for password step
        // Note: sharedSecret is handled internally by the crypto system
        sessionStorage.setItem('tempUser', JSON.stringify({
          id: user.id,
          publicKey: result.user.publicKey,
          phone: result.user.phone
        }));
        
        // Move to profile or TOTP setup based on user preference
        if (!useTOTP && localStorage.getItem('totp_secret')) {
          // User prefers SMS but has TOTP setup
          setStep('profile');
        } else if (useTOTP && !localStorage.getItem('totp_secret')) {
          // User wants TOTP but hasn't set it up
          setStep('totp_setup');
        } else {
          setStep('profile');
        }
      } else {
        throw new Error(result.error || 'OTP verification failed');
      }

    } catch (err) {
      console.error('❌ PhoneRegistration handleVerifyOtp error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsResending(true);
    setError('');
    try {
      await zeroKnowledgeAuth.initiatePhoneAuth(phone);
      setCountdown(60);
    } catch (err) {
      setError(err.message || 'Failed to resend OTP.');
    } finally {
      setIsResending(false);
    }
  };

  const handleAvatarSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Avatar file too large. Please select a file under 5MB.');
        return;
      }
      
      setAvatar(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => setAvatarPreview(e.target.result);
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const setupBiometric = async () => {
    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "Cyphr Messenger" },
          user: {
            id: crypto.getRandomValues(new Uint8Array(64)),
            name: phone,
            displayName: fullName || phone
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },  // ES256
            { alg: -257, type: "public-key" } // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
          }
        }
      });
      
      if (credential) {
        toast.success('Biometric authentication enabled!');
        return true;
      }
    } catch (error) {
      console.error('Biometric setup failed:', error);
      toast.error('Failed to setup biometric authentication');
      return false;
    }
  };

  const handleTOTPComplete = () => {
    setUseTOTP(true);
    toast.success('TOTP authentication setup complete!');
    setStep('profile');
  };

  const handleTOTPSkip = () => {
    setUseTOTP(false);
    toast.info('Continuing with SMS authentication');
    setStep('profile');
  };

  const handleCompleteSetup = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const tempUser = JSON.parse(sessionStorage.getItem('tempUser'));
      if (!tempUser) {
        throw new Error('Session expired. Please try again.');
      }
      
      // Upload avatar if selected
      let avatarUrl = null;
      if (avatar) {
        const fileExt = avatar.name.split('.').pop();
        const fileName = `${tempUser.id}-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatar, {
            cacheControl: '3600',
            upsert: true
          });
          
        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
          console.log('Skipping avatar upload for now due to RLS policy');
          // Skip avatar upload but continue with user creation
        } else {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          avatarUrl = urlData.publicUrl;
        }
      }
      
      // Hash password and save to user record  
      const passwordHash = await zeroKnowledgeAuth.hashPassword(password);
      
      // Use existing supabase client instead of creating new one
      const adminSupabase = supabase;
      
      // Update user with password, avatar, and bio
      await adminSupabase
        .from('users')
        .update({ 
          password_hash: passwordHash,
          avatar_url: avatarUrl,
          bio: enableBiometric ? 'Biometric enabled' : null
        })
        .eq('id', tempUser.id);
      
      // Setup biometric if enabled
      if (enableBiometric && biometricSupported) {
        await setupBiometric();
      }
      
      // Store auth data locally with password encryption
      // Generate a new shared secret for this user
      const userSharedSecret = crypto.getRandomValues(new Uint8Array(32));
      await zeroKnowledgeAuth.storeAuthData(userSharedSecret, password);
      
      // Store user profile information
      sessionStorage.setItem('userId', tempUser.id);
      sessionStorage.setItem('userPhone', phone);
      sessionStorage.setItem('userName', fullName);
      
      // Store user profile object
      const userProfile = {
        id: tempUser.id,
        name: fullName,
        phone: phone,
        avatar_url: avatarUrl,
        bio: enableBiometric ? 'Biometric enabled' : null
      };
      sessionStorage.setItem('user_profile', JSON.stringify(userProfile));
      
      sessionStorage.removeItem('tempUser');
      
      toast.success('Registration completed successfully!');
      
      // Initialize HD wallet for new user
      try {
        console.log('🆕 Creating HD wallet for new user...');
        // Mark that wallet should be initialized on first visit to wallet
        sessionStorage.setItem('needs_wallet_setup', 'true');
      } catch (walletError) {
        console.warn('⚠️ Wallet initialization scheduled for later:', walletError);
      }
      
      navigate('/chats'); // Go directly to chats after registration
      
    } catch (err) {
      console.error('❌ Setup completion error:', err);
      setError(err.message || 'Failed to complete setup.');
    } finally {
      setIsLoading(false);
    }
  };


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
        <div className="flex flex-col items-center text-center">
          <CyphrLogo size="small" />
          
          {step === 'otp' && (
            <>
              <h1 className="text-3xl font-bold mt-6">Confirm Your Identity</h1>
              <p className="text-zinc-300 mt-2 text-sm">
                {useTOTP ? 'Enter code from your authenticator app' : `Enter the 6-digit code sent to ${phone}`}
              </p>
              
              {/* TOTP Toggle */}
              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Use TOTP instead of SMS</p>
                    <p className="text-xs text-gray-400">More secure, works offline</p>
                  </div>
                  <button
                    onClick={() => setUseTOTP(!useTOTP)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      useTOTP ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        useTOTP ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              
              {/* Email Fallback for Russian Users */}
              {isRussianUser && (
                <div className="mt-4 p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Use Email Verification</p>
                      <p className="text-xs text-gray-400">Alternative to SMS for РФ users</p>
                    </div>
                    <button
                      onClick={() => setUseEmailFallback(!useEmailFallback)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        useEmailFallback ? 'bg-orange-600' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          useEmailFallback ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  {useEmailFallback && (
                    <div className="mt-3">
                      <input
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-orange-400 focus:bg-white/15 focus:outline-none transition-all"
                      />
                      <Button 
                        onClick={async () => {
                          if (!email) return;
                          try {
                            setIsLoading(true);
                            // Send email verification code
                            toast.info('📧 Email verification code sent');
                            // TODO: Implement email verification API
                          } catch (error) {
                            toast.error('Failed to send email verification');
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        disabled={!email || isLoading}
                        className="w-full mt-2"
                        size="sm"
                      >
                        Send Email Code
                      </Button>
                    </div>
                  )}
                </div>
              )}
              
              <div className="my-8 flex justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input
                    key={index}
                    type="text"
                    maxLength={1}
                    value={otp[index] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^\d*$/.test(value)) {
                        const newOtp = otp.split('');
                        newOtp[index] = value;
                        const otpString = newOtp.join('');
                        setOtp(otpString);
                        
                        // Auto-focus next input
                        if (value && index < 5) {
                          const nextInput = e.target.nextElementSibling;
                          if (nextInput) nextInput.focus();
                        }
                        
                        // Auto-verify when complete
                        if (otpString.length === 6) {
                          handleVerifyOtp();
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      // Handle backspace
                      if (e.key === 'Backspace' && !otp[index] && index > 0) {
                        const prevInput = e.target.previousElementSibling;
                        if (prevInput) prevInput.focus();
                      }
                    }}
                    className="w-14 h-16 text-2xl text-center bg-white/10 border border-white/20 rounded-lg text-white focus:border-blue-400 focus:bg-white/15 focus:outline-none transition-all"
                  />
                ))}
              </div>
              
              {error && <p className="text-red-400/90 text-sm mb-4">{error}</p>}
              
              <Button onClick={handleVerifyOtp} disabled={isLoading || otp.length < 6} className="w-full group" size="lg">
                 {isLoading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                ) : (
                  <span className="flex items-center justify-center">
                    Verify & Proceed
                    <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                )}
              </Button>
              
              <div className="mt-6">
                {countdown > 0 ? (
                  <p className="text-zinc-400 text-sm">Resend code in {countdown}s</p>
                ) : (
                  <Button variant="link" onClick={handleResendOtp} disabled={isResending} className="text-blue-400 hover:text-blue-300">
                    {isResending ? 'Sending...' : 'Resend Code'}
                  </Button>
                )}
              </div>
            </>
          )}

          {step === 'totp_setup' && (
            <SecureTOTPSetup
              userId={JSON.parse(sessionStorage.getItem('tempUser') || '{}').id}
              onComplete={handleTOTPComplete}
              onSkip={handleTOTPSkip}
            />
          )}

          {step === 'profile' && (
            <>
              <h1 className="text-3xl font-bold mt-6">Complete Your Profile</h1>
              <p className="text-zinc-300 mt-2 text-sm">Add your details and choose security options</p>
              
              <div className="my-8 w-full space-y-6">
                {/* Avatar Selection */}
                <div className="text-center">
                  <label className="block text-sm font-medium text-gray-300 mb-4">
                    Profile Picture (Optional)
                  </label>
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-12 h-12 text-gray-400" />
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700">
                        <Camera className="w-4 h-4 text-white" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarSelect}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Name Input */}
                <div>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-zinc-400 focus:border-blue-400 focus:bg-white/15 focus:outline-none transition-all"
                  />
                </div>

                {/* Biometric Toggle */}
                {biometricSupported && (
                  <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Fingerprint className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="font-medium text-white">Biometric Authentication</p>
                          <p className="text-sm text-gray-400">Use fingerprint or face recognition</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableBiometric}
                          onChange={(e) => setEnableBiometric(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                )}
              </div>
              
              {error && <p className="text-red-400/90 text-sm mb-4">{error}</p>}
              
              <Button 
                onClick={() => setStep('security')} 
                disabled={!fullName.trim()} 
                className="w-full group" 
                size="lg"
              >
                <span className="flex items-center justify-center">
                  Continue to Security
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Button>
            </>
          )}

          {step === 'security' && (
            <>
              <h1 className="text-3xl font-bold mt-6">Secure Your Account</h1>
              <p className="text-zinc-300 mt-2 text-sm">Create a strong password to protect your quantum-safe keys</p>
              
              <div className="my-8 w-full space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-zinc-400 focus:border-blue-400 focus:bg-white/15 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Enter password (min 8 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-zinc-400 focus:border-blue-400 focus:bg-white/15 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-zinc-400 focus:border-blue-400 focus:bg-white/15 focus:outline-none transition-all"
                  />
                </div>
              </div>
              
              {error && <p className="text-red-400/90 text-sm mb-4">{error}</p>}
              
              <Button 
                onClick={handleCompleteSetup} 
                disabled={isLoading || !fullName.trim() || password.length < 8 || password !== confirmPassword} 
                className="w-full group" 
                size="lg"
              >
                 {isLoading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                ) : (
                  <span className="flex items-center justify-center">
                    Complete Registration
                    <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                )}
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
} 