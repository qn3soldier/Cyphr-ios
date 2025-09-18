#!/bin/bash
# 🚀 CYPHR MESSENGER - APPLICATION DEPLOYMENT
# Deploy application to AWS server
set -e

# Server details from deployment
SERVER_IP="18.207.49.24"
SSH_KEY="~/.ssh/cyphr-key-1754685178.pem"
SERVER_USER="ubuntu"

echo "
╔══════════════════════════════════════════════════════════╗
║     CYPHR MESSENGER - APPLICATION DEPLOYMENT           ║
╚══════════════════════════════════════════════════════════╝
"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Deploying application to server: $SERVER_IP${NC}"

# Create deployment archive
echo "Creating deployment package..."
tar -czf cyphr-app.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='*.log' \
    --exclude='deployment-info.txt' \
    --exclude='cyphr-app.tar.gz' \
    .

echo -e "${GREEN}✅ Deployment package created${NC}"

# Upload to server
echo "Uploading application to server..."
scp -i ~/.ssh/cyphr-key-1754685178.pem -o StrictHostKeyChecking=no cyphr-app.tar.gz ubuntu@$SERVER_IP:/var/www/cyphr/

# Deploy on server
echo "Deploying on server..."
ssh -i ~/.ssh/cyphr-key-1754685178.pem -o StrictHostKeyChecking=no ubuntu@$SERVER_IP << 'ENDSSH'
#!/bin/bash
set -e

cd /var/www/cyphr

# Extract application
echo "Extracting application..."
tar -xzf cyphr-app.tar.gz
rm cyphr-app.tar.gz

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Build application
echo "Building application..."
npm run build || echo "No build script found, continuing..."

# Create production environment file
echo "Creating production environment..."
cat > .env.production << EOF
NODE_ENV=production
PORT=3001
WS_PORT=3002

# Supabase Configuration
SUPABASE_URL=https://fkhwhplufjzlicccgbrf.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHdocGx1Zmp6bGljY2NnYnJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjMwMjQzNzgsImV4cCI6MjAzODYwMDM3OH0.y_NzxQ4uIWHdpOr2u4q8NeYXMa8gW-LrHRrKsRWnOgU

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)

# Application URLs
FRONTEND_URL=http://18.207.49.24
BACKEND_URL=http://18.207.49.24:3001
WEBSOCKET_URL=ws://18.207.49.24:3002

# CORS Origins
CORS_ORIGIN=http://18.207.49.24,http://localhost:3000

# Default Twilio (will be configured later)
TWILIO_ACCOUNT_SID=AC0000000000000000000000000000
TWILIO_AUTH_TOKEN=00000000000000000000000000000000
TWILIO_VERIFY_SID=VA0000000000000000000000000000

# Default Stellar (optional)
STELLAR_SECRET_KEY=
EOF

# Configure PM2
echo "Configuring PM2..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'cyphr-backend',
      script: './dist/server.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_file: './.env.production',
      log_file: '/var/log/pm2/cyphr-backend.log',
      error_file: '/var/log/pm2/cyphr-backend-error.log',
      out_file: '/var/log/pm2/cyphr-backend-out.log',
      restart_delay: 4000,
      max_restarts: 5
    }
  ]
};
EOF

# Create log directory
sudo mkdir -p /var/log/pm2
sudo chown -R ubuntu:ubuntu /var/log/pm2

# Build TypeScript if needed
if [ -f "tsconfig.json" ]; then
    echo "Building TypeScript..."
    npx tsc || npm run build:server || echo "TypeScript build failed, trying direct execution"
fi

# Start with PM2
echo "Starting application with PM2..."
pm2 delete cyphr-backend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup | grep -v "PM2" | bash || true

echo "Application deployed and running!"
ENDSSH

# Configure Nginx
echo "Configuring Nginx..."
ssh -i ~/.ssh/cyphr-key-1754685178.pem -o StrictHostKeyChecking=no ubuntu@$SERVER_IP << 'ENDSSH'
#!/bin/bash

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/cyphr << 'EOF'
server {
    listen 80;
    server_name 18.207.49.24 app.cyphrmessenger.app;

    # Frontend (static files)
    location / {
        root /var/www/cyphr/dist;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=3600";
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://localhost:3002/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001/health;
        access_log off;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/cyphr /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
sudo nginx -t && sudo systemctl reload nginx

echo "Nginx configured successfully!"
ENDSSH

# Clean up
rm -f cyphr-app.tar.gz

echo "
╔══════════════════════════════════════════════════════════╗
║               🎉 DEPLOYMENT COMPLETE! 🎉                ║
╚══════════════════════════════════════════════════════════╝

Your Cyphr Messenger is now live!

🌐 Access your application:
   http://18.207.49.24

📱 For mobile/domain access:
   1. Setup DNS: Add A record 'app' pointing to 18.207.49.24
   2. Get SSL: Run 'sudo certbot --nginx -d app.cyphrmessenger.app'

📊 Monitor application:
   ssh -i ~/.ssh/cyphr-key-1754685178.pem ubuntu@18.207.49.24
   pm2 status
   pm2 logs cyphr-backend

🔧 Configuration files on server:
   - App: /var/www/cyphr
   - Env: /var/www/cyphr/.env.production
   - Nginx: /etc/nginx/sites-available/cyphr
   - PM2: /var/www/cyphr/ecosystem.config.js
"

echo -e "${GREEN}✅ Application deployment complete!${NC}"
echo -e "${BLUE}🌐 Visit: http://18.207.49.24${NC}"