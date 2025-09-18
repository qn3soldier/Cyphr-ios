#!/bin/bash

echo "🚀 DEPLOYING CYPHR MESSENGER TO PRODUCTION"
echo "=========================================="

SERVER_IP="18.207.49.24"
DOMAIN="app.cyphrmessenger.app"
BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

echo_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we can reach the server
echo_status "Checking server connectivity..."
if curl -m 10 -s http://$SERVER_IP >/dev/null; then
    echo_success "Server $SERVER_IP is reachable"
else
    echo_warning "Cannot reach server $SERVER_IP (will continue anyway)"
fi

# Create deployment package
echo_status "Creating deployment package..."
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='logs' \
    --exclude='screenshots' \
    --exclude='*.log' \
    -czf cyphr-deployment-$BACKUP_DATE.tar.gz \
    server.ts package.json .env ecosystem.config.production.js \
    src/ public/ dist/ deploy-production-https.sh monitoring-config.json

echo_success "Deployment package created: cyphr-deployment-$BACKUP_DATE.tar.gz"

# Simulate deployment commands (since we can't actually SSH)
echo_status "Generating production deployment commands..."

cat > production-deploy-commands.sh << 'EOF'
#!/bin/bash
# Production Deployment Commands for Cyphr Messenger
# Run these commands on the production server (18.207.49.24)

echo "🔄 Updating Cyphr Messenger on production server..."

# Stop existing services
pm2 stop all
sudo systemctl stop nginx

# Backup existing installation
cp -r /var/www/cyphr /var/www/cyphr-backup-$(date +%Y%m%d_%H%M%S)

# Extract new deployment
tar -xzf cyphr-deployment-*.tar.gz -C /var/www/cyphr/

# Install dependencies
cd /var/www/cyphr
npm install --production

# Update environment for production
export NODE_ENV=production
export PORT=3001
export HTTPS_PORT=3443

# Setup SSL certificates
sudo certbot certonly --standalone \
    -d app.cyphrmessenger.app \
    --non-interactive \
    --agree-tos \
    --email admin@cyphrmessenger.app || true

# Update Nginx configuration
sudo tee /etc/nginx/sites-available/cyphr << 'NGINX_CONF'
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name app.cyphrmessenger.app;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name app.cyphrmessenger.app;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/app.cyphrmessenger.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.cyphrmessenger.app/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend (React App)
    location / {
        root /var/www/cyphr/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001;
        access_log off;
    }
}
NGINX_CONF

# Enable site
sudo ln -sf /etc/nginx/sites-available/cyphr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# Start services with PM2
pm2 start ecosystem.config.production.js
pm2 save
pm2 startup

# Setup auto-renewal for SSL
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

echo "✅ Production deployment complete!"
echo "🌐 Site: https://app.cyphrmessenger.app"
echo "📊 Monitor: pm2 monit"
EOF

chmod +x production-deploy-commands.sh

# Test local services one more time
echo_status "Testing local services before deployment..."

# Test backend
if curl -f -s http://localhost:3001/health >/dev/null; then
    echo_success "Backend API is healthy"
else
    echo_warning "Backend API not responding (might be normal if not running)"
fi

# Test current production frontend
if curl -f -s http://$SERVER_IP >/dev/null; then
    echo_success "Production frontend is accessible"
else
    echo_warning "Production frontend not accessible"
fi

echo ""
echo_status "Deployment package ready!"
echo_success "Created: cyphr-deployment-$BACKUP_DATE.tar.gz"
echo_success "Commands: production-deploy-commands.sh"

echo ""
echo "📋 MANUAL DEPLOYMENT STEPS:"
echo "1. Upload cyphr-deployment-$BACKUP_DATE.tar.gz to server"
echo "2. Run: bash production-deploy-commands.sh on server"
echo "3. Verify: https://app.cyphrmessenger.app"

echo ""
echo "🔧 DNS SETUP REQUIRED:"
echo "Set A record: app.cyphrmessenger.app → $SERVER_IP"

echo ""
echo_success "Ready for production deployment! 🚀"