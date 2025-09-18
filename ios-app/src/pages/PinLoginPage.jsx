import { useLocation, useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import PinLogin from '../components/auth/PinLogin';

export default function PinLoginPage() {
  const location = useLocation();
  const navigate = useNavigation();

  // Get data from navigation state
  const userEmail = location.state?.userEmail;
  const userStatus = location.state?.userStatus;

  useEffect(() => {
    // Redirect to login if no email provided
    if (!userEmail) {
      console.log('❌ No user email provided, redirecting to login');
      navigate('/login');
    }
  }, [userEmail, navigate]);

  const handleSuccess = () => {
    console.log('✅ PIN login successful');
    navigate('/chats');
  };

  const handleForgotPin = () => {
    console.log('🔄 Forgot PIN, redirect to email verification');
    navigate('/email-verification', { 
      state: { 
        email: userEmail, 
        isNewUser: false 
      } 
    });
  };

  const handleSwitchToEmail = () => {
    console.log('📧 Switch to email authentication');
    navigate('/email-verification', { 
      state: { 
        email: userEmail, 
        isNewUser: false 
      } 
    });
  };

  if (!userEmail) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-[#1a1a2e] to-[#16213e] text-white flex items-center justify-center p-4 overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-64 h-64 bg-purple-600 rounded-full filter blur-3xl opacity-20"></div>
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-600 rounded-full filter blur-3xl opacity-20"></div>
      
      <PinLogin
        userEmail={userEmail}
        onSuccess={handleSuccess}
        onForgotPin={handleForgotPin}
        onSwitchToEmail={handleSwitchToEmail}
      />
    </div>
  );
}