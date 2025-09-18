#!/bin/bash

# Cyphr Messenger - AWS Production Deployment Script
# Run this on your EC2 instance after initial setup

set -e

echo "🚀 Starting Cyphr Messenger Production Deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN=${1:-"cyphrmessenger.com"}
EMAIL=${2:-"admin@cyphrmessenger.com"}
REPO_URL=${3:-"https://github.com/your-repo/cyphr-messenger.git"}

echo -e "${GREEN}Domain: $DOMAIN${NC}"
echo -e "${GREEN}Email: $EMAIL${NC}"

# Function to check command success
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1 successful${NC}"
    else
        echo -e "${RED}✗ $1 failed${NC}"
        exit 1
    fi
}

# 1. System Update
echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y
check_status "System update"

# 2. Install Docker
echo -e "${YELLOW}Step 2: Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    check_status "Docker installation"
else
    echo -e "${GREEN}Docker already installed${NC}"
fi

# 3. Install Docker Compose
echo -e "${YELLOW}Step 3: Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    sudo apt install docker-compose -y
    check_status "Docker Compose installation"
else
    echo -e "${GREEN}Docker Compose already installed${NC}"
fi

# 4. Install Node.js
echo -e "${YELLOW}Step 4: Installing Node.js 20...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    check_status "Node.js installation"
else
    echo -e "${GREEN}Node.js already installed ($(node -v))${NC}"
fi

# 5. Install PM2
echo -e "${YELLOW}Step 5: Installing PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    pm2 startup systemd -u ubuntu --hp /home/ubuntu
    check_status "PM2 installation"
else
    echo -e "${GREEN}PM2 already installed${NC}"
fi

# 6. Install Nginx
echo -e "${YELLOW}Step 6: Installing Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    sudo apt install nginx -y
    check_status "Nginx installation"
else
    echo -e "${GREEN}Nginx already installed${NC}"
fi

# 7. Install Certbot
echo -e "${YELLOW}Step 7: Installing Certbot for SSL...${NC}"
if ! command -v certbot &> /dev/null; then
    sudo apt install certbot python3-certbot-nginx -y
    check_status "Certbot installation"
else
    echo -e "${GREEN}Certbot already installed${NC}"
fi

# 8. Setup application directory
echo -e "${YELLOW}Step 8: Setting up application directory...${NC}"
sudo mkdir -p /var/www/cyphr
sudo chown -R ubuntu:ubuntu /var/www/cyphr
sudo mkdir -p /var/log/cyphr
sudo chown -R ubuntu:ubuntu /var/log/cyphr
check_status "Directory setup"

# 9. Clone repository
echo -e "${YELLOW}Step 9: Cloning repository...${NC}"
cd /var/www/cyphr
if [ ! -d ".git" ]; then
    git clone $REPO_URL .
    check_status "Repository clone"
else
    echo -e "${GREEN}Repository already exists, pulling latest...${NC}"
    git pull origin main
    check_status "Repository update"
fi

# 10. Install dependencies
echo -e "${YELLOW}Step 10: Installing dependencies...${NC}"
npm install
check_status "Dependencies installation"

# 11. Build application
echo -e "${YELLOW}Step 11: Building application...${NC}"
npm run build
check_status "Application build"

# 12. Setup environment files
echo -e "${YELLOW}Step 12: Setting up environment files...${NC}"
if [ ! -f ".env.production.server" ]; then
    echo -e "${RED}Please create .env.production.server with your secrets${NC}"
    echo "Required variables:"
    echo "  - TWILIO_AUTH_TOKEN"
    echo "  - STELLAR_SECRET_KEY"
    echo "  - JWT_SECRET"
    exit 1
fi

# 13. Setup Nginx configuration
echo -e "${YELLOW}Step 13: Setting up Nginx...${NC}"
sudo cp nginx.conf /etc/nginx/sites-available/cyphr
sudo ln -sf /etc/nginx/sites-available/cyphr /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
check_status "Nginx configuration"

# 14. Setup SSL with Let's Encrypt
echo -e "${YELLOW}Step 14: Setting up SSL certificate...${NC}"
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m $EMAIL
check_status "SSL certificate"

# 15. Setup firewall
echo -e "${YELLOW}Step 15: Configuring firewall...${NC}"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
check_status "Firewall configuration"

# 16. Start services with Docker Compose
echo -e "${YELLOW}Step 16: Starting Docker services...${NC}"
docker-compose up -d
check_status "Docker services"

# 17. Start PM2 processes
echo -e "${YELLOW}Step 17: Starting PM2 processes...${NC}"
pm2 start ecosystem.config.js --env production
pm2 save
check_status "PM2 processes"

# 18. Restart Nginx
echo -e "${YELLOW}Step 18: Restarting Nginx...${NC}"
sudo systemctl restart nginx
check_status "Nginx restart"

# 19. Setup log rotation
echo -e "${YELLOW}Step 19: Setting up log rotation...${NC}"
cat > /tmp/cyphr-logrotate << EOF
/var/log/cyphr/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 640 ubuntu ubuntu
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
sudo mv /tmp/cyphr-logrotate /etc/logrotate.d/cyphr
check_status "Log rotation"

# 20. Setup automatic SSL renewal
echo -e "${YELLOW}Step 20: Setting up SSL auto-renewal...${NC}"
(crontab -l 2>/dev/null; echo "0 0 * * * /usr/bin/certbot renew --quiet") | crontab -
check_status "SSL auto-renewal"

# 21. Health check
echo -e "${YELLOW}Step 21: Running health check...${NC}"
sleep 10
curl -f https://$DOMAIN/health
check_status "Health check"

echo -e "${GREEN}✨ Deployment complete!${NC}"
echo -e "${GREEN}Your application is now running at: https://$DOMAIN${NC}"
echo ""
echo "Next steps:"
echo "1. Update DNS records to point to this server"
echo "2. Configure monitoring and alerts"
echo "3. Set up backups"
echo "4. Test all functionality"
echo ""
echo "Useful commands:"
echo "  pm2 status         - Check PM2 processes"
echo "  pm2 logs          - View application logs"
echo "  docker-compose ps - Check Docker containers"
echo "  sudo nginx -t     - Test Nginx config"
echo "  sudo certbot certificates - Check SSL status"