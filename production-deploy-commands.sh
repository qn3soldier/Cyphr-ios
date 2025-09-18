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
