import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PinSetup from '@/components/wallet/PinSetup';
import { zeroKnowledgeAuth } from '@/api/authService';
import { toast } from 'sonner';

export default function PinSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  
  const userId = location.state?.userId || sessionStorage.getItem('userId');
  const email = location.state?.email || sessionStorage.getItem('userEmail');
  const isNewUser = location.state?.isNewUser ?? true;

  useEffect(() => {
    // Check if user is authenticated
    if (!userId) {
      toast.error('Authentication required');
      navigate('/');
    }
  }, [userId, navigate]);

  const handlePinSetupComplete = async (pin, biometricEnabled) => {
    try {
      setIsLoading(true);
      console.log('🔐 Setting up PIN for user:', userId);
      
      // Save PIN to backend
      const result = await zeroKnowledgeAuth.setupUserPin(pin, biometricEnabled);
      
      if (result.success) {
        toast.success(`Security setup completed! ${biometricEnabled ? 'Biometric authentication enabled.' : 'PIN authentication enabled.'}`);
        
        // Navigate to main app
        navigate('/chats');
      } else {
        throw new Error(result.error || 'Failed to setup PIN');
      }
    } catch (error) {
      console.error('❌ PIN setup error:', error);
      toast.error(error.message || 'Failed to setup security. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSetupSkip = () => {
    console.log('⏭️ PIN setup skipped by user');
    toast.info('You can set up a PIN later in Security Settings');
    navigate('/chats');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e] flex items-center justify-center">
      <PinSetup 
        onComplete={handlePinSetupComplete}
        onSkip={handlePinSetupSkip}
        isNewUser={isNewUser}
        userEmail={email}
      />
    </div>
  );
}