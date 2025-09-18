import { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import FinalKyber1024 from '@/api/crypto/finalKyber1024.js';

export default function ChatSettings({ chatId }) {
  const [mute, setMute] = useState(false);
  const [kyber] = useState(() => new FinalKyber1024());

  const handleMute = async () => {
    try {
      const encryptedMute = await kyber.encryptMessage(mute ? 'unmute' : 'mute');
      await supabase.from('chat_settings').update({ muted: encryptedMute }).eq('chat_id', chatId);
      setMute(!mute);
    } catch (error) {
      console.error('Failed to update mute setting:', error);
    }
  };

  return (
    <div>
      <h1>Chat Settings</h1>
      <button onClick={handleMute}>{mute ? 'Unmute' : 'Mute'}</button>
      {/* Add delete, encryption level, etc. */}
    </div>
  );
} 