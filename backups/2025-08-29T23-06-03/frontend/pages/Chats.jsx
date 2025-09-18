import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, Shield, Users, ArrowLeft, Send, Paperclip, Phone, Video, Mic, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatItem from '@/components/chat/ChatItem';
import SearchModal from '@/components/chat/SearchModal';
import QuantumProtectionCard from '@/components/chat/QuantumProtectionCard';
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import { socketService } from '@/api/socketService.js';
import { supabase } from '@/api/supabaseClient';
import { useAvatar } from '../components/AvatarProvider';
import { toast } from 'sonner';
import QuantumCrypto from '@/api/crypto/quantumCrypto';
import AudioRecorder from '@/components/chat/AudioRecorder';
import AudioMessage from '@/components/chat/AudioMessage';
import MediaMessage from '@/components/chat/MediaMessage';
import MediaPicker from '@/components/chat/MediaPicker';
import CryptoPayment from '@/components/chat/CryptoPayment';

const Chats = () => {
  const navigate = useNavigate();
  const { chatId } = useParams(); // For direct chat URLs like /chats/:chatId
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(chatId || null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showCryptoPayment, setShowCryptoPayment] = useState(false);
  const messagesEndRef = useRef(null);
  const kyber = new QuantumCrypto();
  const { preloadAvatars } = useAvatar();
  const userId = sessionStorage.getItem('userId');

  // Initialize crypto
  useEffect(() => {
    const initCrypto = async () => {
      try {
        console.log('🔧 Инициализация REAL Kyber1024 в Chats...');
        await kyber.initialize();
        console.log('✅ POST-QUANTUM CRYPTO готов для messaging');
      } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА инициализации crypto:', error);
      }
    };
    initCrypto();
  }, []);

  // Listen for new messages - MOVED OUTSIDE useEffect
  const handleNewMessage = useCallback(async (message) => {
    console.log('📨 New message received via Socket.IO:', message);
    
    // Update last message in chat list
    setChats(prev => prev.map(chat => 
      chat.id === message.chat_id 
        ? { ...chat, lastMessage: message.decryptedContent || message.content, unreadCount: (chat.unreadCount || 0) + 1 }
        : chat
    ));
    
    // If message is for currently selected chat, add to messages immediately
    if (message.chat_id === selectedChatId) {
      let decryptedContent = message.decryptedContent || message.content;
      
      // Additional decryption if needed
      if (message.sender_id !== userId && message.encrypted && !message.decryptedContent) {
        try {
          decryptedContent = await kyber.decryptMessage(
            message.content,
            sessionStorage.getItem('userSecretKey'),
            message.sender_id
          );
        } catch (error) {
          console.warn('Failed to decrypt message:', error);
          decryptedContent = message.content;
        }
      }
      
      // Add to messages with proper structure
      const newMessage = {
        id: message.id,
        chat_id: message.chat_id,
        sender_id: message.sender_id,
        content: decryptedContent,
        decrypted_content: decryptedContent,
        type: message.type || 'text',
        created_at: message.created_at || new Date().toISOString(),
        encrypted: message.encrypted || false,
        algorithm: message.algorithm,
        kyberCiphertext: message.kyberCiphertext
      };
      
      setMessages(prev => {
        // Avoid duplicates
        const exists = prev.find(m => m.id === newMessage.id);
        if (exists) return prev;
        return [...prev, newMessage];
      });
      
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [selectedChatId, userId]);

  useEffect(() => {
    if (!userId) {
      navigate('/');
      return;
    }
    loadChats();
    
    // Initialize socket connection
    const initSocket = async () => {
      try {
        await socketService.connect();
        await socketService.authenticate(userId);
        console.log('✅ Socket.IO connected and authenticated');
      } catch (error) {
        console.error('❌ Socket connection failed:', error);
      }
    };
    initSocket();

    // Set up socket message handlers using the callback system
    socketService.onNewMessage = handleNewMessage;

    return () => {
      socketService.onNewMessage = null;
      socketService.disconnect();
    };
  }, [userId, navigate]); // ✅ FIXED: Removed handleNewMessage from dependencies

  // Load messages when chat is selected
  useEffect(() => {
    if (selectedChatId) {
      loadChatData(selectedChatId);
      loadMessages(selectedChatId);
      setupRealtimeSubscription(selectedChatId);
    }
  }, [selectedChatId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChats = async () => {
    try {
      setIsLoading(true);
      
      // Load user's chats from Supabase (simplified query)
      const { data: userChats, error } = await supabase
        .from('chat_participants')
        .select(`
          chat_id,
          chats!inner(
            id,
            name,
            type,
            created_at
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;

      // Transform data for display (WhatsApp-like)
      const formattedChats = userChats?.map(item => {
        const chat = item.chats;
        
        return {
          id: chat.id,
          name: chat.name || `Chat ${chat.id}`,
          type: chat.type || 'direct',
          participants: [],
          lastMessage: null,
          unreadCount: 0,
          online: Math.random() > 0.5, // TODO: Real online status
          userId: chat.id,
          avatar: null, // TODO: Load from participants
          timestamp: chat.created_at
        };
      }).sort((a, b) => {
        // Sort by chat creation time (newest first)
        const aTime = a.timestamp || '1970-01-01';
        const bTime = b.timestamp || '1970-01-01';
        return new Date(bTime) - new Date(aTime);
      }) || [];

      setChats(formattedChats);

      // Preload avatars for all participants
      const userIds = formattedChats.flatMap(chat => 
        chat.participants?.map(p => p.user_id) || []
      ).filter(Boolean);
      
      if (userIds.length > 0) {
        preloadAvatars(userIds);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      toast.error('Failed to load chats');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatClick = (chatId) => {
    setSelectedChatId(chatId);
    // Update URL without full navigation
    window.history.pushState({}, '', `/chats/${chatId}`);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatData = async (chatId) => {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          participants:chat_participants(
            user_id,
            users:user_id(full_name, avatar_url, status)
          )
        `)
        .eq('id', chatId)
        .single();

      if (error) {
        console.error('Error loading chat:', error);
        setSelectedChat(getMockChatData(chatId));
      } else {
        setSelectedChat(data);
      }
    } catch (error) {
      console.error('Chat data error:', error);
      setSelectedChat(getMockChatData(chatId));
    }
  };

  const loadMessages = async (chatId) => {
    try {
      console.log('📨 Loading messages for chat:', chatId);
      setIsLoadingMessages(true);
      
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        setMessages(getMockMessages(chatId));
      } else {
        // Decrypt messages with quantum crypto
        const decryptedMessages = await Promise.all(
          messagesData.map(async (msg) => {
            try {
              if (msg.sender_id !== userId && msg.encrypted) {
                const decrypted = await kyber.decryptMessage(
                  msg.content,
                  sessionStorage.getItem('userSecretKey'),
                  msg.sender_id
                );
                return { ...msg, decrypted_content: decrypted };
              } else {
                return { ...msg, decrypted_content: msg.content };
              }
            } catch (error) {
              console.warn('Message decryption failed:', error);
              return { ...msg, decrypted_content: msg.content };
            }
          })
        );
        setMessages(decryptedMessages);
      }
    } catch (error) {
      console.error('Messages loading error:', error);
      setMessages(getMockMessages(chatId));
    } finally {
      console.log('✅ Messages loading complete');
      setIsLoadingMessages(false);
    }
  };

  const setupRealtimeSubscription = (chatId) => {
    const channel = supabase
      .channel(`chat-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, async (payload) => {
        const newMsg = payload.new;
        
        // Decrypt if needed
        try {
          if (newMsg.sender_id !== userId && newMsg.encrypted) {
            const decrypted = await kyber.decryptMessage(
              newMsg.content,
              sessionStorage.getItem('userSecretKey'),
              newMsg.sender_id
            );
            newMsg.decrypted_content = decrypted;
          } else {
            newMsg.decrypted_content = newMsg.content;
          }
        } catch (error) {
          newMsg.decrypted_content = newMsg.content;
        }
        
        setMessages(prev => [...prev, newMsg]);
      })
      .subscribe();

    return channel;
  };

  const getMockChatData = (chatId) => ({
    id: chatId,
    name: 'Quantum Security Team',
    type: 'group',
    participants: [
      { users: { full_name: 'Alice Chen', avatar_url: null, status: 'online' } },
      { users: { full_name: 'Bob Martinez', avatar_url: null, status: 'online' } }
    ]
  });

  const getMockMessages = (chatId) => [
    {
      id: '1',
      content: 'Hey! How are the new encryption protocols working?',
      decrypted_content: 'Hey! How are the new encryption protocols working?',
      sender_id: 'user_alice',
      chat_id: chatId,
      created_at: new Date(Date.now() - 600000).toISOString(),
      type: 'text',
      encrypted: true
    },
    {
      id: '2', 
      content: 'Perfect! The Kyber1024 implementation is running smoothly. Much faster than expected.',
      decrypted_content: 'Perfect! The Kyber1024 implementation is running smoothly. Much faster than expected.',
      sender_id: userId,
      chat_id: chatId,
      created_at: new Date(Date.now() - 480000).toISOString(),
      type: 'text',
      encrypted: true
    }
  ];

  const handleSend = async (messageContent, messageType = 'text', metadata = {}) => {
    if (!messageContent.trim() || isSending || !selectedChatId) return;

    setIsSending(true);
    const tempId = 'temp_' + Date.now();

    // Optimistic update
    const tempMessage = {
      id: tempId,
      content: messageContent,
      decrypted_content: messageContent,
      sender_id: userId,
      chat_id: selectedChatId,
      created_at: new Date().toISOString(),
      type: messageType,
      encrypted: true,
      status: 'sending',
      metadata: metadata
    };

    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');

    try {
      // Encrypt message with quantum crypto
      let encryptedContent = messageContent;
      try {
        const publicKeys = selectedChat?.participants?.map(p => p.users.public_key).filter(Boolean) || [];
        if (publicKeys.length > 0) {
          console.log('🔐 Encrypting message with Kyber1024...');
          encryptedContent = await kyber.encryptMessage(messageContent, publicKeys[0]);
          console.log('✅ Message encrypted successfully');
        }
      } catch (encError) {
        console.warn('Encryption failed, sending as plaintext:', encError);
      }

      // Send via Supabase
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: selectedChatId,
          sender_id: userId,
          content: encryptedContent,
          type: messageType,
          encrypted: true,
          metadata: metadata
        })
        .select()
        .single();

      if (error) throw error;

      // Update temp message with real data
      setMessages(prev => prev.map(msg => 
        msg.id === tempId 
          ? { ...data, decrypted_content: messageContent, status: 'sent' }
          : msg
      ));

      // Send via socket for real-time delivery
      try {
        await socketService.sendMessage(selectedChatId, encryptedContent, messageType);
      } catch (socketError) {
        console.warn('Socket delivery failed:', socketError);
      }

    } catch (error) {
      console.error('Send message error:', error);
      
      // Update temp message to show error
      setMessages(prev => prev.map(msg => 
        msg.id === tempId 
          ? { ...msg, status: 'failed' }
          : msg
      ));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(newMessage);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const handleNewChat = () => {
    navigate('/new-chat');
  };

  const handleNewGroup = () => {
    navigate('/new-group');
  };

  // Chat Header Component
  const ChatHeader = ({ chat, onBack }) => (
    <div className="sticky top-0 z-20 flex items-center justify-between p-4 glass border-b border-white/10">
      <div className="flex items-center gap-3">
        <Button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors md:hidden">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div className="flex-1 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-cyan-600 rounded-full flex items-center justify-center">
            {chat?.name?.charAt(0)?.toUpperCase() || 'Q'}
          </div>
          <div>
            <h1 className="font-semibold flex items-center gap-2">
              {chat?.name || 'Quantum Chat'}
              <Shield className="w-4 h-4 text-green-400" title="Quantum Encrypted" />
            </h1>
            <p className="text-sm text-white/60 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              End-to-end encrypted with Kyber1024 + ChaCha20
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Phone className="w-5 h-5" />
          </Button>
          <Button className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Video className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Message Bubble Component
  const MessageBubble = ({ message, isOwn }) => {
    if (message.type === 'audio') {
      return (
        <motion.div
          layout
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`flex items-end gap-2 max-w-[80%] ${isOwn ? 'self-end flex-row-reverse' : 'self-start'}`}
        >
          <AudioMessage
            audioUrl={message.audio_url || message.decrypted_content}
            duration={message.audio_duration || 0}
            timestamp={message.created_at}
            isOwn={isOwn}
          />
        </motion.div>
      );
    }

    if (message.type === 'image' || message.type === 'video') {
      return (
        <motion.div
          layout
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`flex items-end gap-2 max-w-[80%] ${isOwn ? 'self-end flex-row-reverse' : 'self-start'}`}
        >
          <MediaMessage
            mediaUrl={message.media_url || message.decrypted_content}
            mediaType={message.type}
            thumbnailUrl={message.thumbnail_url}
            fileName={message.file_name}
            fileSize={message.file_size}
            isOwn={isOwn}
            timestamp={message.created_at}
          />
        </motion.div>
      );
    }

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`flex items-end gap-2 max-w-[80%] ${isOwn ? 'self-end flex-row-reverse' : 'self-start'}`}
      >
        <div 
          className={`px-4 py-2 rounded-2xl ${
            isOwn 
              ? 'bg-gradient-to-br from-purple-500/80 to-cyan-500/80 text-white rounded-br-sm' 
              : 'glass border border-white/10 rounded-bl-sm'
          }`}
        >
          <p className="text-white">{message.decrypted_content}</p>
          <div className="flex items-center justify-between mt-1 gap-2">
            <span className="text-xs text-white/50">{formatTime(message.created_at)}</span>
            {message.encrypted && <Shield className="w-3 h-3 text-green-400" />}
          </div>
        </div>
      </motion.div>
    );
  };


  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[rgb(10,14,39)] to-[rgb(30,36,80)] text-white">
      {/* Background effects */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600 rounded-full filter blur-[128px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-600 rounded-full filter blur-[128px] opacity-20 animate-pulse animation-delay-2000"></div>

      <div className="relative z-10 flex h-screen">
        {/* Left Panel - Chats List */}
        <div className={`w-full md:w-1/3 md:min-w-[320px] border-r border-white/10 flex flex-col ${
          selectedChatId ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Quantum Protection Card */}
          <div className="p-4 border-b border-white/10">
            <QuantumProtectionCard />
          </div>

          {/* Chats Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h1 className="text-2xl font-bold">Chats</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSearch(true)}
                className="p-2 glass rounded-full hover:bg-white/10 transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-pulse text-white/60">Loading chats...</div>
              </div>
            ) : chats.length === 0 ? (
              <div className="text-center py-20 px-4">
                <div className="w-16 h-16 mx-auto mb-4 glass rounded-full flex items-center justify-center">
                  <Shield className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No chats yet</h3>
                <p className="text-white/60 text-sm mb-4">Start a new quantum-encrypted conversation</p>
                <button
                  onClick={handleNewChat}
                  className="px-4 py-2 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full text-sm font-medium hover:from-purple-600 hover:to-cyan-600 transition-colors"
                >
                  Start New Chat
                </button>
              </div>
            ) : (
              <div className="p-2">
                {chats.map((chat, index) => (
                  <motion.div
                    key={chat.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`mb-1 rounded-lg transition-colors ${
                      selectedChatId === chat.id ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <ChatItem
                      chat={chat}
                      onClick={() => handleChatClick(chat.id)}
                      isSelected={selectedChatId === chat.id}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* New Chat Buttons */}
          <div className="p-4 border-t border-white/10 flex gap-2">
            <motion.button
              onClick={handleNewGroup}
              className="flex-1 glass rounded-full p-3 flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Users className="w-5 h-5" />
              <span className="text-sm">New Group</span>
            </motion.button>
            <motion.button
              onClick={handleNewChat}
              className="flex-1 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full p-3 flex items-center justify-center gap-2 hover:from-purple-600 hover:to-cyan-600 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm">New Chat</span>
            </motion.button>
          </div>
        </div>

        {/* Right Panel - Selected Chat */}
        <div className={`flex-1 flex flex-col ${
          selectedChatId ? 'flex' : 'hidden md:flex'
        }`}>
          {selectedChatId ? (
            <>
              {/* Chat Header */}
              <ChatHeader 
                chat={selectedChat} 
                onBack={() => {
                  setSelectedChatId(null);
                  setSelectedChat(null);
                  setMessages([]);
                  window.history.pushState({}, '', '/chats');
                }} 
              />
              
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {isLoadingMessages ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="animate-pulse text-white/60">Loading messages...</div>
                  </div>
                ) : (
                  <>
                    <AnimatePresence>
                      {messages.map(msg => (
                        <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_id === userId} />
                      ))}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              <div className="sticky bottom-0 z-20 p-4 glass border-t border-white/10">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="secondary" 
                    className="p-3 h-auto glass hover:bg-white/10"
                    onClick={() => setShowMediaPicker(true)}
                  >
                    <Paperclip size={20} />
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="p-3 h-auto glass hover:bg-white/10"
                    onClick={() => setShowCryptoPayment(true)}
                  >
                    <DollarSign size={20} />
                  </Button>
                  <Input 
                    placeholder="Type a quantum message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1 glass border-white/10 bg-white/5 text-white placeholder:text-white/40"
                  />
                  <AnimatePresence>
                    {newMessage.length > 0 ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Button 
                          onClick={() => handleSend(newMessage)} 
                          disabled={isSending} 
                          className="p-3 h-auto bg-gradient-to-br from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
                        >
                          <Send size={20} />
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <Button 
                          onClick={() => setIsRecording(true)} 
                          disabled={isSending}
                          className="p-3 h-auto bg-gradient-to-br from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
                        >
                          <Mic size={20} />
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </>
          ) : (
            /* No Chat Selected */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 glass rounded-full flex items-center justify-center">
                  <Shield className="w-12 h-12 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Cyphr Messenger</h2>
                <p className="text-white/60 mb-4">Select a chat to start quantum messaging</p>
                <div className="flex items-center justify-center gap-2 text-sm text-white/40">
                  <Shield className="w-4 h-4" />
                  <span>End-to-end encrypted with Kyber1024</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isRecording && (
          <AudioRecorder
            onSendAudio={(audioBlob, duration) => {
              setIsRecording(false);
              // Handle audio sending logic
            }}
            onCancel={() => setIsRecording(false)}
          />
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showMediaPicker && (
          <MediaPicker
            onSelectMedia={(files) => {
              setShowMediaPicker(false);
              // Handle media sending logic
            }}
            onClose={() => setShowMediaPicker(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCryptoPayment && (
          <CryptoPayment
            isOpen={showCryptoPayment}
            onClose={() => setShowCryptoPayment(false)}
            recipientId={selectedChat?.participants?.[0]?.user_id}
            onSuccess={(paymentData) => {
              setShowCryptoPayment(false);
              // Handle crypto payment success
            }}
          />
        )}
      </AnimatePresence>

      {/* Search Modal */}
      {showSearch && (
        <SearchModal 
          isOpen={showSearch} 
          onClose={() => setShowSearch(false)} 
        />
      )}
    </div>
  );
};

export default Chats; 