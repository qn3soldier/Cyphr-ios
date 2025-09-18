import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/api/supabaseClient';
import FinalKyber1024 from '@api/crypto/finalKyber1024.js';
import { Input, Button } from '@ui/components';

export default function AccountSettings() {
  const [name, setName] = useState('');
  const [kyber] = useState(() => new FinalKyber1024());
  const handleSave = async () => {
    const encryptedName = await kyber.encryptMessage(name);
    await supabase.from('users').update({ name: encryptedName });
    // Success toast
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="premium-bg gradient-premium p-6 rounded-xl shadow-glow">
      <h1 className="text-2xl font-bold mb-4">Account</h1>
      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
      <Button onClick={handleSave} className="mt-4 bg-gradient-to-r from-blue-500 to-purple-500">Save</Button>
    </motion.div>
  );
} 