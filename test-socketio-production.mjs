#!/usr/bin/env node

// Test Socket.IO connection to production
import { io } from 'socket.io-client';

console.log('🧪 TESTING SOCKET.IO CONNECTION TO PRODUCTION...\n');

const serverUrl = 'https://app.cyphrmessenger.app';

const socket = io(serverUrl, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  timeout: 10000,
  autoConnect: true
});

socket.on('connect', () => {
  console.log('✅ Socket connected successfully!');
  console.log('📡 Socket ID:', socket.id);
  
  // Test guest authentication
  console.log('🔐 Testing guest authentication...');
  socket.emit('authenticate', { 
    userId: 'guest', 
    publicKey: null 
  });
});

socket.on('authenticated', (data) => {
  console.log('🎉 Socket authenticated successfully!', data);
  
  // Test heartbeat
  console.log('💓 Testing heartbeat...');
  socket.emit('ping', { timestamp: Date.now() });
});

socket.on('pong', (data) => {
  console.log('🏓 Pong received:', data);
  console.log('✅ Heartbeat working correctly!');
  
  // Test complete - disconnect
  setTimeout(() => {
    console.log('🔌 Disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 1000);
});

socket.on('auth_error', (error) => {
  console.error('❌ Authentication error:', error);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

// Timeout if no response
setTimeout(() => {
  console.error('⏰ Test timed out - no response from server');
  process.exit(1);
}, 15000);