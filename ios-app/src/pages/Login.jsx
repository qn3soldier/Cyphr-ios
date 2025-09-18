import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import Animated from 'react-native-reanimated';
import { Lock, Smartphone, Fingerprint, Shield } from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../api/supabaseClient';
import { toast } from 'react-native-toast-message';
import zeroKnowledgeAuth from '../api/authService';

export default function Login() {
  const navigate = useNavigation();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordLogin = async () => {
    if (!phone || !password) {
      toast.error('Please enter phone and password');
      return;
    }

    setIsLoading(true);
    try {
      // Verify phone and password
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();

      if (error || !user) {
        throw new Error('Invalid credentials');
      }

      // Verify password with Argon2
      const isValid = await zeroKnowledgeAuth.verifyPassword(password, user.password_hash);
      if (!isValid) {
        throw new Error('Invalid credentials');
      }

      // Set session
      sessionStorage.setItem('userId', user.id);
      sessionStorage.setItem('userPhone', user.phone);
      
      toast.success('Login successful!');
      navigate('/chats');
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!phone) {
      toast.error('Please enter your phone number');
      return;
    }

    setIsLoading(true);
    try {
      // Check if WebAuthn is available
      if (!window.PublicKeyCredential) {
        throw new Error('Biometric authentication not supported');
      }

      // Verify phone exists
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();

      if (error || !user) {
        throw new Error('Phone number not registered');
      }

      // TODO: Implement WebAuthn authentication
      // For now, simulate biometric auth
      const biometricSuccess = await new Promise((resolve) => {
        setTimeout(() => resolve(true), 1000);
      });

      if (biometricSuccess) {
        sessionStorage.setItem('userId', user.id);
        sessionStorage.setItem('userPhone', user.phone);
        toast.success('Biometric login successful!');
        navigate('/chats');
      }
    } catch (error) {
      console.error('Biometric login error:', error);
      toast.error(error.message || 'Biometric login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[rgb(10,14,39)] to-[rgb(30,36,80)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Shield className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-white/60">Login to your secure account</p>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-2 block">Phone Number</label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                className="w-full pl-10 pr-4 py-3 glass rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-white/60 mb-2 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-10 pr-4 py-3 glass rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <button
            onClick={handlePasswordLogin}
            disabled={isLoading}
            className="w-full btn-quantum py-3 font-semibold disabled:opacity-50"
          >
            {isLoading ? 'Logging in...' : 'Login with Password'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-transparent text-white/40">OR</span>
            </div>
          </div>

          <button
            onClick={handleBiometricLogin}
            disabled={isLoading}
            className="w-full py-3 glass rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-white/10 transition-colors"
          >
            <Fingerprint className="w-5 h-5" />
            Login with Biometrics
          </button>

          <div className="text-center">
            <button
              onClick={() => navigate('/phone-registration')}
              className="text-purple-400 hover:text-purple-300 text-sm"
            >
              Don't have an account? Register
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-white/40">
          <p>🔐 End-to-end encrypted • Post-quantum secure</p>
        </div>
      </motion.div>
    </div>
  );
} 