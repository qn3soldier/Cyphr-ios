#!/bin/bash

# 🚀 CYPHR MESSENGER - FULLY AUTOMATIC DEPLOYMENT
# Reads credentials from file automatically

set -e

echo "
╔══════════════════════════════════════════════════════════╗
║     CYPHR MESSENGER - AUTOMATIC DEPLOYMENT              ║
╚══════════════════════════════════════════════════════════╝
"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Read credentials from CSV file
CREDS_FILE="../cyphr-admin_credentials.csv"

if [ ! -f "$CREDS_FILE" ]; then
    echo -e "${RED}❌ Credentials file not found: $CREDS_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}Reading AWS credentials from file...${NC}"

# Parse CSV file (skip header, get the data row)
# CSV format: User name,Password,Access key ID,Secret access key,Console login link
CREDENTIALS_LINE=$(tail -n 1 "$CREDS_FILE")

# Extract fields using cut with comma delimiter
AWS_ACCESS_KEY_ID=$(echo "$CREDENTIALS_LINE" | cut -d',' -f3)
AWS_SECRET_ACCESS_KEY=$(echo "$CREDENTIALS_LINE" | cut -d',' -f4)

# Remove any quotes if present
AWS_ACCESS_KEY_ID=$(echo "$AWS_ACCESS_KEY_ID" | tr -d '"')
AWS_SECRET_ACCESS_KEY=$(echo "$AWS_SECRET_ACCESS_KEY" | tr -d '"')

# Validate credentials
if [[ -z "$AWS_ACCESS_KEY_ID" || -z "$AWS_SECRET_ACCESS_KEY" ]]; then
    echo -e "${RED}❌ Could not parse credentials from CSV file${NC}"
    echo "File contents:"
    cat "$CREDS_FILE"
    exit 1
fi

echo -e "${GREEN}✓ Credentials loaded${NC}"
echo -e "${GREEN}Access Key: ${AWS_ACCESS_KEY_ID:0:8}...${NC}"

# Configure AWS CLI
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
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ AWS connection successful (Account: $ACCOUNT_ID)${NC}"
else
    echo -e "${RED}❌ AWS connection failed${NC}"
    exit 1
fi

# Set defaults
DOMAIN_NAME="app.cyphrmessenger.app"
EMAIL="qn3fawkes@protonmail.com"

echo -e "${GREEN}Domain: $DOMAIN_NAME${NC}"
echo -e "${GREEN}Email: $EMAIL${NC}"

# Create unique names to avoid conflicts
TIMESTAMP=$(date +%s)
KEY_NAME="cyphr-key-$TIMESTAMP"
SG_NAME="cyphr-sg-$TIMESTAMP"

echo -e "${YELLOW}Creating SSH key...${NC}"
aws ec2 create-key-pair --key-name $KEY_NAME --query 'KeyMaterial' --output text > ~/.ssh/$KEY_NAME.pem
chmod 400 ~/.ssh/$KEY_NAME.pem
echo -e "${GREEN}✓ SSH key created: ~/.ssh/$KEY_NAME.pem${NC}"

echo -e "${YELLOW}Creating security group...${NC}"
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
    --group-name $SG_NAME \
    --description "Cyphr Messenger Security Group" \
    --query 'GroupId' \
    --output text)

echo -e "${GREEN}✓ Security group: $SECURITY_GROUP_ID${NC}"

# Add rules
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 22 --cidr 0.0.0.0/0 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 80 --cidr 0.0.0.0/0 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 443 --cidr 0.0.0.0/0 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 3001 --cidr 0.0.0.0/0 2>/dev/null || true
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 3002 --cidr 0.0.0.0/0 2>/dev/null || true

echo -e "${GREEN}✓ Security rules configured${NC}"

echo -e "${YELLOW}Getting Ubuntu AMI...${NC}"
AMI_ID=$(aws ec2 describe-images \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
              "Name=state,Values=available" \
    --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
    --output text)

echo -e "${GREEN}✓ AMI: $AMI_ID${NC}"

echo -e "${YELLOW}Launching EC2 instance (t3.large)...${NC}"
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --instance-type t3.large \
    --key-name $KEY_NAME \
    --security-group-ids $SECURITY_GROUP_ID \
    --block-device-mappings DeviceName=/dev/sda1,Ebs={VolumeSize=50,VolumeType=gp3} \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=cyphr-production-$TIMESTAMP}]" \
    --query 'Instances[0].InstanceId' \
    --output text)

echo -e "${GREEN}✓ Instance: $INSTANCE_ID${NC}"

echo -e "${YELLOW}Waiting for instance to start (2-3 minutes)...${NC}"
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo -e "${GREEN}✓ Instance running: $PUBLIC_IP${NC}"

echo -e "${YELLOW}Creating Elastic IP...${NC}"
ALLOCATION_ID=$(aws ec2 allocate-address --query 'AllocationId' --output text)
aws ec2 associate-address --instance-id $INSTANCE_ID --allocation-id $ALLOCATION_ID

ELASTIC_IP=$(aws ec2 describe-addresses --allocation-ids $ALLOCATION_ID --query 'Addresses[0].PublicIp' --output text)
echo -e "${GREEN}✓ Elastic IP: $ELASTIC_IP${NC}"

echo -e "${YELLOW}Waiting for SSH (may take 3-4 minutes)...${NC}"
for i in {1..24}; do
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -i ~/.ssh/$KEY_NAME.pem ubuntu@$ELASTIC_IP "echo 'SSH ready'" &>/dev/null; then
        echo -e "${GREEN}✓ SSH ready${NC}"
        break
    fi
    echo "  Attempt $i/24 (waiting 15 seconds)..."
    sleep 15
done

echo -e "${YELLOW}Setting up server...${NC}"
ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$ELASTIC_IP << 'ENDSSH'
set -e
echo "🔧 Starting server setup..."

# Update system
sudo apt update -y

# Install essentials
sudo apt install -y curl git nginx certbot python3-certbot-nginx

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
rm get-docker.sh

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Setup app directory
sudo mkdir -p /var/www/cyphr
sudo chown -R ubuntu:ubuntu /var/www/cyphr

echo "✅ Server setup complete!"
ENDSSH

echo -e "${YELLOW}Uploading project files...${NC}"
rsync -avz -e "ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '*.zip' \
    --exclude '*.log' \
    --exclude 'infrastructure' \
    --exclude 'scripts' \
    ./ ubuntu@$ELASTIC_IP:/var/www/cyphr/

echo -e "${GREEN}✓ Files uploaded${NC}"

echo -e "${YELLOW}Deploying application...${NC}"
ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$ELASTIC_IP << 'ENDSSH'
cd /var/www/cyphr
echo "📦 Installing dependencies..."
npm install

echo "🔨 Building application..."
npm run build

echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/default << 'EOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;
    
    # Frontend
    location / {
        root /var/www/cyphr/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API
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
        proxy_read_timeout 86400;
    }
    
    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3002;
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
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx configured"

echo "🚀 Starting application..."
pm2 start server.ts --name cyphr-backend --watch false
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo "🎉 Application deployed successfully!"
ENDSSH

echo "
╔══════════════════════════════════════════════════════════╗
║               🎉 DEPLOYMENT SUCCESSFUL! 🎉              ║
╚══════════════════════════════════════════════════════════╝

🌐 Your application is live at: http://$ELASTIC_IP

📊 Server Information:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Instance ID: $INSTANCE_ID
Elastic IP:  $ELASTIC_IP  
SSH Key:     ~/.ssh/$KEY_NAME.pem
Domain:      $DOMAIN_NAME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 Next Steps:
1. Test your app: http://$ELASTIC_IP
2. Configure DNS:
   • Go to your DNS provider
   • Add A record: app.cyphrmessenger.app → $ELASTIC_IP
3. Setup SSL (after DNS propagation):
   ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@$ELASTIC_IP
   sudo certbot --nginx -d $DOMAIN_NAME -m $EMAIL --agree-tos --non-interactive

🛠️  Management Commands:
ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@$ELASTIC_IP  # Connect to server
pm2 logs                                        # View logs
pm2 status                                      # Check status
pm2 restart cyphr-backend                       # Restart app

💰 Cost: ~\$70/month for t3.large instance
"

# Save deployment details
cat > deployment-info.txt << EOF
Cyphr Messenger Deployment
==========================
Date: $(date)
Instance ID: $INSTANCE_ID
Elastic IP: $ELASTIC_IP
SSH Key: ~/.ssh/$KEY_NAME.pem
Security Group: $SECURITY_GROUP_ID
Domain: $DOMAIN_NAME
Email: $EMAIL
Region: us-east-1

SSH Command:
ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@$ELASTIC_IP

Application URL:
http://$ELASTIC_IP

After DNS setup:
https://$DOMAIN_NAME
EOF

echo -e "${GREEN}📄 Deployment details saved to: deployment-info.txt${NC}"
echo -e "${BLUE}🎯 Ready for production! Test at: http://$ELASTIC_IP${NC}"