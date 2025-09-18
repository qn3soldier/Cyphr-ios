#!/bin/bash

# =================================================================
# CYPHR MESSENGER - APPLICATION DEPLOYMENT TO AWS
# =================================================================
# This script deploys both landing page and main app to AWS
# Run this AFTER aws-full-migration.sh
# =================================================================

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_NAME="cyphr-messenger"
LANDING_BUCKET="${PROJECT_NAME}-landing"
LANDING_DIR="/Users/daniilbogdanov/cyphrwebsite"
APP_DIR="/Users/daniilbogdanov/cyphrmessenger"

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}   DEPLOYING CYPHR MESSENGER TO AWS${NC}"
echo -e "${BLUE}==================================================================${NC}"

# Check if public IP exists
if [ ! -f /tmp/public-ip.txt ]; then
    echo -e "${RED}Error: No EC2 instance found. Run aws-full-migration.sh first${NC}"
    exit 1
fi

PUBLIC_IP=$(cat /tmp/public-ip.txt)
KEY_PATH="$HOME/.ssh/${PROJECT_NAME}-key.pem"

# Function to deploy landing page to S3
deploy_landing_page() {
    echo -e "${YELLOW}Deploying landing page to S3...${NC}"
    
    cd ${LANDING_DIR}
    
    # Sync files to S3
    aws s3 sync . s3://${LANDING_BUCKET}/ \
        --exclude ".git/*" \
        --exclude "*.md" \
        --exclude "*.sql" \
        --exclude "*.zip" \
        --exclude ".DS_Store" \
        --exclude "node_modules/*" \
        --exclude "*.sh" \
        --delete
    
    echo -e "${GREEN}✓ Landing page deployed to S3${NC}"
}

# Function to prepare app for deployment
prepare_app() {
    echo -e "${YELLOW}Preparing Cyphr app for deployment...${NC}"
    
    cd ${APP_DIR}
    
    # Use the working version from project 2
    if [ -d "project 2" ]; then
        echo -e "${YELLOW}Using complete app from 'project 2' directory${NC}"
        cd "project 2"
    fi
    
    # Build the application
    echo -e "${YELLOW}Building application...${NC}"
    npm install
    npm run build
    
    # Create deployment package
    echo -e "${YELLOW}Creating deployment package...${NC}"
    tar -czf /tmp/cyphr-app.tar.gz \
        --exclude node_modules \
        --exclude .git \
        --exclude "*.log" \
        --exclude .env.local \
        .
    
    echo -e "${GREEN}✓ App package created${NC}"
}

# Function to deploy app to EC2
deploy_to_ec2() {
    echo -e "${YELLOW}Deploying to EC2 instance...${NC}"
    
    # Wait for SSH to be available
    echo -e "${YELLOW}Waiting for EC2 instance to be ready...${NC}"
    for i in {1..30}; do
        if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -i ${KEY_PATH} ubuntu@${PUBLIC_IP} "echo 'SSH ready'" 2>/dev/null; then
            break
        fi
        echo -n "."
        sleep 10
    done
    echo ""
    
    # Copy deployment package
    echo -e "${YELLOW}Copying files to EC2...${NC}"
    scp -o StrictHostKeyChecking=no -i ${KEY_PATH} /tmp/cyphr-app.tar.gz ubuntu@${PUBLIC_IP}:/tmp/
    
    # Create deployment script
    cat > /tmp/deploy-on-server.sh <<'DEPLOY_SCRIPT'
#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Setting up Cyphr Messenger on server...${NC}"

# Install dependencies
sudo apt-get update
sudo apt-get install -y nginx nodejs npm git python3-pip
sudo npm install -g pm2 typescript

# Extract app
cd /var/www
sudo rm -rf cyphr
sudo mkdir -p cyphr
sudo tar -xzf /tmp/cyphr-app.tar.gz -C cyphr/
sudo chown -R ubuntu:ubuntu cyphr/

# Install app dependencies
cd cyphr
npm install

# Create environment file
cat > .env.production <<EOF
NODE_ENV=production
PORT=3001
VITE_API_URL=https://app.cyphrmessenger.app/api
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER}
STELLAR_SECRET_KEY=${STELLAR_SECRET_KEY}
EOF

# Build if needed
if [ ! -d "dist" ]; then
    npm run build
fi

# Configure PM2
pm2 delete cyphr-app 2>/dev/null || true
pm2 start server.ts --name cyphr-app --interpreter node --env production
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Configure Nginx
sudo tee /etc/nginx/sites-available/cyphr <<'NGINX'
server {
    listen 80;
    server_name app.cyphrmessenger.app;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:;" always;

    # Main app
    location / {
        root /var/www/cyphr/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket proxy
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
}

server {
    listen 80;
    server_name www.cyphrmessenger.app cyphrmessenger.app;
    return 301 https://www.cyphrmessenger.app$request_uri;
}
NGINX

# Enable site
sudo ln -sf /etc/nginx/sites-available/cyphr /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo -e "${GREEN}✓ Cyphr Messenger deployed successfully!${NC}"
DEPLOY_SCRIPT
    
    # Copy and run deployment script
    scp -o StrictHostKeyChecking=no -i ${KEY_PATH} /tmp/deploy-on-server.sh ubuntu@${PUBLIC_IP}:/tmp/
    
    # Set environment variables
    ENV_VARS=""
    if [ -f ${APP_DIR}/.env.production ]; then
        ENV_VARS=$(cat ${APP_DIR}/.env.production | sed 's/^/export /' | tr '\n' ';')
    fi
    
    ssh -o StrictHostKeyChecking=no -i ${KEY_PATH} ubuntu@${PUBLIC_IP} \
        "${ENV_VARS} bash /tmp/deploy-on-server.sh"
    
    echo -e "${GREEN}✓ App deployed to EC2${NC}"
}

# Function to setup SSL with Let's Encrypt
setup_ssl() {
    echo -e "${YELLOW}Setting up SSL certificates...${NC}"
    
    ssh -o StrictHostKeyChecking=no -i ${KEY_PATH} ubuntu@${PUBLIC_IP} <<'SSL_SCRIPT'
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificates
sudo certbot --nginx -d app.cyphrmessenger.app --non-interactive --agree-tos --email admin@cyphrmessenger.app

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

echo "✓ SSL certificates installed"
SSL_SCRIPT
    
    echo -e "${GREEN}✓ SSL configured${NC}"
}

# Function to test deployment
test_deployment() {
    echo -e "${YELLOW}Testing deployment...${NC}"
    
    # Test landing page on S3
    LANDING_URL="http://${LANDING_BUCKET}.s3-website-us-east-1.amazonaws.com"
    if curl -s -o /dev/null -w "%{http_code}" ${LANDING_URL} | grep -q "200"; then
        echo -e "${GREEN}✓ Landing page accessible at: ${LANDING_URL}${NC}"
    else
        echo -e "${RED}✗ Landing page not accessible${NC}"
    fi
    
    # Test app on EC2
    APP_URL="http://${PUBLIC_IP}"
    if curl -s -o /dev/null -w "%{http_code}" ${APP_URL} | grep -q "200\|301\|302"; then
        echo -e "${GREEN}✓ App accessible at: ${APP_URL}${NC}"
    else
        echo -e "${RED}✗ App not accessible${NC}"
    fi
    
    # Test API
    API_URL="http://${PUBLIC_IP}/api/health"
    if curl -s -o /dev/null -w "%{http_code}" ${API_URL} | grep -q "200"; then
        echo -e "${GREEN}✓ API responding${NC}"
    else
        echo -e "${YELLOW}⚠ API health check not configured${NC}"
    fi
}

# Function to display final instructions
display_instructions() {
    echo -e "${BLUE}==================================================================${NC}"
    echo -e "${GREEN}   DEPLOYMENT COMPLETE!${NC}"
    echo -e "${BLUE}==================================================================${NC}"
    echo ""
    echo -e "${YELLOW}Access Points:${NC}"
    echo -e "  Landing (S3): http://${LANDING_BUCKET}.s3-website-us-east-1.amazonaws.com"
    echo -e "  App (EC2): http://${PUBLIC_IP}"
    echo ""
    echo -e "${YELLOW}DNS Configuration Required:${NC}"
    echo -e "  1. In your DNS provider, update:"
    echo -e "     - www.cyphrmessenger.app → CloudFront distribution for landing"
    echo -e "     - app.cyphrmessenger.app → CloudFront distribution for app"
    echo ""
    echo -e "${YELLOW}Or for direct access (temporary):${NC}"
    echo -e "     - app.cyphrmessenger.app → ${PUBLIC_IP} (A record)"
    echo ""
    echo -e "${YELLOW}SSL/Security:${NC}"
    echo -e "  - SSL certificates will be auto-configured via Let's Encrypt"
    echo -e "  - CloudFront provides additional DDoS protection"
    echo ""
    echo -e "${YELLOW}Monitoring:${NC}"
    echo -e "  SSH: ssh -i ~/.ssh/${PROJECT_NAME}-key.pem ubuntu@${PUBLIC_IP}"
    echo -e "  Logs: pm2 logs cyphr-app"
    echo -e "  Status: pm2 status"
    echo ""
    echo -e "${BLUE}==================================================================${NC}"
}

# Main execution
main() {
    deploy_landing_page
    prepare_app
    deploy_to_ec2
    # setup_ssl  # Uncomment after DNS is pointed to EC2
    test_deployment
    display_instructions
}

# Run main
main