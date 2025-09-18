import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Search, Phone, Shield, Check, Users, Wifi, WifiOff, UserPlus } from 'react-native-vector-icons/MaterialIcons';
import { toast } from 'react-native-toast-message';
import { supabase } from '../api/supabaseClient';
import { zeroKnowledgeAuth } from '../api/authService';
import { quantumKDF } from '../api/quantumKDF';
import EnhancedAvatar from '../components/EnhancedAvatar';

// Enhanced User Card Component with presence and status
const UserCard = ({ user, onSelect, isSelected, isOnline, showRecentIndicator }) => {
  const getStatusText = () => {
    if (isOnline) return 'Online';
    if (user.last_seen) {
      const lastSeen = new Date(user.last_seen);
      const now = new Date();
      const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));
      
      if (diffMinutes < 5) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
      return `${Math.floor(diffMinutes / 1440)}d ago`;
    }
    return 'Last seen unknown';
  };

  const getPresenceIndicator = () => {
    if (isOnline) {
      return <div className="w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>;
    }
    return <div className="w-3 h-3 bg-gray-400 rounded-full border-2 border-white"></div>;
  };

  return (
    <button
      onClick={() => onSelect(user)}
      disabled={isSelected}
      className="w-full p-4 glass rounded-xl hover:bg-white/5 transition-all flex items-center gap-3 disabled:opacity-50 group"
    >
      <div className="relative">
        <EnhancedAvatar 
          userId={user.id}
          src={user.avatar_url}
          alt={user.full_name || user.cyphr_id || user.phone}
          size="md"
          fallbackText={user.full_name?.charAt(0) || user.cyphr_id?.charAt(0) || user.phone?.charAt(0) || '?'}
        />
        <div className="absolute -bottom-1 -right-1">
          {getPresenceIndicator()}
        </div>
      </div>
      
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold truncate">
            {user.full_name || (user.cyphr_id ? `@${user.cyphr_id}` : null) || user.phone || 'Unknown User'}
          </h3>
          {showRecentIndicator && (
            <div className="flex-shrink-0">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-white/60">
          <span className="truncate">{user.cyphr_id ? `@${user.cyphr_id}` : user.phone}</span>
          {isOnline ? (
            <Wifi className="w-3 h-3 text-green-400 flex-shrink-0" />
          ) : (
            <WifiOff className="w-3 h-3 text-gray-400 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-white/50">{getStatusText()}</p>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex flex-col items-center gap-1">
          <Shield className="w-4 h-4 text-green-400" />
          <span className="text-xs text-white/60">E2E</span>
        </div>
        {isSelected && (
          <Check className="w-5 h-5 text-green-400" />
        )}
      </div>
    </button>
  );
};

const NewChat = () => {
  const navigate = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [recentContacts, setRecentContacts] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchType, setSearchType] = useState('nickname'); // 'nickname', 'phone', 'hash'
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const currentUser = zeroKnowledgeAuth.getUser();

  // Store presence channel reference for proper cleanup
  const [presenceChannel, setPresenceChannel] = useState(null);

  // Load recent contacts and setup presence on component mount
  useEffect(() => {
    loadRecentContacts();
    setupUserPresence();
    
    return () => {
      // Proper cleanup of presence subscription
      if (presenceChannel) {
        try {
          presenceChannel.untrack();
          presenceChannel.unsubscribe();
        } catch (error) {
          console.warn('Presence cleanup warning:', error.message);
        }
      }
      
      // Additional cleanup with delay for safety
      try {
        setTimeout(() => {
          supabase.removeAllChannels();
        }, 50);
      } catch (error) {
        // Silent cleanup - no need to warn in console
      }
    };
  }, [presenceChannel]);

  // Handle search query changes
  useEffect(() => {
    if (searchQuery.length >= 3) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [searchQuery]);

  const loadRecentContacts = async () => {
    try {
      const currentUserId = sessionStorage.getItem('userId');
      if (!currentUserId) return;

      // Get recent chats through joins - fixed query
      const { data: recentChats, error } = await supabase
        .from('chat_participants')
        .select(`
          chat_id,
          chats!inner(
            id,
            type,
            name,
            updated_at
          )
        `)
        .eq('user_id', currentUserId)
        .eq('chats.type', 'direct')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading recent contacts:', error);
        setRecentContacts([]);
      } else if (recentChats) {
        // Get other participants from these chats
        const chatIds = recentChats.map(rc => rc.chat_id);
        
        if (chatIds.length > 0) {
          const { data: otherParticipants, error: participantsError } = await supabase
            .from('chat_participants')
            .select(`
              chat_id,
              users!inner(
                id,
                full_name,
                phone,
                avatar_url,
                cyphr_id,
                status,
                last_seen
              )
            `)
            .in('chat_id', chatIds)
            .neq('user_id', currentUserId);
            
          if (!participantsError && otherParticipants) {
            const contacts = otherParticipants.map(p => ({
              ...p.users,
              chat_id: p.chat_id
            }));
            setRecentContacts(contacts);
            console.log('📞 Recent contacts loaded:', contacts.length);
          } else {
            setRecentContacts([]);
          }
        } else {
          setRecentContacts([]);
        }
      }
    } catch (error) {
      console.error('Error loading recent contacts:', error);
    }
  };

  const setupUserPresence = async () => {
    try {
      // Subscribe to user presence updates
      const channel = supabase.channel('user-presence')
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const online = new Set();
          
          Object.keys(state).forEach(userId => {
            if (state[userId].length > 0) {
              online.add(userId);
            }
          });
          
          setOnlineUsers(online);
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          setOnlineUsers(prev => new Set([...prev, key]));
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          setOnlineUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(key);
            return newSet;
          });
        });

      await channel.subscribe();
      
      // Store channel reference for cleanup
      setPresenceChannel(channel);

      // Track current user presence
      const currentUserId = sessionStorage.getItem('userId');
      if (currentUserId) {
        await channel.track({
          user_id: currentUserId,
          online_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error setting up user presence:', error);
    }
  };

  const searchUsers = async () => {
    try {
      setIsSearching(true);
      const currentUserId = sessionStorage.getItem('userId');
      
      let query = supabase
        .from('users')
        .select('id, full_name, phone, avatar_url, status, last_seen, cyphr_id, nickname')
        .neq('id', currentUserId)
        .limit(20);

      // Determine search type based on query format
      const isPhoneNumber = /^\+?[\d\s\-()]+$/.test(searchQuery.trim());
      const cleanQuery = searchQuery.trim().toLowerCase();

      if (isPhoneNumber) {
        // Phone number search - direct search only
        const phoneClean = searchQuery.replace(/[\s\-()]/g, '');
        query = query.ilike('phone', `%${phoneClean}%`);
      } else if (cleanQuery.startsWith('@')) {
        // Cyphr ID search (remove @ prefix)
        const cyphrIdQuery = cleanQuery.substring(1);
        query = query.ilike('cyphr_id', `%${cyphrIdQuery}%`);
      } else {
        // Text search - search in full name, nickname, and cyphr_id
        query = query.or(`full_name.ilike.%${cleanQuery}%,nickname.ilike.%${cleanQuery}%,cyphr_id.ilike.%${cleanQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Sort results by relevance and online status
      const sortedUsers = (data || []).sort((a, b) => {
        // Online users first
        const aOnline = onlineUsers.has(a.id);
        const bOnline = onlineUsers.has(b.id);
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;

        // Then by name relevance
        const aName = (a.full_name || a.cyphr_id || '').toLowerCase();
        const bName = (b.full_name || b.cyphr_id || '').toLowerCase();
        
        const aStartsWith = aName.startsWith(cleanQuery);
        const bStartsWith = bName.startsWith(cleanQuery);
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        return aName.localeCompare(bName);
      });

      setUsers(sortedUsers);

      // Analytics for search improvement
      console.log(`🔍 Search completed: "${searchQuery}" -> ${sortedUsers.length} results`);
      
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
      setUsers([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartChat = async (user) => {
    try {
      setSelectedUser(user);
      const currentUserId = sessionStorage.getItem('userId');
      
      if (!currentUserId) {
        toast.error('Please log in first');
        navigate('/');
        return;
      }
      
      // Check if chat already exists by finding chats where both users are participants
      const { data: existingParticipants } = await supabase
        .from('chat_participants')
        .select('chat_id, chats!inner(type)')
        .in('user_id', [currentUserId, user.id])
        .eq('chats.type', 'direct');

      // Group by chat_id and find chats with both users
      const chatCounts = {};
      existingParticipants?.forEach(p => {
        chatCounts[p.chat_id] = (chatCounts[p.chat_id] || 0) + 1;
      });
      
      const existingChatId = Object.keys(chatCounts).find(chatId => chatCounts[chatId] === 2);
      
      if (existingChatId) {
        // Navigate to existing chat
        navigate(`/chats/${existingChatId}`);
        return;
      }

      // Create new private chat
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          name: `${user.full_name || user.cyphr_id || 'User'}`,
          type: 'direct',
          created_by: currentUserId
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add participants
      const { error: participantsError } = await supabase
        .from('chat_participants')
        .insert([
          { chat_id: newChat.id, user_id: currentUserId },
          { chat_id: newChat.id, user_id: user.id }
        ]);

      if (participantsError) throw participantsError;

      toast.success('Chat created successfully');
      navigate(`/chats/${newChat.id}`);
    } catch (error) {
      console.error('Error creating chat:', error);
      toast.error('Failed to create chat');
      setSelectedUser(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[rgb(10,14,39)] to-[rgb(30,36,80)] text-white">
      {/* Header */}
      <div className="glass border-b border-white/10">
        <div className="p-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/chats')}
            className="p-2 glass rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold">New Chat</h1>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by phone or nickname..."
            className="w-full pl-12 pr-4 py-3 glass rounded-xl text-white placeholder-white/50"
            autoFocus
          />
        </div>

        {searchQuery.length > 0 && searchQuery.length < 3 && (
          <p className="text-xs text-white/50 mt-2 px-2">Enter at least 3 characters to search</p>
        )}
      </div>

      {/* Recent Contacts */}
      {!searchQuery && recentContacts.length > 0 && (
        <div className="px-4 mb-6">
          <h2 className="text-sm font-medium text-white/70 mb-3 px-2">Recent Contacts</h2>
          <div className="space-y-2">
            {recentContacts.map((user) => (
              <UserCard 
                key={user.id} 
                user={user} 
                onSelect={handleStartChat}
                isSelected={selectedUser?.id === user.id}
                isOnline={onlineUsers.has(user.id)}
                showRecentIndicator={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="px-4">
        {isSearching ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full mx-auto mb-3"></div>
            <div className="text-white/60">Searching...</div>
          </div>
        ) : users.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white/70 mb-3 px-2">
              Search Results ({users.length})
            </h3>
            {users.map((user) => (
              <UserCard 
                key={user.id} 
                user={user} 
                onSelect={handleStartChat}
                isSelected={selectedUser?.id === user.id}
                isOnline={onlineUsers.has(user.id)}
                showRecentIndicator={false}
              />
            ))}
          </div>
        ) : searchQuery.length >= 3 ? (
          <div className="text-center py-20">
            <Phone className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No users found</h3>
            <p className="text-white/60 text-sm">Try searching with a different phone or nickname</p>
            <div className="mt-4 p-3 glass rounded-lg text-left">
              <p className="text-xs text-white/50 mb-2">Search tips:</p>
              <ul className="text-xs text-white/60 space-y-1">
                <li>• Try full phone number with country code</li>
                <li>• Search by full name or nickname</li>
                <li>• Check spelling and try variations</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <Shield className="w-16 h-16 text-purple-400/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Start a quantum-encrypted chat</h3>
            <p className="text-white/60 text-sm">Search for users by phone number or nickname</p>
            <div className="mt-6 flex justify-center gap-4 text-xs text-white/50">
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span>End-to-end encrypted</span>
              </div>
              <div className="flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                <span>Real-time delivery</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="fixed bottom-0 left-0 right-0 p-4">
        <div className="glass rounded-2xl p-4 flex items-center gap-3">
          <Shield className="w-10 h-10 text-green-400 flex-shrink-0" />
          <div>
            <h4 className="font-medium text-sm">Quantum-Encrypted</h4>
            <p className="text-xs text-white/60">All chats are protected with Kyber1024 + ChaCha20</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewChat; 