#!/bin/bash

# 🚀 CYPHR MESSENGER - MANUAL CREDENTIALS INPUT
# Enter AWS credentials manually

set -e

echo "
╔══════════════════════════════════════════════════════════╗
║     CYPHR MESSENGER - AWS DEPLOYMENT                    ║
╚══════════════════════════════════════════════════════════╝
"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}Please create Access Keys in AWS Console first:${NC}"
echo -e "${BLUE}1. Go to: https://879814643628.signin.aws.amazon.com/console${NC}"
echo -e "${BLUE}2. Login: cyphr-admin / AoEV2f'=${NC}"
echo -e "${BLUE}3. Go to IAM → Users → cyphr-admin → Security credentials${NC}"
echo -e "${BLUE}4. Create access key for CLI${NC}"
echo -e "${BLUE}5. Copy the keys and paste below:${NC}"
echo

read -p "AWS Access Key ID (starts with AKIA): " AWS_ACCESS_KEY_ID
echo
read -s -p "AWS Secret Access Key (long string): " AWS_SECRET_ACCESS_KEY
echo
echo

# Validate
if [[ ! $AWS_ACCESS_KEY_ID =~ ^AKIA[A-Z0-9]{16}$ ]]; then
    echo -e "${RED}❌ Invalid Access Key format${NC}"
    exit 1
fi

if [[ ${#AWS_SECRET_ACCESS_KEY} -lt 30 ]]; then
    echo -e "${RED}❌ Invalid Secret Key format${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Credentials look valid${NC}"

# Configure AWS
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

# Test connection
echo -e "${YELLOW}Testing AWS connection...${NC}"
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ AWS connection successful (Account: $ACCOUNT_ID)${NC}"
else
    echo -e "${RED}❌ Connection failed${NC}"
    exit 1
fi

# Continue with deployment
DOMAIN_NAME="app.cyphrmessenger.app"
EMAIL="qn3fawkes@protonmail.com"
TIMESTAMP=$(date +%s)
KEY_NAME="cyphr-key-$TIMESTAMP"

echo -e "${YELLOW}Creating SSH key...${NC}"
aws ec2 create-key-pair --key-name $KEY_NAME --query 'KeyMaterial' --output text > ~/.ssh/$KEY_NAME.pem
chmod 400 ~/.ssh/$KEY_NAME.pem
echo -e "${GREEN}✅ SSH key: ~/.ssh/$KEY_NAME.pem${NC}"

echo -e "${YELLOW}Creating security group...${NC}"
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
    --group-name "cyphr-sg-$TIMESTAMP" \
    --description "Cyphr Messenger Security Group" \
    --query 'GroupId' \
    --output text)

# Add rules
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 3001 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 3002 --cidr 0.0.0.0/0

echo -e "${GREEN}✅ Security group: $SECURITY_GROUP_ID${NC}"

echo -e "${YELLOW}Getting Ubuntu AMI...${NC}"
AMI_ID=$(aws ec2 describe-images \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
              "Name=state,Values=available" \
    --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
    --output text)

echo -e "${YELLOW}Launching EC2 instance...${NC}"
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --instance-type t3.large \
    --key-name $KEY_NAME \
    --security-group-ids $SECURITY_GROUP_ID \
    --block-device-mappings DeviceName=/dev/sda1,Ebs={VolumeSize=50,VolumeType=gp3} \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=cyphr-production}]" \
    --query 'Instances[0].InstanceId' \
    --output text)

echo -e "${GREEN}✅ Instance: $INSTANCE_ID${NC}"

echo -e "${YELLOW}Waiting for instance...${NC}"
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo -e "${GREEN}✅ Public IP: $PUBLIC_IP${NC}"

echo -e "${YELLOW}Creating Elastic IP...${NC}"
ALLOCATION_ID=$(aws ec2 allocate-address --query 'AllocationId' --output text)
aws ec2 associate-address --instance-id $INSTANCE_ID --allocation-id $ALLOCATION_ID

ELASTIC_IP=$(aws ec2 describe-addresses --allocation-ids $ALLOCATION_ID --query 'Addresses[0].PublicIp' --output text)
echo -e "${GREEN}✅ Elastic IP: $ELASTIC_IP${NC}"

echo -e "${YELLOW}Waiting for SSH (3-4 minutes)...${NC}"
for i in {1..20}; do
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -i ~/.ssh/$KEY_NAME.pem ubuntu@$ELASTIC_IP "echo 'ready'" &>/dev/null; then
        echo -e "${GREEN}✅ SSH ready${NC}"
        break
    fi
    echo "  Waiting... ($i/20)"
    sleep 15
done

echo -e "${YELLOW}Setting up server...${NC}"
ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$ELASTIC_IP << 'ENDSSH'
set -e
sudo apt update -y
sudo apt install -y curl git nginx

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

sudo mkdir -p /var/www/cyphr
sudo chown ubuntu:ubuntu /var/www/cyphr
echo "Server ready!"
ENDSSH

echo -e "${YELLOW}Uploading files...${NC}"
rsync -avz -e "ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' --exclude '.git' \
    ./ ubuntu@$ELASTIC_IP:/var/www/cyphr/

echo -e "${YELLOW}Deploying app...${NC}"
ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$ELASTIC_IP << 'ENDSSH'
cd /var/www/cyphr
npm install
npm run build

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
        proxy_set_header Host $host;
    }
}
EOF

sudo systemctl reload nginx
pm2 start server.ts --name cyphr-backend
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu
ENDSSH

echo "
╔══════════════════════════════════════════════════════════╗
║               🎉 DEPLOYMENT COMPLETE! 🎉                ║
╚══════════════════════════════════════════════════════════╝

🌐 App URL: http://$ELASTIC_IP
🔑 SSH: ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@$ELASTIC_IP

Next: Configure DNS to point $DOMAIN_NAME to $ELASTIC_IP
"

cat > deployment-info.txt << EOF
Instance: $INSTANCE_ID
IP: $ELASTIC_IP
SSH: ~/.ssh/$KEY_NAME.pem
EOF