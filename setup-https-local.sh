#!/bin/bash

# HTTPS Setup Script for Local Development and Production
echo "🔐 Setting up HTTPS for Cyphr Messenger..."

# Check if running on macOS or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "📱 Detected macOS"
    CERT_DIR="$HOME/.cyphr-ssl"
else
    echo "🐧 Detected Linux"
    CERT_DIR="/etc/cyphr-ssl"
fi

# Create certificate directory
mkdir -p $CERT_DIR
cd $CERT_DIR

# Generate self-signed certificate for local development
echo "🔨 Generating self-signed certificate..."
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
    -subj "/C=US/ST=State/L=City/O=Cyphr/CN=localhost"

echo "✅ Certificate generated at: $CERT_DIR"

# Create HTTPS server configuration
cat > $HOME/cyphrmessenger/project/https-server.ts << 'EOF'
import 'dotenv/config';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import existing server
import('./server.js').then(module => {
  const app = module.default || module.app;
  
  // SSL Certificate paths
  const certDir = process.env.CERT_DIR || `${process.env.HOME}/.cyphr-ssl`;
  
  const httpsOptions = {
    key: fs.readFileSync(`${certDir}/key.pem`),
    cert: fs.readFileSync(`${certDir}/cert.pem`)
  };
  
  // Create HTTPS server
  const httpsServer = https.createServer(httpsOptions, app);
  
  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
  
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`🔒 HTTPS Server running on https://localhost:${HTTPS_PORT}`);
    console.log(`🔐 Post-quantum encryption: Kyber1024 + ChaCha20`);
    console.log(`✅ SSL/TLS enabled for production security`);
  });
});
EOF

echo "📝 Created HTTPS server configuration"

# Create production deployment script
cat > $HOME/cyphrmessenger/project/deploy-production-https.sh << 'EOF'
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
EOF

chmod +x $HOME/cyphrmessenger/project/deploy-production-https.sh

echo "
✅ HTTPS Setup Complete!

LOCAL DEVELOPMENT:
- Certificate: $CERT_DIR/cert.pem
- Private Key: $CERT_DIR/key.pem
- Run: npm run https-server

PRODUCTION:
- Run: ./deploy-production-https.sh
- Domain: https://app.cyphrmessenger.app

⚠️ IMPORTANT: Update DNS A record:
   app.cyphrmessenger.app → 18.207.49.24
"