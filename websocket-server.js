/**
 * Simple WebSocket Server for Cyphr Messenger
 * Handles real-time messaging with basic encryption support
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);

// Configure CORS for Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());

// Store active users and their sockets
const activeUsers = new Map();
const userSockets = new Map();

// Store recent messages for each chat (in-memory for demo)
const chatMessages = new Map();

io.on('connection', (socket) => {
  console.log('🔗 New socket connection:', socket.id);

  // Handle user authentication
  socket.on('authenticate', (userData) => {
    try {
      const { userId, publicKey } = userData;
      
      if (!userId) {
        socket.emit('auth_error', { message: 'User ID required' });
        return;
      }

      // Store user data
      activeUsers.set(userId, {
        socketId: socket.id,
        publicKey,
        online: true,
        lastSeen: Date.now()
      });
      
      userSockets.set(socket.id, userId);
      
      console.log(`✅ User authenticated: ${userId}`);
      socket.emit('authenticated', { userId, status: 'online' });
      
      // Notify other users that this user is online
      socket.broadcast.emit('user_online', { userId });
      
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
    }
  });

  // Handle sending messages
  socket.on('send_message', async (data) => {
    try {
      const { chatId, message, tempId } = data;
      const senderId = userSockets.get(socket.id);
      
      if (!senderId) {
        socket.emit('message_error', { tempId, error: 'Not authenticated' });
        return;
      }

      // Create message object
      const messageObj = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        chat_id: chatId,
        sender_id: senderId,
        content: message.content,
        type: message.type || 'text',
        metadata: message.metadata || {},
        created_at: new Date().toISOString(),
        status: 'sent'
      };

      // Store message in chat history
      if (!chatMessages.has(chatId)) {
        chatMessages.set(chatId, []);
      }
      chatMessages.get(chatId).push(messageObj);

      // Send confirmation to sender
      socket.emit('message_sent', {
        tempId,
        message: messageObj
      });

      // Send message to other participants in the chat
      // For now, broadcast to all connected users (in production, filter by chat participants)
      socket.broadcast.emit('new_message', messageObj);

      console.log(`📨 Message sent in chat ${chatId} by ${senderId}`);

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('message_error', {
        tempId: data.tempId,
        error: error.message
      });
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const { chatId, isTyping } = data;
    const userId = userSockets.get(socket.id);
    
    if (userId) {
      socket.broadcast.emit('user_typing', {
        userId,
        chatId,
        isTyping
      });
    }
  });

  // Handle message delivery/read status
  socket.on('message_delivered', (data) => {
    const { messageId } = data;
    socket.broadcast.emit('message_status', {
      messageId,
      status: 'delivered'
    });
  });

  socket.on('message_read', (data) => {
    const { messageId } = data;
    socket.broadcast.emit('message_status', {
      messageId,
      status: 'read'
    });
  });

  // Handle voice/video calls
  socket.on('call_offer', (data) => {
    const { targetUserId, offer, callType } = data;
    const callerId = userSockets.get(socket.id);
    
    const targetUser = activeUsers.get(targetUserId);
    if (targetUser) {
      io.to(targetUser.socketId).emit('incoming_call', {
        callerId,
        offer,
        callType,
        callId: `call_${Date.now()}`
      });
    }
  });

  socket.on('call_answer', (data) => {
    const { callId, answer } = data;
    socket.broadcast.emit('call_answered', { callId, answer });
  });

  socket.on('call_end', (data) => {
    const { callId } = data;
    socket.broadcast.emit('call_ended', { callId });
  });

  socket.on('call_ice_candidate', (data) => {
    const { targetUserId, candidate } = data;
    const targetUser = activeUsers.get(targetUserId);
    if (targetUser) {
      io.to(targetUser.socketId).emit('ice_candidate', { candidate });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const userId = userSockets.get(socket.id);
    
    if (userId) {
      console.log(`👋 User disconnected: ${userId}`);
      
      // Update user status
      const userData = activeUsers.get(userId);
      if (userData) {
        userData.online = false;
        userData.lastSeen = Date.now();
      }
      
      // Notify other users
      socket.broadcast.emit('user_offline', { userId });
      
      // Clean up
      userSockets.delete(socket.id);
      // Keep user data for last seen info
      // activeUsers.delete(userId);
    }
    
    console.log('🔌 Socket disconnected:', socket.id);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// REST API endpoints for testing
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeUsers: activeUsers.size,
    totalChats: chatMessages.size
  });
});

app.get('/api/messages/:chatId', (req, res) => {
  const { chatId } = req.params;
  const messages = chatMessages.get(chatId) || [];
  res.json({
    chatId,
    messages: messages.slice(-50) // Return last 50 messages
  });
});

app.get('/api/users/online', (req, res) => {
  const onlineUsers = Array.from(activeUsers.entries())
    .filter(([_, userData]) => userData.online)
    .map(([userId, userData]) => ({
      userId,
      lastSeen: userData.lastSeen
    }));
  
  res.json({ onlineUsers });
});

const PORT = process.env.WS_PORT || process.env.PORT || 3002;

server.listen(PORT, () => {
  console.log(`🚀 Cyphr WebSocket Server running on port ${PORT}`);
  console.log(`📡 Socket.IO endpoint: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
});