#!/bin/bash

# Production HTTPS Deployment Script
echo "🚀 Deploying Cyphr Messenger to Production with HTTPS..."

DOMAIN="cyphrmessenger.app"
SERVER_IP="18.207.49.24"

# SSH into production server
ssh -t ec2-user@$SERVER_IP << 'ENDSSH'
    # Install certbot if not installed
    sudo yum install -y certbot python3-certbot-nginx

    # Stop nginx temporarily
    sudo systemctl stop nginx

    # Get SSL certificate from Let's Encrypt
    sudo certbot certonly --standalone \
        -d app.cyphrmessenger.app \
        --non-interactive \
        --agree-tos \
        --email admin@cyphrmessenger.app

    # Update nginx configuration for HTTPS
    sudo cat > /etc/nginx/sites-available/cyphr << 'NGINX'
server {
    listen 80;
    server_name app.cyphrmessenger.app;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.cyphrmessenger.app;

    ssl_certificate /etc/letsencrypt/live/app.cyphrmessenger.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.cyphrmessenger.app/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
NGINX

    # Restart nginx
    sudo systemctl restart nginx

    echo "✅ HTTPS configured successfully!"
ENDSSH
