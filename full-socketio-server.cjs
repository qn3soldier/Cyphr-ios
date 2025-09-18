const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// Socket.IO server with CORS configuration
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "https://app.cyphrmessenger.app",
      "https://www.cyphrmessenger.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

const PORT = process.env.PORT || 3001;

// CORS для HTTP endpoints
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174', 
    'https://app.cyphrmessenger.app',
    'https://www.cyphrmessenger.app'
  ],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

// In-memory storage для demo (в production использовать Supabase)
const activeUsers = new Map();
const chatRooms = new Map();
const messageHistory = new Map();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'CYPHR MESSENGER ENTERPRISE',
    version: '1.0.0',
    features: [
      'post-quantum-crypto',
      'hd-wallet', 
      'real-time-messaging',
      'kyber1024',
      'chacha20',
      'websocket-messaging',
      'socket-io-server'
    ],
    timestamp: new Date().toISOString(),
    activeUsers: activeUsers.size,
    activeChatRooms: chatRooms.size
  });
});

// WebRTC ICE servers endpoint
app.get('/api/ice-servers', (req, res) => {
  res.json({
    success: true,
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { 
        urls: 'turn:23.22.159.209:3478',
        username: 'cyphr-user',
        credential: 'cyphr-turn-secret-2024'
      }
    ],
    message: 'Enterprise TURN/STUN servers',
    timestamp: new Date().toISOString()
  });
});

// Auth endpoints
app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  console.log('📱 OTP request for:', phone);
  
  // В production здесь будет Twilio интеграция
  res.json({ 
    success: true, 
    message: 'OTP sent successfully',
    phone: phone
  });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  console.log('🔍 OTP verification for:', phone, 'code:', otp);
  
  // В production здесь будет реальная верификация
  if (otp === '123456' || otp === '000000') {
    const userId = crypto.randomUUID();
    res.json({ 
      success: true,
      user: {
        id: userId,
        phone: phone,
        name: `User ${phone.slice(-4)}`
      },
      token: 'jwt-token-' + userId
    });
  } else {
    res.status(400).json({ 
      success: false,
      error: 'Invalid OTP code'
    });
  }
});

// Wallet endpoints
app.post('/api/wallet/create', (req, res) => {
  const { userId } = req.body;
  console.log('🪙 Wallet creation for user:', userId);
  
  res.json({
    success: true,
    address: 'GDTEST' + crypto.randomBytes(25).toString('base64').slice(0, 50),
    message: 'HD Wallet created'
  });
});

app.get('/api/wallet/balance', (req, res) => {
  res.json({
    success: true,
    balance: {
      XLM: '100.0000000',
      USDC: '50.00'
    }
  });
});

app.post('/api/wallet/send', (req, res) => {
  const { to, amount, asset = 'XLM' } = req.body;
  console.log('💸 Transaction:', { to, amount, asset });
  
  res.json({
    success: true,
    transactionId: 'tx-' + crypto.randomBytes(16).toString('hex'),
    message: `Sent ${amount} ${asset} to ${to}`
  });
});

// Messaging endpoints
app.post('/api/messages/send', (req, res) => {
  const { chatId, content, type = 'text' } = req.body;
  console.log('💬 Message send request:', { chatId, content, type });
  
  const messageId = crypto.randomUUID();
  const message = {
    id: messageId,
    chatId,
    content,
    type,
    timestamp: new Date().toISOString(),
    status: 'sent'
  };
  
  // Сохраняем в историю
  if (!messageHistory.has(chatId)) {
    messageHistory.set(chatId, []);
  }
  messageHistory.get(chatId).push(message);
  
  // Отправляем через Socket.IO
  io.to(`chat:${chatId}`).emit('new_message', message);
  
  res.json({
    success: true,
    message: message
  });
});

app.get('/api/messages/history', (req, res) => {
  const { chatId } = req.query;
  const history = messageHistory.get(chatId) || [];
  
  res.json({
    success: true,
    messages: history
  });
});

app.post('/api/chats/create', (req, res) => {
  const { participants, name } = req.body;
  const chatId = crypto.randomUUID();
  
  chatRooms.set(chatId, {
    id: chatId,
    name: name || `Chat ${chatId.slice(0, 8)}`,
    participants: participants || [],
    created: new Date().toISOString()
  });
  
  console.log('🗣️ Chat created:', chatId);
  
  res.json({
    success: true,
    chat: chatRooms.get(chatId)
  });
});

app.get('/api/chats/list', (req, res) => {
  const chats = Array.from(chatRooms.values());
  
  res.json({
    success: true,
    chats: chats
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // User authentication
  socket.on('authenticate', (data) => {
    try {
      const { userId, userName, publicKey } = data;
      console.log('🔐 User authentication:', userId, userName);
      
      // Store user info
      socket.userId = userId;
      socket.userName = userName;
      socket.publicKey = publicKey;
      
      // Add to active users
      activeUsers.set(userId, {
        id: userId,
        name: userName,
        socketId: socket.id,
        status: 'online',
        joinedAt: new Date().toISOString()
      });
      
      // Join user room
      socket.join(`user:${userId}`);
      
      socket.emit('authenticated', { 
        success: true,
        userId: userId,
        activeUsers: activeUsers.size
      });
      
      // Notify others user is online
      socket.broadcast.emit('user_online', {
        userId: userId,
        userName: userName
      });
      
      console.log(`✅ User ${userName} (${userId}) authenticated. Active users: ${activeUsers.size}`);
      
    } catch (error) {
      console.error('❌ Authentication error:', error);
      socket.emit('auth_error', { error: 'Authentication failed' });
    }
  });

  // Join chat room
  socket.on('join_chat', (data) => {
    try {
      const { chatId } = data;
      const userId = socket.userId;
      
      if (!userId) {
        socket.emit('error', { error: 'Not authenticated' });
        return;
      }
      
      socket.join(`chat:${chatId}`);
      console.log(`👥 User ${userId} joined chat ${chatId}`);
      
      // Send chat history
      const history = messageHistory.get(chatId) || [];
      socket.emit('chat_history', {
        chatId: chatId,
        messages: history.slice(-50) // Last 50 messages
      });
      
      // Notify others in chat
      socket.to(`chat:${chatId}`).emit('user_joined_chat', {
        chatId: chatId,
        userId: userId,
        userName: socket.userName
      });
      
    } catch (error) {
      console.error('❌ Join chat error:', error);
      socket.emit('error', { error: 'Failed to join chat' });
    }
  });

  // Send message
  socket.on('send_message', (data) => {
    try {
      const { chatId, content, type = 'text', tempId } = data;
      const userId = socket.userId;
      
      if (!userId) {
        socket.emit('error', { error: 'Not authenticated' });
        return;
      }
      
      const messageId = crypto.randomUUID();
      const message = {
        id: messageId,
        chatId: chatId,
        senderId: userId,
        senderName: socket.userName,
        content: content,
        type: type,
        timestamp: new Date().toISOString(),
        status: 'delivered'
      };
      
      // Save to history
      if (!messageHistory.has(chatId)) {
        messageHistory.set(chatId, []);
      }
      messageHistory.get(chatId).push(message);
      
      // Send to all users in chat
      io.to(`chat:${chatId}`).emit('new_message', {
        ...message,
        tempId: tempId
      });
      
      // Send delivery confirmation to sender
      socket.emit('message_sent', {
        tempId: tempId,
        messageId: messageId,
        timestamp: message.timestamp
      });
      
      console.log(`💬 Message sent by ${socket.userName} to chat ${chatId}: ${content.substring(0, 50)}...`);
      
    } catch (error) {
      console.error('❌ Send message error:', error);
      socket.emit('message_error', { 
        error: 'Failed to send message',
        tempId: data.tempId 
      });
    }
  });

  // Typing indicators
  socket.on('typing', (data) => {
    const { chatId, isTyping } = data;
    const userId = socket.userId;
    
    if (!userId) return;
    
    socket.to(`chat:${chatId}`).emit('user_typing', {
      chatId: chatId,
      userId: userId,
      userName: socket.userName,
      isTyping: isTyping
    });
  });

  // WebRTC signaling for calls
  socket.on('call_offer', (data) => {
    const { targetUserId, offer, callType } = data;
    const callerId = socket.userId;
    
    console.log(`📞 Call offer from ${callerId} to ${targetUserId}`);
    
    socket.to(`user:${targetUserId}`).emit('incoming_call', {
      callerId: callerId,
      callerName: socket.userName,
      offer: offer,
      callType: callType
    });
  });

  socket.on('call_answer', (data) => {
    const { callerId, answer } = data;
    
    socket.to(`user:${callerId}`).emit('call_answered', {
      answer: answer
    });
  });

  socket.on('call_ice_candidate', (data) => {
    const { targetUserId, candidate } = data;
    
    socket.to(`user:${targetUserId}`).emit('ice_candidate', {
      candidate: candidate
    });
  });

  socket.on('call_end', (data) => {
    const { targetUserId } = data;
    
    socket.to(`user:${targetUserId}`).emit('call_ended', {});
  });

  // Heartbeat/ping for connection health
  socket.on('ping', (data) => {
    socket.emit('pong', { 
      timestamp: Date.now(),
      received: data?.timestamp 
    });
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log('🔌 Client disconnected:', socket.id, 'Reason:', reason);
    
    if (socket.userId) {
      // Remove from active users
      activeUsers.delete(socket.userId);
      
      // Notify others user is offline
      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
        userName: socket.userName
      });
      
      console.log(`👋 User ${socket.userName} (${socket.userId}) disconnected. Active users: ${activeUsers.size}`);
    }
  });
});

// Error handling
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;
  switch (error.code) {
    case 'EACCES':
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Start server
server.listen(PORT, () => {
  console.log('🚀 CYPHR MESSENGER ENTERPRISE SERVER STARTED');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔐 Post-quantum encryption: Kyber1024 + ChaCha20`);
  console.log(`🔌 Socket.IO real-time messaging: ENABLED`);
  console.log(`🌐 Production URL: https://app.cyphrmessenger.app`);
  console.log(`💼 Enterprise Features: ACTIVE`);
  console.log('=' * 60);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('💤 Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('💤 Process terminated');
  });
});

module.exports = { app, server, io };