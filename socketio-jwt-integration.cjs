// Socket.IO JWT Authentication Integration for Cyphr Messenger
const { authenticateSocketJWT } = require('./jwt-auth-middleware.cjs');

// Enhance Socket.IO with JWT authentication
function integrateSocketIOJWT(io, redis) {
  
  // JWT Authentication middleware for Socket.IO
  io.use(authenticateSocketJWT);

  // Enhanced connection handler with JWT
  io.on('connection', (socket) => {
    console.log(`✅ User ${socket.userId} connected with JWT authentication`);
    
    // Join user to their personal room
    socket.join(`user:${socket.userId}`);
    
    // Store connection in Redis for horizontal scaling
    if (redis) {
      redis.hset('cyphr:connections', socket.userId, JSON.stringify({
        socketId: socket.id,
        connectedAt: Date.now(),
        userAgent: socket.handshake.headers['user-agent']
      })).catch(err => console.error('❌ Redis connection storage error:', err));
    }

    // Update user status to online
    socket.user && updateUserStatus(socket.userId, 'online');

    // Handle authenticated messaging
    socket.on('send_message', async (messageData) => {
      try {
        if (!socket.userId) {
          socket.emit('error', { message: 'Authentication required' });
          return;
        }

        // Message validation
        const { recipientId, encryptedContent, messageType = 'text' } = messageData;
        
        if (!recipientId || !encryptedContent) {
          socket.emit('error', { message: 'Recipient and content required' });
          return;
        }

        // Create message with sender authentication
        const message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          senderId: socket.userId,
          recipientId,
          encryptedContent,
          messageType,
          timestamp: new Date().toISOString(),
          status: 'sent'
        };

        // Store message in Redis for persistence
        if (redis) {
          await redis.lpush(`cyphr:messages:${recipientId}`, JSON.stringify(message));
          await redis.expire(`cyphr:messages:${recipientId}`, 30 * 24 * 3600); // 30 days
        }

        // Send to recipient if online
        socket.to(`user:${recipientId}`).emit('new_message', message);
        
        // Confirm delivery to sender
        socket.emit('message_sent', { 
          messageId: message.id, 
          status: 'delivered',
          timestamp: message.timestamp
        });

        console.log(`📨 Message sent from ${socket.userId} to ${recipientId}`);

      } catch (error) {
        console.error('❌ Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators with authentication
    socket.on('typing_start', (data) => {
      if (!socket.userId || !data.recipientId) return;
      
      socket.to(`user:${data.recipientId}`).emit('user_typing', {
        userId: socket.userId,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data) => {
      if (!socket.userId || !data.recipientId) return;
      
      socket.to(`user:${data.recipientId}`).emit('user_typing', {
        userId: socket.userId,
        isTyping: false
      });
    });

    // Handle WebRTC signaling with authentication
    socket.on('call_initiate', (data) => {
      if (!socket.userId || !data.recipientId) return;
      
      socket.to(`user:${data.recipientId}`).emit('incoming_call', {
        callerId: socket.userId,
        callerName: socket.user.fullName,
        callType: data.callType || 'voice',
        offer: data.offer
      });
    });

    socket.on('call_answer', (data) => {
      if (!socket.userId || !data.callerId) return;
      
      socket.to(`user:${data.callerId}`).emit('call_answered', {
        answer: data.answer,
        recipientId: socket.userId
      });
    });

    socket.on('call_end', (data) => {
      if (!socket.userId || !data.recipientId) return;
      
      socket.to(`user:${data.recipientId}`).emit('call_ended', {
        endedBy: socket.userId
      });
    });

    // Handle ICE candidates for WebRTC
    socket.on('ice_candidate', (data) => {
      if (!socket.userId || !data.recipientId) return;
      
      socket.to(`user:${data.recipientId}`).emit('ice_candidate', {
        candidate: data.candidate,
        from: socket.userId
      });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`❌ User ${socket.userId} disconnected`);
      
      // Remove connection from Redis
      if (redis) {
        await redis.hdel('cyphr:connections', socket.userId);
      }
      
      // Update status to offline (with delay for reconnections)
      setTimeout(() => {
        updateUserStatus(socket.userId, 'offline');
      }, 30000); // 30 second grace period
    });
  });

  // Helper function to update user status
  async function updateUserStatus(userId, status) {
    try {
      // Update in database (you'll need to pass supabase reference)
      console.log(`📊 User ${userId} status: ${status}`);
      
      // Could also broadcast status to contacts
      io.to(`user:${userId}`).emit('status_update', { 
        userId, 
        status, 
        timestamp: new Date().toISOString() 
      });
      
    } catch (error) {
      console.error('❌ Status update error:', error);
    }
  }

  console.log('✅ Socket.IO enhanced with JWT authentication');
}

module.exports = { integrateSocketIOJWT };