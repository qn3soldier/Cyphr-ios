import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/ui/button';
import CyphrLogo from '@/components/CyphrLogo';
import { cryptoAuth } from '@/api/cryptoAuth';
import { 
  Shield, 
  Key, 
  Fingerprint, 
  Copy, 
  Download, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

export default function CryptoSignUp() {
  const navigate = useNavigate();
  const [step, setStep] = useState('intro'); // 'intro', 'generating', 'backup', 'complete'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cryptoResult, setCryptoResult] = useState(null);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [backupConfirmed, setBackupConfirmed] = useState(false);

  const handleGenerateIdentity = async () => {
    setIsLoading(true);
    setError('');
    setStep('generating');
    
    try {
      console.log('🚀 Starting cryptographic identity generation...');
      
      const result = await cryptoAuth.completeCryptoSignUp();
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      setCryptoResult(result);
      setRecoveryPhrase(result.recoveryPhrase);
      setStep('backup');
      
      toast.success('Cryptographic identity created successfully!');
      
    } catch (err) {
      console.error('❌ Crypto signup failed:', err);
      setError(err.message);
      setStep('intro');
    } finally {
      setIsLoading(false);
    }
  };

  const copyRecoveryPhrase = () => {
    navigator.clipboard.writeText(recoveryPhrase);
    toast.success('Recovery phrase copied to clipboard');
  };

  const downloadBackup = () => {
    const backup = {
      cyphrId: cryptoResult.cyphrId,
      recoveryPhrase: recoveryPhrase,
      publicKey: cryptoResult.user.publicKey,
      timestamp: new Date().toISOString(),
      instructions: 'Keep this file secure. Use recovery phrase to restore your cryptographic identity.'
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyphr-backup-${cryptoResult.cyphrId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Backup file downloaded');
  };

  const handleComplete = () => {
    if (!backupConfirmed) {
      toast.error('Please confirm you have saved your recovery phrase');
      return;
    }
    
    setStep('complete');
    setTimeout(() => {
      toast.success('Welcome to Cyphr Messenger! 🎉');
      navigate('/chats');
    }, 2000);
  };

  const renderIntroStep = () => (
    <div className="text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center mb-6 mx-auto">
        <Key className="w-10 h-10 text-white" />
      </div>
      
      <h1 className="text-3xl font-bold mb-4">Create Cyphr Identity</h1>
      <p className="text-zinc-300 text-sm mb-6 max-w-sm mx-auto">
        Create your sovereign digital identity protected by quantum-safe cryptography. 
        No emails, phones, or passwords required.
      </p>
      
      <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-4 mb-6 text-left">
        <div className="flex items-start gap-3 mb-3">
          <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-blue-200 font-medium">True Self-Sovereignty</p>
            <p className="text-blue-300/80 text-sm">You own your identity completely</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3 mb-3">
          <Fingerprint className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-blue-200 font-medium">Device Binding</p>
            <p className="text-blue-300/80 text-sm">Protected by your device's hardware</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <Key className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-blue-200 font-medium">Quantum-Safe</p>
            <p className="text-blue-300/80 text-sm">Ed25519 cryptography with future protection</p>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
      
      <Button 
        onClick={handleGenerateIdentity}
        disabled={isLoading}
        className="w-full group mb-4"
        size="lg"
      >
        {isLoading ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
        ) : (
          <span className="flex items-center justify-center">
            Create My Cyphr Identity
            <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        )}
      </Button>
      
      <Button 
        variant="ghost"
        onClick={() => navigate('/')}
        className="w-full text-gray-400 hover:text-white"
      >
        Back to Other Methods
      </Button>
    </div>
  );

  const renderGeneratingStep = () => (
    <div className="text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center mb-6 mx-auto animate-pulse">
        <Key className="w-10 h-10 text-white animate-spin" />
      </div>
      
      <h2 className="text-2xl font-bold mb-4">Generating Your Cyphr Identity...</h2>
      <div className="space-y-3 text-left max-w-sm mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-zinc-300">Creating Ed25519 keypair</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
          <span className="text-zinc-300">Binding to your device</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
          <span className="text-zinc-300">Creating secure backup</span>
        </div>
      </div>
    </div>
  );

  const renderBackupStep = () => (
    <div className="text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 flex items-center justify-center mb-6 mx-auto">
        <CheckCircle className="w-10 h-10 text-white" />
      </div>
      
      <h2 className="text-2xl font-bold mb-2">Identity Created Successfully!</h2>
      <p className="text-emerald-400 font-mono text-lg mb-6">
        {cryptoResult?.cyphrId}
      </p>
      
      <div className="bg-yellow-600/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="text-left">
            <p className="text-yellow-200 font-medium mb-2">Save Your Recovery Phrase</p>
            <p className="text-yellow-300/80 text-sm mb-3">
              This is the ONLY way to recover your identity if you lose your device.
              Keep it secure and never share it with anyone.
            </p>
          </div>
        </div>
        
        <div className="bg-black/30 rounded-lg p-3 mb-3 font-mono text-sm break-all">
          {recoveryPhrase}
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={copyRecoveryPhrase}
            className="flex-1"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy
          </Button>
          
          <Button 
            variant="outline"
            size="sm"
            onClick={downloadBackup}
            className="flex-1"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </div>
      
      <div className="mb-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={backupConfirmed}
            onChange={(e) => setBackupConfirmed(e.target.checked)}
            className="w-5 h-5 mt-0.5 rounded border-white/20 text-purple-600 focus:ring-purple-600 bg-white/10"
          />
          <span className="text-zinc-300 text-sm text-left">
            I have safely saved my recovery phrase and understand that 
            this is the only way to recover my cryptographic identity.
          </span>
        </label>
      </div>
      
      <Button 
        onClick={handleComplete}
        disabled={!backupConfirmed}
        className="w-full group"
        size="lg"
      >
        <span className="flex items-center justify-center">
          Continue to Cyphr Messenger
          <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </Button>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center mb-6 mx-auto">
        <CheckCircle className="w-10 h-10 text-white" />
      </div>
      
      <h2 className="text-2xl font-bold mb-4">Welcome to Cyphr!</h2>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"></div>
      <p className="text-zinc-400 mt-4">Redirecting to your secure chats...</p>
    </div>
  );

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
        <div className="flex flex-col items-center">
          <CyphrLogo size="small" />
          
          <div className="mt-6 w-full">
            {step === 'intro' && renderIntroStep()}
            {step === 'generating' && renderGeneratingStep()}
            {step === 'backup' && renderBackupStep()}
            {step === 'complete' && renderCompleteStep()}
          </div>
        </div>
      </motion.div>
    </div>
  );
}