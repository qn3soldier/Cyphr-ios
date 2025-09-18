#!/bin/bash
# 🚀 CYPHR MESSENGER - AWS DEPLOYMENT (FIXED)
# Fixed BlockDeviceMappings issue
set -e

echo "
╔══════════════════════════════════════════════════════════╗
║     CYPHR MESSENGER - AWS DEPLOYMENT (FIXED)           ║
╚══════════════════════════════════════════════════════════╝
"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Enter your AWS Access Keys:${NC}"

# Get AWS credentials
read -p "AWS Access Key ID (starts with AKIA): " AWS_ACCESS_KEY_ID
read -s -p "AWS Secret Access Key (long string): " AWS_SECRET_ACCESS_KEY
echo

# Validate credentials format
if [[ ! $AWS_ACCESS_KEY_ID =~ ^AKIA[A-Z0-9]{16}$ ]]; then
    echo -e "${RED}❌ Invalid Access Key ID format${NC}"
    exit 1
fi

if [[ ${#AWS_SECRET_ACCESS_KEY} -lt 20 ]]; then
    echo -e "${RED}❌ Secret Access Key too short${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Credentials look valid${NC}"

# Configure AWS CLI
export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION=us-east-1

# Test AWS connection
echo "Testing AWS connection..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "error")
if [ "$ACCOUNT_ID" = "error" ]; then
    echo -e "${RED}❌ AWS connection failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ AWS connection successful (Account: $ACCOUNT_ID)${NC}"

# Generate unique identifier
TIMESTAMP=$(date +%s)
KEY_NAME="cyphr-key-$TIMESTAMP"
SG_NAME="cyphr-sg-$TIMESTAMP"

# Create SSH key pair
echo "Creating SSH key..."
aws ec2 create-key-pair --key-name $KEY_NAME --query 'KeyMaterial' --output text > ~/.ssh/${KEY_NAME}.pem
chmod 400 ~/.ssh/${KEY_NAME}.pem
echo -e "${GREEN}✅ SSH key: ~/.ssh/${KEY_NAME}.pem${NC}"

# Create security group
echo "Creating security group..."
SECURITY_GROUP_ID=$(aws ec2 create-security-group \
    --group-name $SG_NAME \
    --description "Security group for Cyphr Messenger" \
    --query 'GroupId' \
    --output text)

# Add security group rules
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 3001 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SECURITY_GROUP_ID --protocol tcp --port 3002 --cidr 0.0.0.0/0

echo -e "${GREEN}✅ Security group: $SECURITY_GROUP_ID${NC}"

# Get latest Ubuntu 22.04 AMI
echo "Getting Ubuntu AMI..."
AMI_ID=$(aws ec2 describe-images \
    --owners 099720109477 \
    --filters 'Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*' 'Name=state,Values=available' \
    --query 'Images|sort_by(@, &CreationDate)[-1]|ImageId' \
    --output text)

# Launch EC2 instance with fixed BlockDeviceMappings
echo "Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --instance-type t3.large \
    --key-name $KEY_NAME \
    --security-group-ids $SECURITY_GROUP_ID \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":50,"VolumeType":"gp3"}}]' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=cyphr-production-$TIMESTAMP}]" \
    --query 'Instances[0].InstanceId' \
    --output text)

echo -e "${GREEN}✅ EC2 instance created: $INSTANCE_ID${NC}"

# Allocate and associate Elastic IP
echo "Creating Elastic IP..."
ALLOCATION_ID=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)
PUBLIC_IP=$(aws ec2 describe-addresses --allocation-ids $ALLOCATION_ID --query 'Addresses[0].PublicIp' --output text)
echo -e "${GREEN}✅ Elastic IP allocated: $PUBLIC_IP${NC}"

# Wait for instance to be running
echo -e "${YELLOW}Waiting for instance to start...${NC}"
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Associate Elastic IP with instance
aws ec2 associate-address --instance-id $INSTANCE_ID --allocation-id $ALLOCATION_ID
echo -e "${GREEN}✅ Elastic IP associated with instance${NC}"

# Wait for SSH to be ready
echo -e "${YELLOW}Waiting for SSH to be ready...${NC}"
sleep 60

# Create user data script for server setup
echo "Setting up server..."
ssh -o StrictHostKeyChecking=no -i ~/.ssh/${KEY_NAME}.pem ubuntu@$PUBLIC_IP << 'ENDSSH'
#!/bin/bash
set -e

# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl git nginx software-properties-common

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
rm get-docker.sh

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Create application directory
sudo mkdir -p /var/www/cyphr
sudo chown -R ubuntu:ubuntu /var/www/cyphr

echo "Server setup complete!"
ENDSSH

# Create deployment info file
cat > deployment-info.txt << EOF
╔══════════════════════════════════════════════════════════╗
║               🎉 DEPLOYMENT COMPLETE! 🎉                ║
╚══════════════════════════════════════════════════════════╝

Your AWS infrastructure is ready!

📍 Server Details:
   Instance ID: $INSTANCE_ID
   Public IP: $PUBLIC_IP
   Security Group: $SECURITY_GROUP_ID
   SSH Key: ~/.ssh/${KEY_NAME}.pem

🔗 Access your server:
   ssh -i ~/.ssh/${KEY_NAME}.pem ubuntu@$PUBLIC_IP

📋 Next steps:
   1. Upload your application code to the server
   2. Configure environment variables
   3. Build and deploy the application
   4. Setup SSL certificate for your domain

🌐 Your server is accessible at:
   http://$PUBLIC_IP

EOF

cat deployment-info.txt

echo -e "${GREEN}✅ Infrastructure deployment complete!${NC}"
echo -e "${BLUE}📋 Deployment details saved to: deployment-info.txt${NC}"
echo -e "${YELLOW}🚀 Ready to deploy your application!${NC}"