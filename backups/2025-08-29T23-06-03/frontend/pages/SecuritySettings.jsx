import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Smartphone, Key, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/api/supabaseClient';
import { zeroKnowledgeAuth } from '@/api/authService';
import FinalKyber1024 from '@/api/crypto/finalKyber1024';

const SecuritySettings = () => {
  const navigate = useNavigate();
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [securityLevel, setSecurityLevel] = useState('high');
  const [encryptionKeys, setEncryptionKeys] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);

  useEffect(() => {
    loadSecuritySettings();
    loadActiveSessions();
    checkEncryptionKeys();
  }, []);

  const loadSecuritySettings = async () => {
    try {
      const user = zeroKnowledgeAuth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('user_settings')
        .select('two_fa_enabled, security_level')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setTwoFAEnabled(data.two_fa_enabled || false);
        setSecurityLevel(data.security_level || 'high');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadActiveSessions = async () => {
    // Mock active sessions - replace with real data
    setActiveSessions([
      {
        id: '1',
        device: 'iPhone 15 Pro',
        location: 'San Francisco, CA',
        lastActive: new Date(),
        current: true
      },
      {
        id: '2',
        device: 'MacBook Pro',
        location: 'San Francisco, CA',
        lastActive: new Date(Date.now() - 3600000)
      }
    ]);
  };

  const checkEncryptionKeys = async () => {
    try {
      const kyber = new FinalKyber1024();
      const keyPair = await kyber.generateKeyPair();
      setEncryptionKeys({
        algorithm: 'Kyber1024 + ChaCha20',
        publicKey: keyPair.publicKey.slice(0, 32) + '...',
        created: new Date()
      });
    } catch (error) {
      console.error('Error generating keys:', error);
    }
  };

  const enable2FA = async () => {
    setShowQRCode(true);
    // Generate 2FA secret and QR code
    toast.info('Scan QR code with your authenticator app');
  };

  const verify2FA = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    try {
      setIsVerifying(true);
      // Verify 2FA code
      await new Promise(resolve => setTimeout(resolve, 1000)); // Mock API call
      
      setTwoFAEnabled(true);
      setShowQRCode(false);
      setVerificationCode('');
      toast.success('Two-factor authentication enabled');
    } catch (error) {
      toast.error('Invalid verification code');
    } finally {
      setIsVerifying(false);
    }
  };

  const disable2FA = async () => {
    if (!confirm('Are you sure you want to disable two-factor authentication?')) {
      return;
    }

    try {
      setTwoFAEnabled(false);
      toast.success('Two-factor authentication disabled');
    } catch (error) {
      toast.error('Failed to disable 2FA');
    }
  };

  const terminateSession = async (sessionId) => {
    if (!confirm('Are you sure you want to terminate this session?')) {
      return;
    }

    try {
      setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Session terminated');
    } catch (error) {
      toast.error('Failed to terminate session');
    }
  };

  const regenerateKeys = async () => {
    if (!confirm('This will regenerate your encryption keys. Existing messages will remain encrypted with old keys. Continue?')) {
      return;
    }

    try {
      await checkEncryptionKeys();
      toast.success('Encryption keys regenerated');
    } catch (error) {
      toast.error('Failed to regenerate keys');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[rgb(10,14,39)] to-[rgb(30,36,80)] text-white">
      {/* Header */}
      <div className="glass border-b border-white/10">
        <div className="p-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 glass rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">Security</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Security Level */}
        <div className="glass rounded-2xl p-6 text-center">
          <Shield className={`w-16 h-16 mx-auto mb-3 ${
            securityLevel === 'high' ? 'text-green-400' : 'text-yellow-400'
          }`} />
          <h2 className="text-xl font-semibold mb-1">Security Level: {securityLevel.toUpperCase()}</h2>
          <p className="text-sm text-white/60">Your account is protected with quantum encryption</p>
        </div>

        {/* Two-Factor Authentication */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-purple-400" />
            Two-Factor Authentication
          </h2>
          
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium">2FA Status</h3>
                <p className="text-sm text-white/60">
                  {twoFAEnabled ? 'Enabled - Extra layer of security' : 'Disabled - Enable for better security'}
                </p>
              </div>
              <button
                onClick={twoFAEnabled ? disable2FA : enable2FA}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  twoFAEnabled 
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                    : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                }`}
              >
                {twoFAEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>

            {showQRCode && (
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="bg-white p-4 rounded-xl mx-auto w-48 h-48 flex items-center justify-center">
                  <div className="text-black text-center">
                    <Lock className="w-16 h-16 mx-auto mb-2" />
                    <p className="text-xs">QR Code</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-white/60 mb-2 block">Enter verification code</label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full p-3 glass rounded-xl text-center text-xl font-mono"
                  />
                </div>
                <button
                  onClick={verify2FA}
                  disabled={isVerifying}
                  className="w-full btn-quantum py-3 font-semibold disabled:opacity-50"
                >
                  {isVerifying ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Encryption Keys */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Key className="w-5 h-5 text-purple-400" />
            Encryption Keys
          </h2>
          
          {encryptionKeys && (
            <div className="glass rounded-2xl p-4">
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium mb-1">Algorithm</h3>
                  <p className="text-sm text-white/60 font-mono">{encryptionKeys.algorithm}</p>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Public Key</h3>
                  <p className="text-xs text-white/60 font-mono break-all">{encryptionKeys.publicKey}</p>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Created</h3>
                  <p className="text-sm text-white/60">
                    {encryptionKeys.created.toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={regenerateKeys}
                className="mt-4 w-full py-2 glass rounded-xl hover:bg-white/10 transition-colors text-sm"
              >
                Regenerate Keys
              </button>
            </div>
          )}
        </div>

        {/* Active Sessions */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-purple-400" />
            Active Sessions
          </h2>
          
          <div className="glass rounded-2xl divide-y divide-white/5">
            {activeSessions.map((session) => (
              <div key={session.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    session.current ? 'bg-green-500/20' : 'bg-white/10'
                  }`}>
                    <Smartphone className={`w-5 h-5 ${
                      session.current ? 'text-green-400' : 'text-white/60'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      {session.device}
                      {session.current && (
                        <span className="text-xs text-green-400">(Current)</span>
                      )}
                    </h3>
                    <p className="text-sm text-white/60">{session.location}</p>
                    <p className="text-xs text-white/40">
                      Last active: {session.lastActive.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                {!session.current && (
                  <button
                    onClick={() => terminateSession(session.id)}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Terminate
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Security Alert */}
        <div className="glass rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium mb-1">Security Recommendation</h3>
            <p className="text-sm text-white/60">
              Enable two-factor authentication and regularly review your active sessions for maximum security.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettings; 