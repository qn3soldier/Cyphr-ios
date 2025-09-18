import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Lock, Phone, MessageCircle, Users, Wallet, HelpCircle } from 'lucide-react';

export default function Help() {
  const navigate = useNavigate();

  const helpSections = [
    {
      icon: Shield,
      title: 'Quantum Encryption',
      content: 'All messages are protected with post-quantum Kyber1024 + ChaCha20 encryption, ensuring your communications remain secure even against future quantum computers.'
    },
    {
      icon: Phone,
      title: 'Getting Started',
      content: 'Register with your phone number, verify via OTP, set a secure password, and start messaging. Your account is protected with zero-knowledge architecture.'
    },
    {
      icon: MessageCircle,
      title: 'Messaging',
      content: 'Send text, voice messages, photos, and files up to 100MB. All content is end-to-end encrypted and never accessible by our servers.'
    },
    {
      icon: Users,
      title: 'Group Chats',
      content: 'Create secure group chats with up to 256 members. Group keys are automatically managed and rotated for maximum security.'
    },
    {
      icon: Wallet,
      title: 'Crypto Wallet',
      content: 'Built-in Stellar wallet for sending and receiving XLM and USDC. All transactions are quantum-encrypted for privacy.'
    },
    {
      icon: Lock,
      title: 'Security Features',
      content: 'Biometric login, disappearing messages, screenshot protection, and tactical mode for enhanced security in sensitive situations.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[rgb(10,14,39)] to-[rgb(30,36,80)] text-white">
      <div className="glass border-b border-white/10">
        <div className="p-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 glass rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">Help Center</h1>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <HelpCircle className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">How can we help you?</h2>
          <p className="text-white/60">Find answers to common questions about Cyphr Messenger</p>
        </motion.div>

        <div className="grid gap-4">
          {helpSections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass rounded-2xl p-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <section.icon className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">{section.title}</h3>
                  <p className="text-white/70 leading-relaxed">{section.content}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 glass rounded-2xl p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">Still need help?</h3>
          <p className="text-white/60 mb-4">Contact our support team for assistance</p>
          <button
            onClick={() => navigate('/new-chat')}
            className="btn-quantum px-6 py-2"
          >
            Contact Support
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-white/40">
          <p>🔐 Cyphr Messenger v1.0.0 • Post-quantum secure</p>
        </div>
      </div>
    </div>
  );
} 