import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import Animated from 'react-native-reanimated';
import { User, Lock, Camera, ArrowRight, Eye, EyeOff, Upload } from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../ui/button.tsx';
import { Input } from '../ui/input';

const StepIndicator = ({ currentStep }) => (
  <div className="flex w-full items-center justify-center space-x-2">
    {[1, 2, 3].map((step) => (
      <div key={step} className="w-1/3 h-1 rounded-full bg-background-primary/50">
        <motion.div
          className="h-1 rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary"
          initial={{ width: '0%' }}
          animate={{ width: currentStep >= step ? '100%' : '0%' }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </div>
    ))}
  </div>
);

const stepVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 },
};

export default function ProfileSetup() {
  const navigate = useNavigation();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    nickname: '',
    password: '',
    confirmPassword: '',
    avatar: null
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleAvatarSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({ ...prev, avatar: e.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateStep1 = () => {
    if (!formData.nickname.trim()) {
      setError('Please enter a nickname');
      return false;
    }
    if (formData.nickname.length < 3) {
      setError('Nickname must be at least 3 characters');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.password) {
      setError('Please enter a password');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Save profile data
      const userId = sessionStorage.getItem('userId');
      const profileData = {
        userId,
        nickname: formData.nickname,
        password: formData.password, // In production, this should be hashed
        avatar: formData.avatar,
        createdAt: new Date().toISOString()
      };

      // Store profile in localStorage for now (in production use secure backend)
      localStorage.setItem(`profile_${userId}`, JSON.stringify(profileData));
      sessionStorage.setItem('userNickname', formData.nickname);
      sessionStorage.setItem('profileComplete', 'true');

      console.log('✅ Profile created successfully');
      
      // Navigate to chats
      navigate('/chats');
    } catch (error) {
      console.error('Profile creation error:', error);
      setError('Failed to create profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <Step1 
            formData={formData}
            onInputChange={handleInputChange}
            onNext={handleNext}
            error={error}
          />
        );
      case 2:
        return (
          <Step2 
            formData={formData}
            onInputChange={handleInputChange}
            showPassword={showPassword}
            showConfirmPassword={showConfirmPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
            onToggleConfirmPassword={() => setShowConfirmPassword(!showConfirmPassword)}
            onNext={handleNext}
            onBack={() => setStep(1)}
            error={error}
          />
        );
      case 3:
        return (
          <Step3 
            formData={formData}
            onAvatarSelect={handleAvatarSelect}
            onComplete={handleComplete}
            onBack={() => setStep(2)}
            isLoading={isLoading}
            error={error}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-background-primary">
      <div 
        className="relative z-10 w-full max-w-md rounded-3xl border border-border bg-background-secondary/50 p-8 shadow-2xl shadow-black/30"
        style={{ backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}
      >
        <StepIndicator currentStep={step} />
        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={stepVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// Step 1: Nickname setup
const Step1 = ({ formData, onInputChange, onNext, error }) => (
  <div className="text-center space-y-6">
    <div className="p-4 inline-flex bg-accent-primary/10 rounded-full">
      <User className="w-8 h-8 text-accent-primary" />
    </div>
    <h2 className="font-display text-2xl font-bold text-foreground">Choose your nickname</h2>
    <p className="text-sm text-muted-foreground">This is how others will see you</p>
    
    <Input 
      placeholder="Enter nickname" 
      value={formData.nickname}
      onChange={(e) => onInputChange('nickname', e.target.value)}
      className="text-center"
      autoFocus
    />
    
    {error && <p className="text-sm text-destructive">{error}</p>}
    
    <Button onClick={onNext} className="w-full group">
      Continue 
      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
    </Button>
  </div>
);

// Step 2: Password setup
const Step2 = ({ 
  formData, 
  onInputChange, 
  showPassword, 
  showConfirmPassword, 
  onTogglePassword, 
  onToggleConfirmPassword, 
  onNext, 
  onBack, 
  error 
}) => (
  <div className="text-center space-y-6">
    <div className="p-4 inline-flex bg-accent-primary/10 rounded-full">
      <Lock className="w-8 h-8 text-accent-primary" />
    </div>
    <h2 className="font-display text-2xl font-bold text-foreground">Set a local password</h2>
    <p className="text-sm text-muted-foreground">Secure your profile with a password</p>
    
    <div className="space-y-4">
      <div className="relative">
        <Input 
          type={showPassword ? "text" : "password"}
          placeholder="Enter password" 
          value={formData.password}
          onChange={(e) => onInputChange('password', e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      
      <div className="relative">
        <Input 
          type={showConfirmPassword ? "text" : "password"}
          placeholder="Confirm password" 
          value={formData.confirmPassword}
          onChange={(e) => onInputChange('confirmPassword', e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggleConfirmPassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
    
    {error && <p className="text-sm text-destructive">{error}</p>}
    
    <div className="flex gap-4">
      <Button onClick={onBack} variant="secondary" className="w-full">
        Back
      </Button>
      <Button onClick={onNext} className="w-full group">
        Continue 
        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
      </Button>
    </div>
  </div>
);

// Step 3: Avatar setup
const Step3 = ({ formData, onAvatarSelect, onComplete, onBack, isLoading, error }) => (
  <div className="text-center space-y-6">
    <div className="p-4 inline-flex bg-accent-primary/10 rounded-full">
      <Camera className="w-8 h-8 text-accent-primary" />
    </div>
    <h2 className="font-display text-2xl font-bold text-foreground">Add a profile picture</h2>
    <p className="text-sm text-muted-foreground">Optional: Add a photo to personalize your profile</p>
    
    <div className="relative mx-auto w-32 h-32">
      <div className="w-full h-full rounded-full bg-muted overflow-hidden border-2 border-dashed border-muted-foreground/30">
        {formData.avatar ? (
          <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Upload className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        onChange={onAvatarSelect}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
    
    {error && <p className="text-sm text-destructive">{error}</p>}
    
    <div className="flex gap-4">
      <Button onClick={onBack} variant="secondary" className="w-full">
        Back
      </Button>
      <Button 
        onClick={onComplete} 
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? (
          <div className="flex items-center">
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
            Creating...
          </div>
        ) : (
          'Complete Setup'
        )}
      </Button>
    </div>
  </div>
); 