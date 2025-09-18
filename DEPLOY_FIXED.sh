#!/bin/bash

# 🚀 CYPHR MESSENGER - AWS DEPLOYMENT (FIXED)
# Fixed AWS credentials handling

set -e

echo "
╔══════════════════════════════════════════════════════════╗
║     CYPHR MESSENGER - AWS DEPLOYMENT (FIXED)            ║
╚══════════════════════════════════════════════════════════╝
"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get AWS credentials manually (more reliable)
echo -e "${YELLOW}Please enter your AWS credentials from the CSV file:${NC}"
echo -e "${BLUE}(Open the cyphr-admin_credentials.csv file you downloaded)${NC}"
echo
read -p "AWS Access Key ID (starts with AKIA): " AWS_ACCESS_KEY_ID
echo
read -s -p "AWS Secret Access Key (long string): " AWS_SECRET_ACCESS_KEY
echo
echo

# Validate credentials format
if [[ ! $AWS_ACCESS_KEY_ID =~ ^AKIA[A-Z0-9]{16}$ ]]; then
    echo -e "${RED}❌ Invalid Access Key format. Should start with AKIA and be 20 characters total.${NC}"
    exit 1
fi

if [[ ${#AWS_SECRET_ACCESS_KEY} -lt 30 ]]; then
    echo -e "${RED}❌ Invalid Secret Key format. Should be a long string (40+ characters).${NC}"
    exit 1
fi

# Configure AWS CLI manually
echo -e "${YELLOW}Configuring AWS...${NC}"
mkdir -p ~/.aws

cat > ~/.aws/credentials << EOF
[default]
aws_access_key_id = $AWS_ACCESS_KEY_ID
aws_secret_access_key = $AWS_SECRET_ACCESS_KEY
EOF

cat > ~/.aws/config << EOF
[default]
region = us-east-1
output = json
EOF

echo -e "${GREEN}✓ AWS configured${NC}"

# Test AWS connection
echo -e "${YELLOW}Testing AWS connection...${NC}"
aws sts get-caller-identity --query 'Account' --output text >/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ AWS connection successful${NC}"
else
    echo -e "${RED}❌ AWS connection failed. Check your credentials.${NC}"
    exit 1
fi

# Get deployment info
echo
read -p "Domain name: " DOMAIN_NAME
read -p "Email for SSL: " EMAIL

DOMAIN_NAME=${DOMAIN_NAME:-app.cyphrmessenger.app}
EMAIL=${EMAIL:-admin@cyphrmessenger.app}

echo -e "${GREEN}Domain: $DOMAIN_NAME${NC}"
echo -e "${GREEN}Email: $EMAIL${NC}"
echo

# Create unique key name to avoid conflicts
KEY_NAME="cyphr-key-$(date +%s)"

# Create SSH key
echo -e "${YELLOW}Creating SSH key...${NC}"
aws ec2 create-key-pair --key-name $KEY_NAME --query 'KeyMaterial' --output text > ~/.ssh/$KEY_NAME.pem
chmod 400 ~/.ssh/$KEY_NAME.pem
echo -e "${GREEN}✓ SSH key created: ~/.ssh/$KEY_NAME.pem${NC}"

# Create security group with unique name
echo -e "${YELLOW}Creating security group...${NC}"
SG_NAME="cyphr-sg-$(date +%s)"
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
    --group-name $SG_NAME \
    --description "Security group for Cyphr Messenger" \
    --query 'GroupId' \
    --output text)

echo -e "${GREEN}✓ Security group created: $SECURITY_GROUP_ID${NC}"

# Add security group rules
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 3001 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 3002 --cidr 0.0.0.0/0

echo -e "${GREEN}✓ Security rules configured${NC}"

# Get latest Ubuntu AMI
echo -e "${YELLOW}Finding latest Ubuntu AMI...${NC}"
AMI_ID=$(aws ec2 describe-images \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
              "Name=state,Values=available" \
    --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
    --output text)

echo -e "${GREEN}✓ Using AMI: $AMI_ID${NC}"

# Launch EC2 instance
echo -e "${YELLOW}Launching EC2 instance (t3.large - may take 2-3 minutes)...${NC}"
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --instance-type t3.large \
    --key-name $KEY_NAME \
    --security-group-ids $SECURITY_GROUP_ID \
    --block-device-mappings DeviceName=/dev/sda1,Ebs={VolumeSize=50,VolumeType=gp3} \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cyphr-production}]' \
    --query 'Instances[0].InstanceId' \
    --output text)

echo -e "${GREEN}✓ Instance launched: $INSTANCE_ID${NC}"

# Wait for instance to be running
echo -e "${YELLOW}Waiting for instance to start...${NC}"
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo -e "${GREEN}✓ Instance running at: $PUBLIC_IP${NC}"

# Create and associate Elastic IP
echo -e "${YELLOW}Creating Elastic IP...${NC}"
ALLOCATION_ID=$(aws ec2 allocate-address --query 'AllocationId' --output text)
aws ec2 associate-address --instance-id $INSTANCE_ID --allocation-id $ALLOCATION_ID

# Get Elastic IP
ELASTIC_IP=$(aws ec2 describe-addresses --allocation-ids $ALLOCATION_ID --query 'Addresses[0].PublicIp' --output text)
echo -e "${GREEN}✓ Elastic IP: $ELASTIC_IP${NC}"

# Wait for SSH to be ready
echo -e "${YELLOW}Waiting for SSH to be ready (may take 2-3 minutes)...${NC}"
for i in {1..60}; do
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i ~/.ssh/$KEY_NAME.pem ubuntu@$ELASTIC_IP "echo 'SSH ready'" &>/dev/null; then
        echo -e "${GREEN}✓ SSH connection established${NC}"
        break
    fi
    echo "Attempt $i/60..."
    sleep 10
done

# Setup server
echo -e "${YELLOW}Setting up server...${NC}"
ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$ELASTIC_IP << 'ENDSSH'
set -e
echo "Starting server setup..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx certbot python3-certbot-nginx

# Create app directory
sudo mkdir -p /var/www/cyphr
sudo chown -R ubuntu:ubuntu /var/www/cyphr

echo "✓ Server setup complete!"
ENDSSH

# Upload project files
echo -e "${YELLOW}Uploading project files...${NC}"
rsync -avz -e "ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '*.zip' \
    --exclude '*.log' \
    ./ ubuntu@$ELASTIC_IP:/var/www/cyphr/

echo -e "${GREEN}✓ Files uploaded${NC}"

# Deploy application
echo -e "${YELLOW}Deploying application...${NC}"
ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$ELASTIC_IP << 'ENDSSH'
cd /var/www/cyphr

# Install dependencies
npm install

# Build application
npm run build

# Configure Nginx
sudo tee /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80;
    server_name _;
    
    location / {
        root /var/www/cyphr/dist;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /socket.io {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

sudo nginx -t && sudo systemctl reload nginx

# Start backend with PM2
pm2 start server.ts --name cyphr-backend
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo "✓ Application deployed!"
ENDSSH

echo "
╔══════════════════════════════════════════════════════════╗
║               🎉 DEPLOYMENT COMPLETE! 🎉                ║
╚══════════════════════════════════════════════════════════╝

Your application is now running at:
🌐 http://$ELASTIC_IP

Server Details:
📍 Elastic IP: $ELASTIC_IP
🔑 Instance ID: $INSTANCE_ID
🗝️  SSH Key: ~/.ssh/$KEY_NAME.pem
🔐 SSH Command: ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@$ELASTIC_IP

Next Steps:
1. Test the application: http://$ELASTIC_IP
2. Configure DNS:
   - Go to your domain DNS settings
   - Add A record: app.cyphrmessenger.app -> $ELASTIC_IP
3. Setup SSL:
   ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@$ELASTIC_IP
   sudo certbot --nginx -d $DOMAIN_NAME -m $EMAIL --agree-tos --non-interactive

Monitoring Commands:
pm2 logs     - View application logs
pm2 status   - Check application status
sudo nginx -t - Test nginx config
"

# Save deployment info
cat > deployment-info.txt << EOF
Deployment Information
======================
Date: $(date)
Instance ID: $INSTANCE_ID
Elastic IP: $ELASTIC_IP
Security Group: $SECURITY_GROUP_ID
SSH Key: ~/.ssh/$KEY_NAME.pem
Domain: $DOMAIN_NAME
Email: $EMAIL
EOF

echo -e "${GREEN}✓ Deployment info saved to deployment-info.txt${NC}"