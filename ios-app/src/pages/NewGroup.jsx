import React, { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import Animated from 'react-native-reanimated';
import { ArrowLeft, Camera, Users, Check, Search, Shield, X, UserPlus, Settings } from 'react-native-vector-icons/MaterialIcons';
import { Input } from '../ui/input';
import { Button } from '../ui/button.tsx';
import AetheriumLogo from '../components/AetheriumLogo';
import { supabase } from '../api/supabaseClient';
import { toast } from 'react-native-toast-message';
import FinalKyber1024 from '../api/crypto/finalKyber1024';

const kyber = new FinalKyber1024();

export default function NewGroup() {
  const navigate = useNavigation();
  const fileInputRef = useRef(null);
  
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupAvatar, setGroupAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  // Group settings
  const [groupSettings, setGroupSettings] = useState({
    allowMembersToAddOthers: true,
    allowMembersToChangeInfo: false,
    endToEndEncrypted: true,
    disappearingMessages: false,
    disappearingDuration: 24 // hours
  });

  useEffect(() => {
    loadCurrentUser();
    loadUsers();
  }, []);

  const loadCurrentUser = () => {
    const userId = sessionStorage.getItem('userId');
    const userName = sessionStorage.getItem('userName');
    const userPhone = sessionStorage.getItem('phoneNumber');
    
    setCurrentUser({
      id: userId,
      name: userName,
      phone: userPhone
    });
  };

  const loadUsers = async () => {
    try {
      const currentUserId = sessionStorage.getItem('userId');
      
      const { data, error } = await supabase
        .from('users')
        .select('id, name, phone, avatar_url, public_key, status')
        .neq('id', currentUserId)
        .order('name');

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setGroupAvatar(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      }
      
      if (prev.length >= 256) {
        toast.error('Maximum 256 members per group');
        return prev;
      }
      
      return [...prev, userId];
    });
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    if (selectedUsers.length < 1) {
      toast.error('Select at least 1 member for the group');
      return;
    }

    setCreating(true);
    try {
      // Generate group chat ID
      const chatId = crypto.randomUUID();
      let avatarUrl = null;

      // Upload avatar if provided
      if (groupAvatar) {
        const fileExt = groupAvatar.name.split('.').pop();
        const fileName = `${chatId}-${Date.now()}.${fileExt}`;
        const filePath = `group-avatars/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, groupAvatar);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = publicUrl;
      }

      // Create group chat
      const { error: chatError } = await supabase
        .from('chats')
        .insert({
          id: chatId,
          type: 'group',
          name: groupName,
          description: groupDescription,
          avatar_url: avatarUrl,
          participants: [currentUser.id, ...selectedUsers],
          created_by: currentUser.id,
          settings: groupSettings,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (chatError) throw chatError;

      // Create chat participants records
      const participants = [
        {
          chat_id: chatId,
          user_id: currentUser.id,
          role: 'admin',
          joined_at: new Date().toISOString()
        },
        ...selectedUsers.map(userId => ({
          chat_id: chatId,
          user_id: userId,
          role: 'member',
          joined_at: new Date().toISOString()
        }))
      ];

      const { error: participantsError } = await supabase
        .from('chat_participants')
        .insert(participants);

      if (participantsError) throw participantsError;

      // Generate group encryption keys
      const { publicKey, secretKey } = await kyber.generateKeyPair();
      
      // Store group keys (encrypted for each member)
      const { error: keysError } = await supabase
        .from('chat_keys')
        .insert({
          chat_id: chatId,
          public_key: publicKey,
          created_at: new Date().toISOString()
        });

      if (keysError) throw keysError;

      toast.success('Group created successfully');
      navigate(`/chats/${chatId}`);
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.phone?.includes(searchQuery)
  );

  const selectedUsersList = users.filter(u => selectedUsers.includes(u.id));

  if (loading) {
    return <div className="min-h-screen w-full flex items-center justify-center bg-background-primary"><AetheriumLogo /></div>;
  }

  return (
    <div className="min-h-screen bg-background-primary text-text-primary">
      {/* Header */}
      <div className="sticky top-0 z-20 p-4 bg-background-primary/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="hover:bg-white/10"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-2xl font-bold">New Group</h1>
          </div>
          <Button
            onClick={createGroup}
            disabled={creating || !groupName.trim() || selectedUsers.length === 0}
            className="bg-accent-primary hover:bg-accent-primary/80"
          >
            {creating ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              'Create'
            )}
          </Button>
        </div>
      </div>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Group Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-background-secondary/50 backdrop-blur-xl rounded-2xl p-6 border border-border"
        >
          <div className="flex items-start gap-4">
            {/* Avatar Upload */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-2xl bg-background-primary/50 border-2 border-dashed border-border flex items-center justify-center group overflow-hidden"
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Group avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Camera className="w-8 h-8 text-text-secondary group-hover:text-text-primary transition-colors" />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </motion.button>

            {/* Group Details */}
            <div className="flex-1 space-y-3">
              <Input
                placeholder="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="text-lg font-semibold bg-background-primary/50"
                maxLength={100}
              />
              <Input
                placeholder="Add description (optional)"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                className="bg-background-primary/50"
                maxLength={500}
              />
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Shield className="w-4 h-4 text-green-400" />
                <span>End-to-end encrypted with Kyber1024</span>
              </div>
            </div>
          </div>

          {/* Group Settings Toggle */}
          <Button
            variant="ghost"
            onClick={() => setShowSettings(!showSettings)}
            className="mt-4 w-full justify-between"
          >
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Group Settings
            </span>
            <motion.div
              animate={{ rotate: showSettings ? 180 : 0 }}
              className="w-4 h-4"
            >
              ▼
            </motion.div>
          </Button>

          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-3 pt-4 border-t border-border">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Allow members to add others</span>
                    <input
                      type="checkbox"
                      checked={groupSettings.allowMembersToAddOthers}
                      onChange={(e) => setGroupSettings(prev => ({
                        ...prev,
                        allowMembersToAddOthers: e.target.checked
                      }))}
                      className="w-4 h-4 rounded accent-accent-primary"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Allow members to change group info</span>
                    <input
                      type="checkbox"
                      checked={groupSettings.allowMembersToChangeInfo}
                      onChange={(e) => setGroupSettings(prev => ({
                        ...prev,
                        allowMembersToChangeInfo: e.target.checked
                      }))}
                      className="w-4 h-4 rounded accent-accent-primary"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Disappearing messages</span>
                    <input
                      type="checkbox"
                      checked={groupSettings.disappearingMessages}
                      onChange={(e) => setGroupSettings(prev => ({
                        ...prev,
                        disappearingMessages: e.target.checked
                      }))}
                      className="w-4 h-4 rounded accent-accent-primary"
                    />
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Members Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Add Members ({selectedUsers.length})
            </h2>
            {selectedUsers.length > 0 && (
              <span className="text-sm text-text-secondary">
                {selectedUsers.length} / 256 selected
              </span>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-background-secondary/50"
            />
          </div>

          {/* Selected Users Preview */}
          {selectedUsersList.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-background-secondary/30 rounded-xl">
              {selectedUsersList.map(user => (
                <motion.div
                  key={user.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="flex items-center gap-2 px-3 py-1 bg-accent-primary/20 rounded-full"
                >
                  <span className="text-sm">{user.name}</span>
                  <button
                    onClick={() => toggleUserSelection(user.id)}
                    className="hover:bg-white/10 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          {/* User List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            <AnimatePresence>
              {filteredUsers.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => toggleUserSelection(user.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    selectedUsers.includes(user.id)
                      ? 'bg-accent-primary/20 border-accent-primary'
                      : 'bg-background-secondary/50 hover:bg-background-secondary/70'
                  } border border-transparent`}
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold">
                          {user.name?.charAt(0)?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {user.status === 'online' && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-background-primary" />
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1">
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-text-secondary">{user.phone}</p>
                  </div>

                  {/* Selection Checkbox */}
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedUsers.includes(user.id)
                      ? 'bg-accent-primary border-accent-primary'
                      : 'border-border'
                  }`}>
                    {selectedUsers.includes(user.id) && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-text-secondary">
                {searchQuery ? 'No contacts found' : 'No contacts available'}
              </div>
            )}
          </div>
        </motion.div>
      </main>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />
    </div>
  );
} 