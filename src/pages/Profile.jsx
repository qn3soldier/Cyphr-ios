import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Edit2, Save, X, User, Phone, Shield, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// REMOVED Supabase import - migrated to AWS backend
import { useAvatar } from '../components/AvatarProvider';
import EnhancedAvatar from '../components/EnhancedAvatar';
import { toast } from 'sonner';

export default function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { updateAvatar } = useAvatar();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  
  const [profile, setProfile] = useState({
    id: '',
    name: '',
    bio: '',
    phone: '',
    avatar_url: '',
    public_key: '',
    cyphr_id: ''
  });
  
  const [editedName, setEditedName] = useState('');
  const [editedBio, setEditedBio] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // Get from session storage first (cached)
      const userId = sessionStorage.getItem('userId');
      const userName = sessionStorage.getItem('userName');
      const userPhone = sessionStorage.getItem('phoneNumber');
      const userPublicKey = sessionStorage.getItem('userPublicKey');
      
      if (!userId) {
        navigate('/');
        return;
      }

      // Load from AWS backend API
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api'}/auth/get-user-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId })
        });

        const result = await response.json();
        
        if (result.success && result.user) {
          const userData = result.user;
          setProfile({
            id: userData.id,
            name: userData.full_name || userData.name || userName || 'User undefined',
            bio: userData.bio || 'Hey there! I am using Cyphr Messenger',
            phone: userData.phone || userPhone,
            avatar_url: userData.avatar_url || '',
            public_key: userData.public_key || userPublicKey,
            cyphr_id: userData.cyphr_id || '@not_set_yet'
          });
          setEditedName(userData.full_name || userData.name || userName || 'User undefined');
          setEditedBio(userData.bio || 'Hey there! I am using Cyphr Messenger');
        } else {
          throw new Error(result.error || 'Failed to load profile');
        }
      } catch (error) {
        console.error('❌ Failed to load profile from AWS:', error);
        
        // Use cached data as fallback
        setProfile({
          id: userId,
          name: userName || 'User undefined',
          bio: 'Hey there! I am using Cyphr Messenger',
          phone: userPhone,
          avatar_url: '',
          public_key: userPublicKey,
          cyphr_id: '@not_set_yet'
        });
        setEditedName(userName || 'User undefined');
        setEditedBio('Hey there! I am using Cyphr Messenger');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setSaving(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      
      // Update avatar cache
      updateAvatar(profile.id, publicUrl, profile);
      
      toast.success('Avatar updated successfully');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to update avatar');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: editedName })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, name: editedName }));
      sessionStorage.setItem('userName', editedName);
      setEditingName(false);
      toast.success('Name updated successfully');
    } catch (error) {
      console.error('Error updating name:', error);
      toast.error('Failed to update name');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBio = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ bio: editedBio })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, bio: editedBio }));
      setEditingBio(false);
      toast.success('Bio updated successfully');
    } catch (error) {
      console.error('Error updating bio:', error);
      toast.error('Failed to update bio');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Shield className="w-16 h-16 text-blue-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background-primary/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-semibold">Profile</h1>
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="p-6 space-y-6">
        {/* Avatar Section */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <EnhancedAvatar
              userId={profile.id}
              size="2xl"
              className="border-4 border-accent-primary/30"
              fallbackData={{
                initials: profile.name?.charAt(0)?.toUpperCase() || 'U',
                color: 'bg-gradient-to-br from-violet-600 to-cyan-600'
              }}
            />
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 bg-accent-primary rounded-full shadow-lg shadow-accent-primary/50"
              disabled={saving}
            >
              <Camera size={20} />
            </motion.button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Name Section */}
        <div className="space-y-2">
          <label className="text-sm text-text-secondary">Name</label>
          <div className="flex items-center gap-2">
            {editingName ? (
              <>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="flex-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-accent-primary"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={saving}
                  className="p-3 bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Save size={20} />
                </button>
                <button
                  onClick={() => {
                    setEditingName(false);
                    setEditedName(profile.name);
                  }}
                  className="p-3 bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </>
            ) : (
              <>
                <div className="flex-1 bg-white/10 backdrop-blur-xl rounded-lg px-4 py-3">
                  {profile.name}
                </div>
                <button
                  onClick={() => setEditingName(true)}
                  className="p-3 bg-white/10 backdrop-blur-xl rounded-lg hover:bg-white/20 transition-colors"
                >
                  <Edit2 size={20} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bio Section */}
        <div className="space-y-2">
          <label className="text-sm text-text-secondary">Bio</label>
          <div className="flex items-start gap-2">
            {editingBio ? (
              <>
                <textarea
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  className="flex-1 bg-white/10 backdrop-blur-xl border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 resize-none"
                  rows={3}
                  autoFocus
                />
                <button
                  onClick={handleSaveBio}
                  disabled={saving}
                  className="p-3 bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Save size={20} />
                </button>
                <button
                  onClick={() => {
                    setEditingBio(false);
                    setEditedBio(profile.bio);
                  }}
                  className="p-3 bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </>
            ) : (
              <>
                <div className="flex-1 bg-white/10 backdrop-blur-xl rounded-lg px-4 py-3">
                  {profile.bio}
                </div>
                <button
                  onClick={() => setEditingBio(true)}
                  className="p-3 bg-white/10 backdrop-blur-xl rounded-lg hover:bg-white/20 transition-colors"
                >
                  <Edit2 size={20} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Cyphr ID Section - MOST IMPORTANT! */}
        <div className="space-y-2">
          <label className="text-sm text-text-secondary">Cyphr ID (Share this!)</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gradient-to-r from-violet-600/20 to-cyan-600/20 backdrop-blur-xl border border-violet-500/30 rounded-lg px-4 py-3 flex items-center gap-2">
              <span className="text-lg">@</span>
              <span className="font-semibold text-lg">
                {profile.cyphr_id || 'not_set_yet'}
              </span>
            </div>
            <button
              onClick={() => copyToClipboard(`@${profile.cyphr_id || 'not_set_yet'}`, 'Cyphr ID')}
              className="p-3 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-lg hover:from-violet-700 hover:to-cyan-700 transition-all shadow-lg"
            >
              <Copy size={20} />
            </button>
          </div>
        </div>

        {/* Phone Section */}
        {profile.phone && (
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Phone</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/10 backdrop-blur-xl rounded-lg px-4 py-3 flex items-center gap-2">
                <Phone size={20} className="text-text-secondary" />
                {profile.phone}
              </div>
              <button
                onClick={() => copyToClipboard(profile.phone, 'Phone number')}
                className="p-3 bg-white/10 backdrop-blur-xl rounded-lg hover:bg-white/20 transition-colors"
              >
                <Copy size={20} />
              </button>
            </div>
          </div>
        )}


        {/* Public Key Section */}
        <div className="space-y-2">
          <label className="text-sm text-text-secondary">Public Key (Quantum-Safe)</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/10 backdrop-blur-xl rounded-lg px-4 py-3">
              <span className="text-xs font-mono text-blue-400 break-all">
                {profile.public_key?.substring(0, 32)}...
              </span>
            </div>
            <button
              onClick={() => copyToClipboard(profile.public_key, 'Public key')}
              className="p-3 bg-white/10 backdrop-blur-xl rounded-lg hover:bg-white/20 transition-colors"
            >
              <Copy size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 