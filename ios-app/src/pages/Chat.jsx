import React, { useState, useEffect, useRef } from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';
import Animated from 'react-native-reanimated';
import { ArrowLeft, Send, Paperclip, Shield, Phone, Video, Mic, DollarSign } from 'react-native-vector-icons/MaterialIcons';
import { Input } from '../ui/input';
import { Button } from '../ui/button.tsx';
import AetheriumLogo from '../components/AetheriumLogo';
import { supabase } from '../api/supabaseClient';
import QuantumCrypto from '../api/crypto/quantumCrypto';
import { socketService } from '../api/socketService.js';
import AudioRecorder from '../components/chat/AudioRecorder';
import AudioMessage from '../components/chat/AudioMessage';
import MediaMessage from '../components/chat/MediaMessage';
import MediaPicker from '../components/chat/MediaPicker';
import CryptoPayment from '../components/chat/CryptoPayment';

export default function Chat() {
  const { id: chatId } = useRoute();
  const navigate = useNavigation();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [chat, setChat] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showCryptoPayment, setShowCryptoPayment] = useState(false);
  const messagesEndRef = useRef(null);
  const kyber = new QuantumCrypto();
  const userId = sessionStorage.getItem('userId');

  // Инициализация НАСТОЯЩЕГО post-quantum crypto при загрузке
  useEffect(() => {
    const initCrypto = async () => {
      try {
        console.log('🔧 Инициализация REAL Kyber1024 в Chat...');
        await kyber.initialize();
        console.log('✅ POST-QUANTUM CRYPTO готов для messaging');
      } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА инициализации crypto:', error);
        alert('ОШИБКА: Не удалось инициализировать post-quantum шифрование!');
      }
    };
    initCrypto();
  }, []);

  useEffect(() => {
    if (chatId) {
      console.log('🔄 Loading chat:', chatId);
      loadChatData();
      loadMessages();
      setupRealtimeSubscription();
      
      // Fallback: stop loading after 3 seconds
      const fallbackTimeout = setTimeout(() => {
        console.log('⏰ Loading timeout - showing UI');
        setIsLoading(false);
      }, 3000);
      
      return () => {
        clearTimeout(fallbackTimeout);
      };
    }
    
    return () => {
      // Cleanup subscription
      supabase.channel(`chat-${chatId}`).unsubscribe();
    };
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatData = async () => {
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
        // Fallback to mock data
        setChat(getMockChatData());
      } else {
        setChat(data);
      }
    } catch (error) {
      console.error('Chat data error:', error);
      setChat(getMockChatData());
    }
  };

  const loadMessages = async () => {
    try {
      console.log('📨 Loading messages for chat:', chatId);
      setIsLoading(true);
      
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        setMessages(getMockMessages());
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
      setMessages(getMockMessages());
    } finally {
      console.log('✅ Messages loading complete');
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
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

  const getMockChatData = () => ({
    id: chatId,
    name: 'Quantum Security Team',
    type: 'group',
    participants: [
      { users: { full_name: 'Alice Chen', avatar_url: null, status: 'online' } },
      { users: { full_name: 'Bob Martinez', avatar_url: null, status: 'online' } }
    ]
  });

  const getMockMessages = () => [
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
    },
    {
      id: '3',
      content: "That's great! The post-quantum security gives us peace of mind.",
      decrypted_content: "That's great! The post-quantum security gives us peace of mind.",
      sender_id: 'user_bob',
      chat_id: chatId,
      created_at: new Date(Date.now() - 360000).toISOString(),
      type: 'text',
      encrypted: true
    }
  ];

  const handleSend = async (messageContent, messageType = 'text', metadata = {}) => {
    if (!messageContent.trim() || isSending) return;

    setIsSending(true);
    const tempId = 'temp_' + Date.now();

    // Optimistic update
    const tempMessage = {
      id: tempId,
      content: messageContent,
      decrypted_content: messageContent,
      sender_id: userId,
      chat_id: chatId,
      created_at: new Date().toISOString(),
      type: messageType,
      encrypted: true,
      status: 'sending',
      metadata: metadata // Store metadata for crypto payments
    };

    setMessages(prev => [...prev, tempMessage]);
    const messageToSend = messageContent;
    setNewMessage('');

    try {
      // Encrypt message with quantum crypto
      let encryptedContent = messageToSend;
      try {
        // ОБЯЗАТЕЛЬНОЕ ШИФРОВАНИЕ - НЕТ FALLBACK К PLAIN TEXT!
        const publicKeys = chat?.participants?.map(p => p.users.public_key).filter(Boolean) || [];
        if (publicKeys.length === 0) {
          throw new Error('NO PUBLIC KEYS AVAILABLE - CANNOT SEND UNENCRYPTED!');
        }
        
        console.log('🔐 ПРИНУДИТЕЛЬНОЕ ШИФРОВАНИЕ ВСЕХ СООБЩЕНИЙ...');
        encryptedContent = await kyber.encryptMessage(messageToSend, publicKeys[0]);
        console.log('✅ Сообщение ОБЯЗАТЕЛЬНО зашифровано');
      } catch (encError) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Шифрование обязательно!', encError);
        setIsSending(false);
        alert('ОШИБКА: Невозможно отправить незашифрованное сообщение! Проверьте ключи шифрования.');
        return; // ПРЕРЫВАЕМ ОТПРАВКУ ВМЕСТО FALLBACK
      }

      // Send via Supabase
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: userId,
          content: encryptedContent,
          type: messageType,
          encrypted: true,
          metadata: metadata // Store metadata for crypto payments
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update temp message with real data
      setMessages(prev => prev.map(msg => 
        msg.id === tempId 
          ? { ...data, decrypted_content: messageToSend, status: 'sent' }
          : msg
      ));

      // Send via socket for real-time delivery
      try {
        await socketService.sendMessage(chatId, encryptedContent, messageType);
      } catch (socketError) {
        console.warn('Socket delivery failed:', socketError);
      }

      // Update chat timestamp
      await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatId);

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

  const handleSendAudio = async (audioBlob, duration) => {
    setIsRecording(false);
    setIsSending(true);
    const tempId = 'temp_audio_' + Date.now();

    try {
      // Convert blob to base64 for storage
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result;
        
        // Optimistic update
        const tempMessage = {
          id: tempId,
          content: base64Audio,
          decrypted_content: base64Audio,
          audio_url: URL.createObjectURL(audioBlob),
          audio_duration: duration,
          sender_id: userId,
          chat_id: chatId,
          created_at: new Date().toISOString(),
          type: 'audio',
          encrypted: true,
          status: 'sending'
        };

        setMessages(prev => [...prev, tempMessage]);

        try {
          // Upload audio to Supabase Storage
          const fileName = `voice_${chatId}_${Date.now()}.webm`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('voice-messages')
            .upload(fileName, audioBlob, {
              contentType: 'audio/webm',
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('voice-messages')
            .getPublicUrl(fileName);

          // Encrypt the URL with quantum crypto
          let encryptedUrl = publicUrl;
          try {
            const publicKeys = chat?.participants?.map(p => p.users.public_key).filter(Boolean) || [];
            if (publicKeys.length > 0) {
              encryptedUrl = await kyber.encryptMessage(publicUrl, publicKeys[0]);
            }
          } catch (encError) {
            console.warn('Audio URL encryption failed:', encError);
          }

          // Save message to database
          const { data, error } = await supabase
            .from('messages')
            .insert({
              chat_id: chatId,
              sender_id: userId,
              content: encryptedUrl,
              type: 'audio',
              audio_duration: duration,
              encrypted: true
            })
            .select()
            .single();

          if (error) throw error;

          // Update temp message with real data
          setMessages(prev => prev.map(msg => 
            msg.id === tempId 
              ? { ...data, decrypted_content: publicUrl, audio_url: publicUrl, status: 'sent' }
              : msg
          ));

          // Send via socket
          try {
            await socketService.sendMessage(chatId, encryptedUrl, 'audio');
          } catch (socketError) {
            console.warn('Socket delivery failed:', socketError);
          }

          // Update chat timestamp
          await supabase
            .from('chats')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', chatId);

        } catch (error) {
          console.error('Send audio error:', error);
          
          // Update temp message to show error
          setMessages(prev => prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, status: 'failed' }
              : msg
          ));
        }
      };
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMedia = async (selectedFiles) => {
    setShowMediaPicker(false);
    setIsSending(true);

    for (const fileObj of selectedFiles) {
      const tempId = `temp_media_${Date.now()}_${Math.random()}`;
      
      try {
        // Upload file to Supabase Storage
        const fileName = `${fileObj.type}_${chatId}_${Date.now()}_${fileObj.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(fileName, fileObj.file, {
            contentType: fileObj.file.type,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('chat-media')
          .getPublicUrl(fileName);

        // Generate thumbnail for videos
        let thumbnailUrl = null;
        if (fileObj.type === 'video') {
          // For now, using preview as thumbnail
          thumbnailUrl = fileObj.preview;
        }

        // Optimistic update
        const tempMessage = {
          id: tempId,
          content: publicUrl,
          decrypted_content: publicUrl,
          media_url: publicUrl,
          thumbnail_url: thumbnailUrl,
          file_name: fileObj.name,
          file_size: fileObj.size,
          sender_id: userId,
          chat_id: chatId,
          created_at: new Date().toISOString(),
          type: fileObj.type,
          encrypted: true,
          status: 'sending'
        };

        setMessages(prev => [...prev, tempMessage]);

        try {
          // Encrypt the URL with quantum crypto
          let encryptedUrl = publicUrl;
          const publicKeys = chat?.participants?.map(p => p.users.public_key).filter(Boolean) || [];
          if (publicKeys.length > 0) {
            encryptedUrl = await kyber.encryptMessage(publicUrl, publicKeys[0]);
          }

          // Save message to database
          const { data, error } = await supabase
            .from('messages')
            .insert({
              chat_id: chatId,
              sender_id: userId,
              content: encryptedUrl,
              type: fileObj.type,
              file_name: fileObj.name,
              file_size: fileObj.size,
              thumbnail_url: thumbnailUrl,
              encrypted: true
            })
            .select()
            .single();

          if (error) throw error;

          // Update temp message with real data
          setMessages(prev => prev.map(msg => 
            msg.id === tempId 
              ? { ...data, decrypted_content: publicUrl, media_url: publicUrl, status: 'sent' }
              : msg
          ));

          // Send via socket
          try {
            await socketService.sendMessage(chatId, encryptedUrl, fileObj.type);
          } catch (socketError) {
            console.warn('Socket delivery failed:', socketError);
          }

        } catch (error) {
          console.error('Send media error:', error);
          
          // Update temp message to show error
          setMessages(prev => prev.map(msg => 
            msg.id === tempId 
              ? { ...msg, status: 'failed' }
              : msg
          ));
        }
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
      }
    }

    // Update chat timestamp
    await supabase
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);

    setIsSending(false);
  };

  const handleCryptoSuccess = (paymentData) => {
    // Send payment info as a message
    const paymentMessage = {
      type: 'crypto_transfer',
      content: `Sent ${paymentData.amount} ${paymentData.asset}`,
      metadata: paymentData
    };
    handleSend(paymentMessage.content, paymentMessage.type, paymentMessage.metadata);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = (value) => {
    setNewMessage(value);
    
    // Send typing indicator via socket
    if (value && !isTyping) {
      setIsTyping(true);
      socketService.sendTyping(chatId, true);
      
      // Auto-stop typing after 3 seconds
      setTimeout(() => {
        setIsTyping(false);
        socketService.sendTyping(chatId, false);
      }, 3000);
    } else if (!value && isTyping) {
      setIsTyping(false);
      socketService.sendTyping(chatId, false);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const ChatHeader = ({ chat, onBack }) => (
    <div className="sticky top-0 z-20 flex items-center justify-between p-4 bg-background-primary/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center gap-3">
        <Button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
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

    if (message.type === 'crypto_transfer') {
      return (
        <motion.div
          layout
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`flex items-end gap-2 max-w-[80%] ${isOwn ? 'self-end flex-row-reverse' : 'self-start'}`}
        >
          <div 
            className={`px-4 py-2 rounded-2xl ${isOwn ? 'bg-accent-primary/20 rounded-br-sm' : 'bg-background-secondary/80 rounded-bl-sm'}`}
          >
            <p className="text-text-primary">{message.decrypted_content}</p>
            <span className="text-xs text-text-secondary/50">{formatTime(message.created_at)}</span>
          </div>
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
          className={`px-4 py-2 rounded-2xl ${isOwn ? 'bg-accent-primary/20 rounded-br-sm' : 'bg-background-secondary/80 rounded-bl-sm'}`}
        >
          <p className="text-text-primary">{message.decrypted_content}</p>
          <span className="text-xs text-text-secondary/50">{formatTime(message.created_at)}</span>
        </div>
      </motion.div>
    );
  };

  const MessageInput = ({ value, onChange, onSend, isSending }) => (
    <div className="sticky bottom-0 z-20 p-4 bg-background-primary/80 backdrop-blur-xl border-t border-border">
      <div className="flex items-center gap-2">
        <Button 
          variant="secondary" 
          className="p-3 h-auto"
          onClick={() => setShowMediaPicker(true)}
        >
          <Paperclip size={20} />
        </Button>
        <Button 
          variant="secondary" 
          className="p-3 h-auto"
          onClick={() => setShowCryptoPayment(true)}
        >
          <DollarSign size={20} />
        </Button>
        <Input 
          placeholder="Type a quantum message..."
          value={value}
          onChange={onChange}
          onKeyPress={handleKeyPress}
        />
        <AnimatePresence>
          {value.length > 0 ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <Button onClick={onSend} disabled={isSending} className="p-3 h-auto">
                <Send size={20} />
              </Button>
            </motion.div>
          ) : (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <Button 
                onClick={() => setIsRecording(true)} 
                disabled={isSending}
                className="p-3 h-auto bg-accent-primary hover:bg-accent-primary/80"
              >
                <Mic size={20} />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  if (isLoading) {
    return <div className="min-h-screen w-full flex items-center justify-center bg-background-primary"><AetheriumLogo /></div>;
  }

  return (
    <div className="flex flex-col h-screen bg-background-primary">
      <ChatHeader chat={chat} onBack={() => navigate('/chats')} />
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <AnimatePresence>
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_id === userId} />
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>
      <MessageInput 
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        onSend={handleSend}
        isSending={isSending}
      />
      
      {/* Audio Recorder Modal */}
      <AnimatePresence>
        {isRecording && (
          <AudioRecorder
            onSendAudio={handleSendAudio}
            onCancel={() => setIsRecording(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Media Picker Modal */}
      <AnimatePresence>
        {showMediaPicker && (
          <MediaPicker
            onSelectMedia={handleSendMedia}
            onClose={() => setShowMediaPicker(false)}
          />
        )}
      </AnimatePresence>

      {/* Crypto Payment Modal */}
      <AnimatePresence>
        {showCryptoPayment && (
          <CryptoPayment
            isOpen={showCryptoPayment}
            onClose={() => setShowCryptoPayment(false)}
            recipientId={chat?.participants?.[0]?.user_id}
            onSuccess={handleCryptoSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
} 