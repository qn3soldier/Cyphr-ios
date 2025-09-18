import { useState, useEffect } from 'react';
import { useLocation, useNavigation } from '@react-navigation/native';
import { zeroKnowledgeAuth } from '../api/authService';
import { Button } from '../ui/button.tsx';
import CyphrLogo from '../components/CyphrLogo';
import Animated from 'react-native-reanimated';
import { ArrowRight, Mail, User, Fingerprint, Camera, Lock, Check, X, Loader } from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../api/supabaseClient';
import { toast } from 'react-native-toast-message';

export default function EmailVerification() {
  const navigate = useNavigation();
  const location = useLocation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(location.state?.email || '');
  const [isNewUser, setIsNewUser] = useState(() => {
    if (location.state?.isNewUser === false) return false;
    if (location.state?.isNewUser === true) return true;
    return true;
  });
  
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('otp'); // 'otp', 'profile'
  const [countdown, setCountdown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [enableBiometric, setEnableBiometric] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [enablePin, setEnablePin] = useState(false);
  const [userPin, setUserPin] = useState('');
  const [cyphrId, setCyphrId] = useState('');
  const [cyphrIdAvailable, setCyphrIdAvailable] = useState(null);
  const [cyphrIdSuggestions, setCyphrIdSuggestions] = useState([]);
  const [checkingCyphrId, setCheckingCyphrId] = useState(false);

  useEffect(() => {
    if (!email) {
      navigate('/');
      return;
    }
    checkBiometricSupport();
    
    // КРИТИЧНО: Проверить статус пользователя СРАЗУ при загрузке
    checkUserStatusAndRedirect();
  }, [email, navigate]);
  
  // Проверка статуса пользователя и перенаправление для существующих
  const checkUserStatusAndRedirect = async () => {
    if (!isNewUser && email) {
      console.log('🔍 Checking existing user status for:', email);
      setIsLoading(true);
      
      try {
        const userStatus = await zeroKnowledgeAuth.checkUserPin(email);
        console.log('👤 User status:', userStatus);
        
        if (userStatus.hasPIN || userStatus.biometricEnabled) {
          // Существующий пользователь с PIN/Biometry - сразу на PIN экран
          console.log('🔐 User has PIN/Biometry, redirecting to PIN login');
          navigate('/pin-login', { 
            state: { 
              userEmail: email, 
              userStatus: userStatus 
            } 
          });
          return;
        } else if (userStatus.userName) {
          // Существующий пользователь без PIN - сразу в чаты
          console.log('✅ Existing user without PIN, going to chats');
          sessionStorage.setItem('userId', userStatus.userId || 'temp');
          sessionStorage.setItem('userEmail', email);
          sessionStorage.setItem('userName', userStatus.userName);
          toast.success(`Welcome back, ${userStatus.userName}!`);
          navigate('/chats');
          return;
        }
      } catch (error) {
        console.log('ℹ️ User not found or error checking status, showing OTP for signup');
      } finally {
        setIsLoading(false);
      }
    }
    
    // Новый пользователь или не найден - показываем OTP
    console.log('📧 New user or not found, sending OTP...');
    if (isNewUser) {
      handleSendOTP();
    }
  };
  
  // Отправка OTP (только для новых пользователей)
  const handleSendOTP = async () => {
    try {
      const result = await zeroKnowledgeAuth.sendEmailOTP(email, isNewUser);
      
      if (result.success) {
        setCountdown(60);
        toast.success('Verification code sent to your email');
      } else if (result.shouldSwitchToSignIn) {
        // Пытались зарегистрироваться, но аккаунт уже существует
        toast.error('Account already exists! Switching to sign in...');
        setIsNewUser(false);
        setTimeout(() => {
          checkUserStatusAndRedirect();
        }, 1000);
      } else if (result.shouldSwitchToSignUp) {
        // Пытались войти, но аккаунт не найден
        toast.error('Account not found! Please sign up first...');
        setIsNewUser(true);
        setTimeout(() => {
          handleSendOTP();
        }, 1000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      setError(error.message || 'Failed to send verification code');
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
    if (countdown > 0) {
      const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [countdown > 0]);

  // Debounced check for Cyphr ID availability
  useEffect(() => {
    if (!cyphrId || cyphrId.length < 3) {
      setCyphrIdAvailable(null);
      setCyphrIdSuggestions([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setCheckingCyphrId(true);
      const result = await zeroKnowledgeAuth.checkCyphrIdAvailability(cyphrId);
      setCyphrIdAvailable(result.available);
      if (!result.available && result.suggestions) {
        setCyphrIdSuggestions(result.suggestions);
      } else {
        setCyphrIdSuggestions([]);
      }
      setCheckingCyphrId(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [cyphrId]);

  const handleVerifyOtp = async () => {
    if (otp.length < 6) return;
    setIsLoading(true);
    setError('');
    
    try {
      const result = await zeroKnowledgeAuth.verifyEmailOTP(email, otp, isNewUser);
      
      if (result.success) {
        const user = result.user;
        
        // Store user data
        sessionStorage.setItem('tempUser', JSON.stringify({
          id: user.id,
          email: email,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken
        }));
        
        const isNewUserFromBackend = result.isNewUser || result.needsSetup;
        
        if (isNewUserFromBackend) {
          // New user - go to profile setup
          setStep('profile');
        } else {
          // Existing user - check if they have PIN/Biometry enabled
          console.log('🔍 Existing user detected, checking PIN/Biometry status...');
          const userStatus = await zeroKnowledgeAuth.checkUserPin(email);
          
          if (userStatus.hasPIN || userStatus.biometricEnabled) {
            // User has PIN/Biometry - navigate to PIN login screen
            toast.success('Please enter your PIN to continue');
            navigate('/pin-login', { 
              state: { 
                userEmail: email, 
                userStatus: userStatus 
              } 
            });
          } else {
            // User exists but no PIN/Biometry - go directly to chats
            toast.success('Welcome back!');
            navigate('/chats');
          }
        }
      } else {
        throw new Error(result.error || 'Email OTP verification failed');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsResending(true);
    setError('');
    try {
      const result = await zeroKnowledgeAuth.sendEmailOTP(email);
      if (result.success) {
        setCountdown(60);
        toast.success('Verification code sent to your email');
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      setError(err.message || 'Failed to resend OTP.');
    } finally {
      setIsResending(false);
    }
  };

  const handleAvatarSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Avatar file too large. Please select a file under 5MB.');
        return;
      }
      setAvatar(file);
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
            name: email,
            displayName: fullName || email
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" }
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

  const handleCompleteSetup = async () => {
    if (!fullName.trim()) {
      setError('Full name is required');
      return;
    }
    
    if (cyphrId && cyphrId.length < 3) {
      setError('Cyphr ID must be at least 3 characters');
      return;
    }
    
    if (cyphrId && cyphrIdAvailable === false) {
      setError('This Cyphr ID is not available. Please choose another one.');
      return;
    }
    
    if (enablePin && userPin.length !== 6) {
      setError('PIN must be exactly 6 digits');
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
        
        try {
          // First try to create avatars bucket if it doesn't exist
          const { error: bucketError } = await supabase.storage
            .createBucket('avatars', {
              public: true,
              allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
              fileSizeLimit: 5242880 // 5MB
            });
          
          if (bucketError && !bucketError.message.includes('already exists')) {
            console.log('Failed to create avatars bucket:', bucketError);
          }
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, avatar, {
              cacheControl: '3600',
              upsert: true
            });
            
          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName);
            avatarUrl = urlData.publicUrl;
          } else {
            console.log('Avatar upload error:', uploadError);
          }
        } catch (uploadError) {
          console.log('Avatar upload failed, continuing without avatar:', uploadError);
        }
      }
      
      // Update user profile
      try {
        const updateData = { 
          full_name: fullName,
          avatar_url: avatarUrl
        };
        
        // Add Cyphr ID if provided
        if (cyphrId) {
          updateData.unique_id = cyphrId;
        }
        
        await supabase
          .from('users')
          .update(updateData)
          .eq('id', tempUser.id);
      } catch (profileError) {
        console.log('Profile update failed, continuing:', profileError);
      }
      
      // Store user session first
      sessionStorage.setItem('userId', tempUser.id);
      sessionStorage.setItem('userEmail', email);
      sessionStorage.setItem('userName', fullName);
      
      // Setup PIN if enabled
      if (enablePin && userPin) {
        const pinResult = await zeroKnowledgeAuth.setupPin(email, userPin, enableBiometric);
        if (!pinResult.success) {
          console.error('Failed to setup PIN, but continuing:', pinResult.error);
        }
      }
      
      // Setup biometric if enabled
      if (enableBiometric && biometricSupported) {
        await setupBiometric();
      }
      
      const userProfile = {
        id: tempUser.id,
        name: fullName,
        email: email,
        avatar_url: avatarUrl,
        bio: enableBiometric ? 'Biometric enabled' : null
      };
      sessionStorage.setItem('user_profile', JSON.stringify(userProfile));
      
      sessionStorage.removeItem('tempUser');
      sessionStorage.setItem('needs_wallet_setup', 'true');
      
      // Profile setup completed, go directly to chats
      const securitySetup = [];
      if (enablePin) securitySetup.push('PIN');
      if (enableBiometric) securitySetup.push('Biometric');
      
      if (securitySetup.length > 0) {
        toast.success(`Welcome! Profile created with ${securitySetup.join(' and ')} security.`);
      } else {
        toast.success('Welcome to Cyphr Messenger! Profile created successfully.');
      }
      
      // Navigate directly to chats
      navigate('/chats');
      
    } catch (err) {
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
              <h1 className="text-3xl font-bold mt-6">Verify Your Email</h1>
              <p className="text-zinc-300 mt-2 text-sm">
                Enter the 6-digit code sent to {email}
              </p>
              
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
                        
                        if (value && index < 5) {
                          const nextInput = e.target.nextElementSibling;
                          if (nextInput) nextInput.focus();
                        }
                        
                        if (otpString.length === 6) {
                          handleVerifyOtp();
                        }
                      }
                    }}
                    onKeyDown={(e) => {
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

          {step === 'profile' && (
            <>
              <h1 className="text-3xl font-bold mt-6">Complete Your Profile</h1>
              <p className="text-zinc-300 mt-2 text-sm">Set up your profile and security preferences</p>
              
              <div className="my-8 w-full space-y-6">
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

                <div>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-zinc-400 focus:border-blue-400 focus:bg-white/15 focus:outline-none transition-all"
                  />
                </div>

                {/* Cyphr ID Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Choose Your Unique Cyphr ID (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-4 text-gray-400 font-mono">@</div>
                    <input
                      type="text"
                      placeholder="johndoe"
                      value={cyphrId}
                      onChange={(e) => {
                        const value = e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
                        setCyphrId(value);
                        setError(''); // Clear error when user types
                      }}
                      className="w-full pl-8 pr-12 p-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-zinc-400 focus:border-blue-400 focus:bg-white/15 focus:outline-none transition-all"
                    />
                    <div className="absolute right-3 top-4">
                      {checkingCyphrId && <Loader className="w-5 h-5 animate-spin text-yellow-400" />}
                      {!checkingCyphrId && cyphrIdAvailable === true && <Check className="w-5 h-5 text-green-400" />}
                      {!checkingCyphrId && cyphrIdAvailable === false && <X className="w-5 h-5 text-red-400" />}
                    </div>
                  </div>
                  
                  {cyphrId.length > 0 && cyphrId.length < 3 && (
                    <p className="text-xs text-yellow-400 mt-1">Cyphr ID must be at least 3 characters</p>
                  )}
                  
                  {cyphrIdAvailable === true && (
                    <p className="text-xs text-green-400 mt-1">✅ Great! This Cyphr ID is available</p>
                  )}
                  
                  {cyphrIdAvailable === false && cyphrIdSuggestions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-yellow-400">This ID is taken. Try these:</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {cyphrIdSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => setCyphrId(suggestion)}
                            className="text-xs px-2 py-1 bg-white/10 rounded hover:bg-white/20 transition-colors border border-white/20 text-blue-300"
                          >
                            @{suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-400 mt-1">
                    Others can find you with @{cyphrId || 'your_id'}. Leave empty to auto-generate.
                  </p>
                </div>

                {/* Security Options Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white mb-3">Security Options (Optional)</h3>
                  
                  {/* PIN Setup */}
                  <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-purple-400" />
                        <div>
                          <p className="font-medium text-white">Quick Access PIN</p>
                          <p className="text-sm text-gray-300">Faster login with 6-digit PIN</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enablePin}
                          onChange={(e) => {
                            setEnablePin(e.target.checked);
                            if (!e.target.checked) setUserPin('');
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-purple-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                    </div>
                    
                    {enablePin && (
                      <div className="mt-3">
                        <input
                          type="password"
                          placeholder="Enter 6-digit PIN"
                          maxLength={6}
                          value={userPin}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            setUserPin(value);
                          }}
                          className="w-full p-3 bg-black/30 border border-purple-500/50 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
                        />
                        {userPin.length > 0 && userPin.length < 6 && (
                          <p className="text-xs text-yellow-400 mt-1">PIN must be 6 digits</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Biometric Authentication */}
                  {biometricSupported && (
                    <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Fingerprint className="w-5 h-5 text-blue-400" />
                          <div>
                            <p className="font-medium text-white">Biometric Authentication</p>
                            <p className="text-sm text-gray-300">Use fingerprint or face recognition</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableBiometric}
                            onChange={(e) => setEnableBiometric(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                        </label>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-400 text-center mt-2">
                    You can always change these settings later in Security Settings
                  </p>
                </div>
              </div>
              
              {error && <p className="text-red-400/90 text-sm mb-4">{error}</p>}
              
              <Button 
                onClick={handleCompleteSetup} 
                disabled={isLoading || !fullName.trim()} 
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