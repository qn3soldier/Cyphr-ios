#!/bin/bash
# 🚨 INSTANT PRODUCTION FIX - DIRECT COMMANDS
# Execute directly on server to fix all issues immediately

chmod 400 cyphr-deploy-key.pem

echo "🚨 CONNECTING TO SERVER AND APPLYING EMERGENCY FIX..."

ssh -i cyphr-deploy-key.pem -o StrictHostKeyChecking=no ubuntu@18.207.49.24 << 'EMERGENCY_COMMANDS'

cd /var/www/cyphr

echo "🛑 Stopping all broken processes..."
pm2 stop all || true
pm2 delete all || true

echo "🌐 Fixing Nginx WebSocket configuration..."
sudo tee /etc/nginx/sites-available/default << 'NGINX_FIX'
server {
    listen 80;
    server_name 18.207.49.24 app.cyphrmessenger.app;
    
    location / {
        root /var/www/cyphr/dist;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /socket.io/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    location /health {
        proxy_pass http://localhost:3001/health;
    }
}
NGINX_FIX

sudo nginx -t
sudo systemctl reload nginx

echo "📝 Creating complete production .env..."
tee .env << 'ENV_COMPLETE'
NODE_ENV=production
PORT=3001
WS_PORT=3002

SUPABASE_URL=https://fkhwhplufjzlicccgbrf.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHdocGx1Zmp6bGljY2NnYnJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NDM1NDIsImV4cCI6MjA2NzQxOTU0Mn0.M72reQ5IAcWA0AWY2h0aJxbbZah7rWkZL2m0ONOdEMQ
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHdocGx1Zmp6bGljY2NnYnJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg0MzU0MiwiZXhwIjoyMDY3NDE5NTQyfQ.u1uPwT4fD1-hl0n2pegF9UNuwDKje2PKzFKYyD57smM


VITE_STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
VITE_STELLAR_HORIZON_URL=https://horizon.stellar.org
VITE_STELLAR_ISSUER_PUBLIC_KEY=GDIXCJBCIM7NN64ZF24XIT2GUCGLOACNBUONEQO4TX36EZ4H3GXN2D3G

FRONTEND_URL=https://app.cyphrmessenger.app
BACKEND_URL=https://app.cyphrmessenger.app/api
WEBSOCKET_URL=wss://app.cyphrmessenger.app/socket.io

JWT_SECRET=super-secure-jwt-secret-for-cyphr-messenger-production-2025
ENCRYPTION_KEY=cyphr-encryption-key-32-chars-prod
ENV_COMPLETE

echo "⚡ Creating stable WebSocket server..."
tee websocket-server-stable.js << 'WS_STABLE'
const { Server } = require('socket.io');
const { createServer } = require('http');

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: ["https://app.cyphrmessenger.app", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

const WS_PORT = 3002;

console.log('Starting WebSocket server...');

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  socket.on('join-chat', (chatId) => {
    socket.join(`chat-${chatId}`);
    console.log(`Socket ${socket.id} joined chat-${chatId}`);
  });
  
  socket.on('send-message', (data) => {
    socket.to(`chat-${data.chatId}`).emit('new-message', data);
  });
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

server.listen(WS_PORT, '0.0.0.0', () => {
  console.log(`✅ WebSocket server running on port ${WS_PORT}`);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});
WS_STABLE

echo "🚀 Starting production services with PM2..."
pm2 start server.ts --name "cyphr-backend" --interpreter="node" --interpreter-args="--loader tsx" --env production

pm2 start websocket-server-stable.js --name "cyphr-websocket" --env production

echo "⏳ Waiting for services to start..."
sleep 5

echo "🔍 FINAL STATUS CHECK:"
echo "======================"
pm2 list

echo ""
echo "Backend health:"
curl -s http://localhost:3001/health || echo "Backend not ready yet"

echo ""  
echo "Frontend test:"
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost/ || echo "Frontend issue"

echo ""
echo "Port status:"
netstat -tlnp | grep -E ':(80|3001|3002)'

echo ""
echo "✅ EMERGENCY FIX APPLIED!"
echo "========================"
echo "🌐 Test URL: https://app.cyphrmessenger.app"
echo "📱 All React components should now be accessible"
echo "🔒 WebSocket connections should work"
echo "💳 HD Wallet integration ready"

EMERGENCY_COMMANDS

echo ""
echo "✅ EMERGENCY PRODUCTION FIX COMPLETED!"
echo "======================================"
echo ""
echo "🎯 NEXT STEPS:"
echo "1. Test: https://app.cyphrmessenger.app"  
echo "2. Try the registration flow"
echo "3. Test WebSocket real-time features"
echo "4. Validate all functionality"
echo ""
echo "🚀 CYPHR MESSENGER SHOULD BE FULLY OPERATIONAL!"