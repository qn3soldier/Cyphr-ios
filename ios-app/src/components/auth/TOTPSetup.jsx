import { useState, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import { Button } from '../../ui/button';
import { toast } from 'react-native-toast-message';
import { Smartphone, Copy, QrCode, Shield } from 'react-native-vector-icons/MaterialIcons';
import * as OTPAuth from 'otplib';
import QRCode from 'qrcode';

export default function TOTPSetup({ phone, onComplete, onSkip }) {
  // 🚨 SECURITY WARNING: This component is DEPRECATED and INSECURE!
  // It exposes TOTP secrets to frontend - use SecureTOTPSetup instead
  
  console.error('🚨 SECURITY WARNING: TOTPSetup component is deprecated and insecure!');
  console.error('🛡️  Use SecureTOTPSetup component instead');
  
  return (
    <div className="w-full max-w-md mx-auto text-center p-6">
      <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <Shield className="w-8 h-8 text-white" />
      </div>
      
      <h2 className="text-2xl font-bold text-red-400 mb-2">
        Security Error
      </h2>
      <p className="text-gray-300 text-sm mb-6">
        This component has been disabled for security reasons. Use SecureTOTPSetup instead.
      </p>
      
      <button
        onClick={onSkip}
        className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-lg"
      >
        Continue Without TOTP
      </button>
    </div>
  );
}

/* 
INSECURE CODE WAS REMOVED FOR SECURITY REASONS

The original TOTPSetup component contained insecure patterns:
- TOTP secrets exposed in frontend
- localStorage usage for sensitive data
- Client-side TOTP generation and verification

This has been replaced with SecureTOTPSetup which:
- Generates TOTP secrets on backend only
- Uses secure session tokens
- Encrypts all sensitive data
- Follows enterprise security standards

Original functionality preserved in commented form for reference, 
but all JSX has been removed to prevent parsing errors.
*/