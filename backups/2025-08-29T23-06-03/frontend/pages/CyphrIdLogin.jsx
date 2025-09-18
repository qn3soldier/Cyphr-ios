import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { zeroKnowledgeAuth } from '@/api/authService';
import { Button } from '@/ui/button';
import CyphrLogo from '@/components/CyphrLogo';
import { motion } from 'framer-motion';
import { ArrowRight, AtSign, Eye, EyeOff, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function CyphrIdLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [cyphrId, setCyphrId] = useState(location.state?.cyphrId || '');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!cyphrId) {
      navigate('/');
    }
  }, [cyphrId, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!cyphrId.trim() || !password.trim()) {
      setError('Please enter both Cyphr ID and password');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      console.log('🆔 Attempting Cyphr ID login:', cyphrId);
      
      const result = await zeroKnowledgeAuth.cyphrIdLogin(cyphrId, password);
      console.log('🆔 Cyphr ID login result:', result);
      
      if (result.success) {
        // Store user session data
        sessionStorage.setItem('userId', result.user.id);
        sessionStorage.setItem('userName', result.user.full_name || result.user.name || 'User');
        
        // Store user profile
        const userProfile = {
          id: result.user.id,
          name: result.user.full_name || result.user.name,
          cyphr_id: result.user.cyphr_id,
          avatar_url: result.user.avatar_url,
          bio: result.user.bio
        };
        sessionStorage.setItem('user_profile', JSON.stringify(userProfile));
        
        toast.success('Login successful!');
        navigate('/chats');
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (err) {
      console.error('❌ Cyphr ID login error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    toast.info('Password recovery is coming soon. Please contact support if needed.');
  };

  const handleBackToWelcome = () => {
    navigate('/', { replace: true });
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
        <form onSubmit={handleLogin} className="flex flex-col items-center">
          <div className="mb-6">
            <CyphrLogo size="small" />
          </div>
          
          <h1 className="text-3xl font-bold tracking-tight text-white text-center">Cyphr ID Login</h1>
          <p className="text-zinc-300 mt-2 text-sm text-center">Enter your Cyphr ID and password</p>
          
          {/* Cyphr ID Display */}
          <div className="w-full mt-8 mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Cyphr ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <AtSign className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={cyphrId}
                onChange={(e) => setCyphrId(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:border-purple-400 focus:bg-white/15 focus:outline-none transition-all"
                placeholder="your_cyphr_id"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="w-full mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:border-purple-400 focus:bg-white/15 focus:outline-none transition-all"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
          
          {error && <p className="text-red-400/90 text-sm mb-4 text-left w-full">{error}</p>}
          
          <Button 
            type="submit" 
            disabled={isLoading || !cyphrId.trim() || !password.trim()} 
            size="lg" 
            className="w-full group"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            ) : (
              <span className="flex items-center justify-center">
                Login
                <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            )}
          </Button>

          {/* Forgot Password */}
          <button
            type="button"
            onClick={handleForgotPassword}
            className="mt-4 text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            Forgot password?
          </button>

          {/* Back to Welcome */}
          <button
            type="button"
            onClick={handleBackToWelcome}
            className="mt-6 text-zinc-400 hover:text-zinc-300 text-sm transition-colors"
          >
            ← Back to login options
          </button>

          <p className="text-xs text-zinc-500 mt-6 flex items-center">
            <Lock className="w-3 h-3 mr-1.5" /> End-to-end and post-quantum encrypted.
          </p>
        </form>
      </motion.div>
    </div>
  );
}