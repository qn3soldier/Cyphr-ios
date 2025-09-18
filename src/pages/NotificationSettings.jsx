import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Volume2, Vibrate, MessageSquare, Phone, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';

export default function NotificationSettings() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    messages: true,
    calls: true,
    voiceCalls: true,
    videoCalls: true,
    sound: true,
    vibrate: true,
    preview: true,
    groupMessages: true,
    mentions: true
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userId = sessionStorage.getItem('userId');
      if (!userId) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('notification_settings')
        .eq('user_id', userId)
        .single();

      if (data?.notification_settings) {
        setSettings(data.notification_settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleToggle = async (key) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    
    // Auto-save
    await saveSettings(newSettings);
  };

  const saveSettings = async (newSettings) => {
    setSaving(true);
    try {
      const userId = sessionStorage.getItem('userId');
      if (!userId) return;

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          notification_settings: newSettings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      toast.success('Settings saved');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const settingsGroups = [
    {
      title: 'Message Notifications',
      items: [
        {
          key: 'messages',
          icon: MessageSquare,
          label: 'Message Notifications',
          description: 'New messages from chats'
        },
        {
          key: 'groupMessages',
          icon: MessageSquare,
          label: 'Group Messages',
          description: 'Messages in group chats'
        },
        {
          key: 'mentions',
          icon: Bell,
          label: 'Mentions & Replies',
          description: 'When someone mentions you'
        }
      ]
    },
    {
      title: 'Call Notifications',
      items: [
        {
          key: 'calls',
          icon: Phone,
          label: 'Call Notifications',
          description: 'Incoming calls'
        },
        {
          key: 'voiceCalls',
          icon: Phone,
          label: 'Voice Calls',
          description: 'Voice call alerts'
        },
        {
          key: 'videoCalls',
          icon: Video,
          label: 'Video Calls',
          description: 'Video call alerts'
        }
      ]
    },
    {
      title: 'Alert Preferences',
      items: [
        {
          key: 'sound',
          icon: Volume2,
          label: 'Sound',
          description: 'Play notification sounds'
        },
        {
          key: 'vibrate',
          icon: Vibrate,
          label: 'Vibration',
          description: 'Vibrate on notifications'
        },
        {
          key: 'preview',
          icon: MessageSquare,
          label: 'Message Preview',
          description: 'Show message content'
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-semibold">Notifications</h1>
        </div>
      </div>

      {/* Settings Groups */}
      <div className="p-4 space-y-6">
        {settingsGroups.map((group, groupIndex) => (
          <div key={group.title}>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">
              {group.title}
            </h3>
            
            <div className="space-y-2">
              {group.items.map((item, index) => (
                <motion.div
                  key={item.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (groupIndex * 0.1) + (index * 0.05) }}
                  className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-700 rounded-lg">
                      <item.icon size={20} className="text-gray-300" />
                    </div>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.description}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleToggle(item.key)}
                    disabled={saving}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings[item.key] ? 'bg-blue-500' : 'bg-gray-600'
                    }`}
                  >
                    <motion.div
                      animate={{ x: settings[item.key] ? 24 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-lg"
                    />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        ))}

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-blue-900/20 rounded-lg p-4 border border-blue-500/20"
        >
          <p className="text-sm text-blue-300">
            Notifications are end-to-end encrypted. Only you can see the content of your messages.
          </p>
        </motion.div>
      </div>
    </div>
  );
} 