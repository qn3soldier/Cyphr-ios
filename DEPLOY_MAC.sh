#!/bin/bash

# 🚀 CYPHR MESSENGER - DEPLOYMENT FOR MAC
# Optimized for macOS

set -e

echo "
╔══════════════════════════════════════════════════════════╗
║     CYPHR MESSENGER - AWS DEPLOYMENT (macOS)            ║
╚══════════════════════════════════════════════════════════╝
"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check and install Terraform
if ! command -v terraform &> /dev/null; then
    echo -e "${YELLOW}Installing Terraform...${NC}"
    brew tap hashicorp/tap
    brew install hashicorp/tap/terraform
else
    echo -e "${GREEN}✓ Terraform already installed${NC}"
fi

# Read AWS credentials from CSV
echo -e "${YELLOW}Reading AWS credentials...${NC}"
CREDS_FILE="/Users/daniilbogdanov/cyphrmessenger/cyphr-admin_credentials.csv"

if [ -f "$CREDS_FILE" ]; then
    # Parse CSV file (skip header)
    AWS_ACCESS_KEY=$(tail -n 1 "$CREDS_FILE" | cut -d',' -f3)
    AWS_SECRET_KEY=$(tail -n 1 "$CREDS_FILE" | cut -d',' -f4)
    echo -e "${GREEN}✓ Credentials loaded from CSV${NC}"
else
    echo -e "${YELLOW}Enter AWS credentials manually:${NC}"
    read -p "AWS Access Key ID: " AWS_ACCESS_KEY
    read -s -p "AWS Secret Access Key: " AWS_SECRET_KEY
    echo
fi

# Configure AWS CLI
aws configure set aws_access_key_id "$AWS_ACCESS_KEY"
aws configure set aws_secret_access_key "$AWS_SECRET_KEY"
aws configure set default.region us-east-1

echo -e "${GREEN}✓ AWS configured${NC}"

# Get deployment info
read -p "Domain name (e.g., cyphrmessenger.com): " DOMAIN_NAME
read -p "Email for SSL: " EMAIL

# Create SSH key if doesn't exist
if [ ! -f ~/.ssh/cyphr-key.pem ]; then
    echo -e "${YELLOW}Creating SSH key...${NC}"
    # Create key pair in AWS
    aws ec2 create-key-pair --key-name cyphr-key --query 'KeyMaterial' --output text > ~/.ssh/cyphr-key.pem
    chmod 400 ~/.ssh/cyphr-key.pem
    echo -e "${GREEN}✓ SSH key created${NC}"
else
    echo -e "${GREEN}✓ SSH key exists${NC}"
fi

# Create security group
echo -e "${YELLOW}Creating security group...${NC}"
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
    --group-name cyphr-sg-$(date +%s) \
    --description "Security group for Cyphr Messenger" \
    --query 'GroupId' \
    --output text 2>/dev/null || echo "existing")

if [ "$SECURITY_GROUP_ID" != "existing" ]; then
    # Add rules
    aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 443 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 3001 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 3002 --cidr 0.0.0.0/0
    echo -e "${GREEN}✓ Security group created${NC}"
else
    # Find existing security group
    SECURITY_GROUP_ID=$(aws ec2 describe-security-groups --group-names cyphr-sg* --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "sg-default")
    echo -e "${YELLOW}Using existing security group${NC}"
fi

# Launch EC2 instance
echo -e "${YELLOW}Launching EC2 instance (t3.large)...${NC}"

# Get latest Ubuntu 22.04 AMI
AMI_ID=$(aws ec2 describe-images \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
    --query 'Images[0].ImageId' \
    --output text)

echo "Using AMI: $AMI_ID"

# Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --instance-type t3.large \
    --key-name cyphr-key \
    --security-group-ids $SECURITY_GROUP_ID \
    --block-device-mappings DeviceName=/dev/sda1,Ebs={VolumeSize=50,VolumeType=gp3} \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cyphr-production}]' \
    --user-data file://setup-server.sh \
    --query 'Instances[0].InstanceId' \
    --output text)

echo -e "${GREEN}✓ Instance launched: $INSTANCE_ID${NC}"

# Wait for instance
echo -e "${YELLOW}Waiting for instance to start (2-3 minutes)...${NC}"
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo -e "${GREEN}✓ Instance running at: $PUBLIC_IP${NC}"

# Create Elastic IP and associate
echo -e "${YELLOW}Creating Elastic IP...${NC}"
ALLOCATION_ID=$(aws ec2 allocate-address --query 'AllocationId' --output text)
aws ec2 associate-address --instance-id $INSTANCE_ID --allocation-id $ALLOCATION_ID

# Get new Elastic IP
ELASTIC_IP=$(aws ec2 describe-addresses --allocation-ids $ALLOCATION_ID --query 'Addresses[0].PublicIp' --output text)
echo -e "${GREEN}✓ Elastic IP: $ELASTIC_IP${NC}"

# Wait for SSH
echo -e "${YELLOW}Waiting for SSH to be ready...${NC}"
sleep 60

# Test connection
while ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i ~/.ssh/cyphr-key.pem ubuntu@$ELASTIC_IP "echo 'SSH ready'" &>/dev/null; do
    echo "Waiting for SSH..."
    sleep 10
done

echo -e "${GREEN}✓ SSH connection established${NC}"

# Copy project files
echo -e "${YELLOW}Copying project files...${NC}"
rsync -avz -e "ssh -i ~/.ssh/cyphr-key.pem -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    ./ ubuntu@$ELASTIC_IP:/home/ubuntu/cyphr/

# Setup server
echo -e "${YELLOW}Setting up server...${NC}"
ssh -i ~/.ssh/cyphr-key.pem -o StrictHostKeyChecking=no ubuntu@$ELASTIC_IP << 'ENDSSH'
set -e

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
sudo apt install -y nginx

# Move to app directory
cd /home/ubuntu/cyphr
sudo mv * /var/www/cyphr/ 2>/dev/null || true
cd /var/www/cyphr

# Install dependencies
npm install

# Build application
npm run build

# Start backend with PM2
pm2 start server.ts --name cyphr-backend
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu

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
}
EOF

sudo nginx -s reload

echo "✓ Server setup complete!"
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
🔐 SSH: ssh -i ~/.ssh/cyphr-key.pem ubuntu@$ELASTIC_IP

Next Steps:
1. Configure your domain DNS to point to: $ELASTIC_IP
2. Setup SSL with: sudo certbot --nginx -d $DOMAIN_NAME
3. Test the application at: http://$ELASTIC_IP

To connect to server:
ssh -i ~/.ssh/cyphr-key.pem ubuntu@$ELASTIC_IP

To check logs:
ssh -i ~/.ssh/cyphr-key.pem ubuntu@$ELASTIC_IP 'pm2 logs'
"

# Save deployment info
cat > deployment-info.txt << EOF
Deployment Information
======================
Date: $(date)
Instance ID: $INSTANCE_ID
Elastic IP: $ELASTIC_IP
Security Group: $SECURITY_GROUP_ID
Region: us-east-1
SSH Key: ~/.ssh/cyphr-key.pem
EOF

echo -e "${GREEN}Deployment info saved to deployment-info.txt${NC}"