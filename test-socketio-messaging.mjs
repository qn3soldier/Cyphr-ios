#!/usr/bin/env node

/**
 * 🔄 COMPREHENSIVE SOCKET.IO MESSAGING TEST
 * Тестирует полную функциональность real-time messaging
 */

import { io } from 'socket.io-client';
import fetch from 'node-fetch';

const SERVER_URL = 'https://app.cyphrmessenger.app';

class SocketIOMessagingTester {
  constructor() {
    this.socket1 = null; // Alice
    this.socket2 = null; // Bob
    this.results = [];
    this.testChatId = null;
    
    this.alice = {
      userId: 'alice-' + Date.now(),
      userName: 'Alice Quantum',
      publicKey: 'alice-pubkey-' + Date.now()
    };
    
    this.bob = {
      userId: 'bob-' + Date.now(),
      userName: 'Bob Crypto',
      publicKey: 'bob-pubkey-' + Date.now()
    };
  }

  async log(step, status, details = '') {
    const timestamp = new Date().toISOString();
    const result = { step, status, details, timestamp };
    this.results.push(result);
    
    const emoji = status === 'SUCCESS' ? '✅' : status === 'FAIL' ? '❌' : '🔄';
    console.log(`${emoji} [${timestamp}] ${step}: ${status}`);
    if (details) console.log(`   └─ ${details}`);
  }

  async testSocketIOConnection() {
    try {
      await this.log('Socket.IO Connection', 'IN_PROGRESS', 'Connecting Alice and Bob');
      
      return new Promise((resolve) => {
        let aliceConnected = false;
        let bobConnected = false;
        
        // Connect Alice
        this.socket1 = io(SERVER_URL, {
          transports: ['websocket', 'polling']
        });
        
        this.socket1.on('connect', async () => {
          aliceConnected = true;
          await this.log('Alice Connection', 'SUCCESS', `Socket ID: ${this.socket1.id}`);
          
          if (bobConnected) {
            resolve(true);
          }
        });
        
        this.socket1.on('connect_error', async (error) => {
          await this.log('Alice Connection', 'FAIL', error.message);
          resolve(false);
        });
        
        // Connect Bob
        setTimeout(() => {
          this.socket2 = io(SERVER_URL, {
            transports: ['websocket', 'polling']
          });
          
          this.socket2.on('connect', async () => {
            bobConnected = true;
            await this.log('Bob Connection', 'SUCCESS', `Socket ID: ${this.socket2.id}`);
            
            if (aliceConnected) {
              resolve(true);
            }
          });
          
          this.socket2.on('connect_error', async (error) => {
            await this.log('Bob Connection', 'FAIL', error.message);
            resolve(false);
          });
        }, 1000);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          if (!aliceConnected || !bobConnected) {
            this.log('Socket.IO Connection', 'FAIL', 'Connection timeout');
            resolve(false);
          }
        }, 10000);
      });
      
    } catch (error) {
      await this.log('Socket.IO Connection', 'FAIL', error.message);
      return false;
    }
  }

  async testUserAuthentication() {
    try {
      await this.log('User Authentication', 'IN_PROGRESS', 'Authenticating Alice and Bob');
      
      return new Promise((resolve) => {
        let aliceAuth = false;
        let bobAuth = false;
        
        // Authenticate Alice
        this.socket1.emit('authenticate', this.alice);
        
        this.socket1.on('authenticated', async (data) => {
          if (data.success) {
            aliceAuth = true;
            await this.log('Alice Authentication', 'SUCCESS', `User ID: ${this.alice.userId}`);
            
            if (bobAuth) {
              resolve(true);
            }
          } else {
            await this.log('Alice Authentication', 'FAIL', 'Authentication failed');
            resolve(false);
          }
        });
        
        this.socket1.on('auth_error', async (error) => {
          await this.log('Alice Authentication', 'FAIL', error.error);
          resolve(false);
        });
        
        // Authenticate Bob
        setTimeout(() => {
          this.socket2.emit('authenticate', this.bob);
          
          this.socket2.on('authenticated', async (data) => {
            if (data.success) {
              bobAuth = true;
              await this.log('Bob Authentication', 'SUCCESS', `User ID: ${this.bob.userId}`);
              
              if (aliceAuth) {
                resolve(true);
              }
            } else {
              await this.log('Bob Authentication', 'FAIL', 'Authentication failed');
              resolve(false);
            }
          });
          
          this.socket2.on('auth_error', async (error) => {
            await this.log('Bob Authentication', 'FAIL', error.error);
            resolve(false);
          });
        }, 1000);
        
        // Timeout
        setTimeout(() => {
          if (!aliceAuth || !bobAuth) {
            this.log('User Authentication', 'FAIL', 'Authentication timeout');
            resolve(false);
          }
        }, 10000);
      });
      
    } catch (error) {
      await this.log('User Authentication', 'FAIL', error.message);
      return false;
    }
  }

  async testChatCreation() {
    try {
      await this.log('Chat Creation', 'IN_PROGRESS', 'Creating test chat room');
      
      // Create chat via API
      const response = await fetch(`${SERVER_URL}/api/chats/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participants: [this.alice.userId, this.bob.userId],
          name: 'Test Chat Room'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        this.testChatId = data.chat.id;
        await this.log('Chat Creation', 'SUCCESS', `Chat ID: ${this.testChatId}`);
        return true;
      } else {
        await this.log('Chat Creation', 'FAIL', `HTTP ${response.status}`);
        return false;
      }
      
    } catch (error) {
      await this.log('Chat Creation', 'FAIL', error.message);
      return false;
    }
  }

  async testJoinChat() {
    try {
      await this.log('Join Chat', 'IN_PROGRESS', 'Alice and Bob joining chat');
      
      return new Promise((resolve) => {
        let aliceJoined = false;
        let bobJoined = false;
        
        // Alice joins chat
        this.socket1.emit('join_chat', { chatId: this.testChatId });
        
        this.socket1.on('chat_history', async (data) => {
          if (data.chatId === this.testChatId) {
            aliceJoined = true;
            await this.log('Alice Join Chat', 'SUCCESS', `History: ${data.messages.length} messages`);
            
            if (bobJoined) {
              resolve(true);
            }
          }
        });
        
        // Bob joins chat
        setTimeout(() => {
          this.socket2.emit('join_chat', { chatId: this.testChatId });
          
          this.socket2.on('chat_history', async (data) => {
            if (data.chatId === this.testChatId) {
              bobJoined = true;
              await this.log('Bob Join Chat', 'SUCCESS', `History: ${data.messages.length} messages`);
              
              if (aliceJoined) {
                resolve(true);
              }
            }
          });
        }, 1000);
        
        // Error handlers
        this.socket1.on('error', async (error) => {
          await this.log('Alice Join Chat', 'FAIL', error.error);
          resolve(false);
        });
        
        this.socket2.on('error', async (error) => {
          await this.log('Bob Join Chat', 'FAIL', error.error);
          resolve(false);
        });
        
        // Timeout
        setTimeout(() => {
          if (!aliceJoined || !bobJoined) {
            this.log('Join Chat', 'FAIL', 'Join timeout');
            resolve(false);
          }
        }, 10000);
      });
      
    } catch (error) {
      await this.log('Join Chat', 'FAIL', error.message);
      return false;
    }
  }

  async testRealTimeMessaging() {
    try {
      await this.log('Real-time Messaging', 'IN_PROGRESS', 'Testing message delivery');
      
      return new Promise((resolve) => {
        let messageReceived = false;
        const testMessage = `Hello from Alice! ${Date.now()}`;
        const tempId = 'temp-' + Date.now();
        
        // Bob listens for Alice's message
        this.socket2.on('new_message', async (message) => {
          if (message.content === testMessage && message.senderId === this.alice.userId) {
            messageReceived = true;
            await this.log('Message Delivery', 'SUCCESS', 
              `From: ${message.senderName}, Content: ${message.content.substring(0, 30)}...`);
            resolve(true);
          }
        });
        
        // Alice listens for delivery confirmation
        this.socket1.on('message_sent', async (data) => {
          if (data.tempId === tempId) {
            await this.log('Message Confirmation', 'SUCCESS', 
              `Message ID: ${data.messageId}, TempID: ${data.tempId}`);
          }
        });
        
        // Alice sends message
        setTimeout(() => {
          this.socket1.emit('send_message', {
            chatId: this.testChatId,
            content: testMessage,
            type: 'text',
            tempId: tempId
          });
        }, 1000);
        
        // Error handler
        this.socket1.on('message_error', async (error) => {
          await this.log('Real-time Messaging', 'FAIL', error.error);
          resolve(false);
        });
        
        // Timeout
        setTimeout(() => {
          if (!messageReceived) {
            this.log('Real-time Messaging', 'FAIL', 'Message delivery timeout');
            resolve(false);
          }
        }, 10000);
      });
      
    } catch (error) {
      await this.log('Real-time Messaging', 'FAIL', error.message);
      return false;
    }
  }

  async testTypingIndicators() {
    try {
      await this.log('Typing Indicators', 'IN_PROGRESS', 'Testing typing notifications');
      
      return new Promise((resolve) => {
        let typingReceived = false;
        
        // Bob listens for Alice's typing
        this.socket2.on('user_typing', async (data) => {
          if (data.userId === this.alice.userId && data.isTyping === true) {
            typingReceived = true;
            await this.log('Typing Indicators', 'SUCCESS', 
              `${data.userName} is typing in chat ${data.chatId}`);
            resolve(true);
          }
        });
        
        // Alice starts typing
        setTimeout(() => {
          this.socket1.emit('typing', {
            chatId: this.testChatId,
            isTyping: true
          });
        }, 1000);
        
        // Timeout
        setTimeout(() => {
          if (!typingReceived) {
            this.log('Typing Indicators', 'FAIL', 'Typing notification timeout');
            resolve(false);
          }
        }, 5000);
      });
      
    } catch (error) {
      await this.log('Typing Indicators', 'FAIL', error.message);
      return false;
    }
  }

  async testAPIIntegration() {
    try {
      await this.log('API Integration', 'IN_PROGRESS', 'Testing HTTP + WebSocket integration');
      
      // Send message via API
      const response = await fetch(`${SERVER_URL}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: this.testChatId,
          content: 'Message via API',
          type: 'text'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        await this.log('API Message Send', 'SUCCESS', `Message ID: ${data.message.id}`);
        
        // Check message history
        const historyResponse = await fetch(
          `${SERVER_URL}/api/messages/history?chatId=${this.testChatId}`
        );
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          await this.log('Message History', 'SUCCESS', 
            `History: ${historyData.messages.length} messages`);
          return true;
        }
      }
      
      await this.log('API Integration', 'FAIL', 'API calls failed');
      return false;
      
    } catch (error) {
      await this.log('API Integration', 'FAIL', error.message);
      return false;
    }
  }

  async cleanup() {
    try {
      if (this.socket1) {
        this.socket1.disconnect();
      }
      if (this.socket2) {
        this.socket2.disconnect();
      }
      await this.log('Cleanup', 'SUCCESS', 'Connections closed');
    } catch (error) {
      await this.log('Cleanup', 'FAIL', error.message);
    }
  }

  async runCompleteTest() {
    console.log('🔄 COMPREHENSIVE SOCKET.IO MESSAGING TEST');
    console.log(`👤 Alice: ${this.alice.userId}`);
    console.log(`👤 Bob: ${this.bob.userId}`);
    console.log(`🔗 Server: ${SERVER_URL}`);
    console.log('=' * 70);
    
    const tests = [
      () => this.testSocketIOConnection(),
      () => this.testUserAuthentication(),
      () => this.testChatCreation(),
      () => this.testJoinChat(),
      () => this.testRealTimeMessaging(),
      () => this.testTypingIndicators(),
      () => this.testAPIIntegration(),
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
      try {
        const result = await test();
        if (result) passed++;
        else failed++;
      } catch (error) {
        failed++;
        await this.log('Test Execution', 'FAIL', error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    await this.cleanup();
    
    // Финальный отчет
    console.log('\n' + '=' * 70);
    console.log('🔄 SOCKET.IO MESSAGING TEST RESULTS');
    console.log('=' * 70);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    if (failed === 0) {
      console.log('\n🎉 REAL-TIME MESSAGING FULLY OPERATIONAL!');
      console.log('✅ Socket.IO connections working');
      console.log('✅ User authentication working');
      console.log('✅ Chat creation working');
      console.log('✅ Message delivery working');
      console.log('✅ Typing indicators working');
      console.log('✅ API integration working');
    } else if (passed > failed) {
      console.log('\n✅ REAL-TIME MESSAGING MOSTLY WORKING');
      console.log('⚠️  Minor issues found, see details above');
    } else {
      console.log('\n⚠️  REAL-TIME MESSAGING NEEDS ATTENTION');
      console.log('❌ Multiple issues found');
    }
    
    return { passed, failed, results: this.results };
  }
}

// Запуск полного тестирования
const tester = new SocketIOMessagingTester();
await tester.runCompleteTest();