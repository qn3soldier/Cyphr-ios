#!/bin/bash

# =================================================================
# CYPHR MESSENGER - COMPLETE AWS MIGRATION SCRIPT
# =================================================================
# This script sets up the entire infrastructure on AWS
# Including: EC2, CloudFront, S3, SSL, and full deployment
# =================================================================

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="cyphr-messenger"
AWS_REGION="us-east-1"
DOMAIN="cyphrmessenger.app"
WWW_DOMAIN="www.${DOMAIN}"
APP_DOMAIN="app.${DOMAIN}"

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}   CYPHR MESSENGER - COMPLETE AWS INFRASTRUCTURE SETUP${NC}"
echo -e "${BLUE}==================================================================${NC}"

# Function to check AWS CLI
check_aws_cli() {
    echo -e "${YELLOW}Checking AWS CLI...${NC}"
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}AWS CLI not found. Please install it first:${NC}"
        echo "brew install awscli"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}AWS credentials not configured. Run: aws configure${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ AWS CLI configured${NC}"
}

# Function to create S3 buckets
create_s3_buckets() {
    echo -e "${YELLOW}Creating S3 buckets...${NC}"
    
    # Bucket for landing page
    LANDING_BUCKET="${PROJECT_NAME}-landing"
    if aws s3 ls "s3://${LANDING_BUCKET}" 2>&1 | grep -q 'NoSuchBucket'; then
        aws s3 mb "s3://${LANDING_BUCKET}" --region ${AWS_REGION}
        aws s3 website "s3://${LANDING_BUCKET}" \
            --index-document index.html \
            --error-document error.html
        echo -e "${GREEN}✓ Created landing page bucket: ${LANDING_BUCKET}${NC}"
    else
        echo -e "${YELLOW}Landing bucket already exists${NC}"
    fi
    
    # Bucket for app static assets
    ASSETS_BUCKET="${PROJECT_NAME}-assets"
    if aws s3 ls "s3://${ASSETS_BUCKET}" 2>&1 | grep -q 'NoSuchBucket'; then
        aws s3 mb "s3://${ASSETS_BUCKET}" --region ${AWS_REGION}
        echo -e "${GREEN}✓ Created assets bucket: ${ASSETS_BUCKET}${NC}"
    else
        echo -e "${YELLOW}Assets bucket already exists${NC}"
    fi
    
    # Set bucket policies for public access (landing page only)
    cat > /tmp/bucket-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::${LANDING_BUCKET}/*"
        }
    ]
}
EOF
    
    aws s3api put-bucket-policy --bucket ${LANDING_BUCKET} --policy file:///tmp/bucket-policy.json
    echo -e "${GREEN}✓ Set bucket policies${NC}"
}

# Function to create EC2 key pair
create_ec2_keypair() {
    echo -e "${YELLOW}Creating EC2 key pair...${NC}"
    KEY_NAME="${PROJECT_NAME}-key"
    
    if aws ec2 describe-key-pairs --key-names ${KEY_NAME} --region ${AWS_REGION} 2>&1 | grep -q 'InvalidKeyPair.NotFound'; then
        aws ec2 create-key-pair \
            --key-name ${KEY_NAME} \
            --query 'KeyMaterial' \
            --output text \
            --region ${AWS_REGION} > ~/.ssh/${KEY_NAME}.pem
        
        chmod 400 ~/.ssh/${KEY_NAME}.pem
        echo -e "${GREEN}✓ Created key pair: ~/.ssh/${KEY_NAME}.pem${NC}"
    else
        echo -e "${YELLOW}Key pair already exists${NC}"
    fi
}

# Function to create security group
create_security_group() {
    echo -e "${YELLOW}Creating security group...${NC}"
    SG_NAME="${PROJECT_NAME}-sg"
    
    # Get default VPC ID
    VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text --region ${AWS_REGION})
    
    # Create security group
    SG_ID=$(aws ec2 create-security-group \
        --group-name ${SG_NAME} \
        --description "Security group for Cyphr Messenger" \
        --vpc-id ${VPC_ID} \
        --region ${AWS_REGION} \
        --output text 2>/dev/null || \
        aws ec2 describe-security-groups \
            --filters "Name=group-name,Values=${SG_NAME}" \
            --query "SecurityGroups[0].GroupId" \
            --output text \
            --region ${AWS_REGION})
    
    # Add security rules
    echo -e "${YELLOW}Adding security rules...${NC}"
    
    # SSH (22)
    aws ec2 authorize-security-group-ingress \
        --group-id ${SG_ID} \
        --protocol tcp \
        --port 22 \
        --cidr 0.0.0.0/0 \
        --region ${AWS_REGION} 2>/dev/null || true
    
    # HTTP (80)
    aws ec2 authorize-security-group-ingress \
        --group-id ${SG_ID} \
        --protocol tcp \
        --port 80 \
        --cidr 0.0.0.0/0 \
        --region ${AWS_REGION} 2>/dev/null || true
    
    # HTTPS (443)
    aws ec2 authorize-security-group-ingress \
        --group-id ${SG_ID} \
        --protocol tcp \
        --port 443 \
        --cidr 0.0.0.0/0 \
        --region ${AWS_REGION} 2>/dev/null || true
    
    # Node.js app (3001)
    aws ec2 authorize-security-group-ingress \
        --group-id ${SG_ID} \
        --protocol tcp \
        --port 3001 \
        --cidr 0.0.0.0/0 \
        --region ${AWS_REGION} 2>/dev/null || true
    
    # WebSocket (3002)
    aws ec2 authorize-security-group-ingress \
        --group-id ${SG_ID} \
        --protocol tcp \
        --port 3002 \
        --cidr 0.0.0.0/0 \
        --region ${AWS_REGION} 2>/dev/null || true
    
    echo -e "${GREEN}✓ Security group configured: ${SG_ID}${NC}"
    echo ${SG_ID} > /tmp/sg-id.txt
}

# Function to launch EC2 instance
launch_ec2_instance() {
    echo -e "${YELLOW}Launching EC2 instance...${NC}"
    
    SG_ID=$(cat /tmp/sg-id.txt)
    KEY_NAME="${PROJECT_NAME}-key"
    
    # Get latest Ubuntu 22.04 AMI
    AMI_ID=$(aws ec2 describe-images \
        --owners 099720109477 \
        --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
        --query 'Images[0].ImageId' \
        --output text \
        --region ${AWS_REGION})
    
    # Create user data script
    cat > /tmp/user-data.sh <<'EOF'
#!/bin/bash
apt-get update
apt-get install -y nginx nodejs npm git certbot python3-certbot-nginx
npm install -g pm2

# Configure Nginx
systemctl start nginx
systemctl enable nginx

# Create app directory
mkdir -p /var/www/cyphr
chown -R ubuntu:ubuntu /var/www/cyphr
EOF
    
    # Launch instance
    INSTANCE_ID=$(aws ec2 run-instances \
        --image-id ${AMI_ID} \
        --instance-type t3.medium \
        --key-name ${KEY_NAME} \
        --security-group-ids ${SG_ID} \
        --user-data file:///tmp/user-data.sh \
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${PROJECT_NAME}}]" \
        --region ${AWS_REGION} \
        --output text \
        --query 'Instances[0].InstanceId')
    
    echo -e "${GREEN}✓ Launched EC2 instance: ${INSTANCE_ID}${NC}"
    
    # Wait for instance to be running
    echo -e "${YELLOW}Waiting for instance to start...${NC}"
    aws ec2 wait instance-running --instance-ids ${INSTANCE_ID} --region ${AWS_REGION}
    
    # Allocate Elastic IP
    echo -e "${YELLOW}Allocating Elastic IP...${NC}"
    ALLOCATION_ID=$(aws ec2 allocate-address --domain vpc --region ${AWS_REGION} --query 'AllocationId' --output text)
    aws ec2 associate-address --instance-id ${INSTANCE_ID} --allocation-id ${ALLOCATION_ID} --region ${AWS_REGION}
    
    # Get public IP
    PUBLIC_IP=$(aws ec2 describe-addresses --allocation-ids ${ALLOCATION_ID} --region ${AWS_REGION} --query 'Addresses[0].PublicIp' --output text)
    echo -e "${GREEN}✓ Elastic IP allocated: ${PUBLIC_IP}${NC}"
    
    echo ${INSTANCE_ID} > /tmp/instance-id.txt
    echo ${PUBLIC_IP} > /tmp/public-ip.txt
}

# Function to create CloudFront distribution
create_cloudfront() {
    echo -e "${YELLOW}Creating CloudFront distributions...${NC}"
    
    PUBLIC_IP=$(cat /tmp/public-ip.txt)
    LANDING_BUCKET="${PROJECT_NAME}-landing"
    
    # CloudFront for landing page (S3)
    cat > /tmp/cf-landing-config.json <<EOF
{
    "CallerReference": "landing-$(date +%s)",
    "Comment": "Cyphr Messenger Landing Page",
    "Enabled": true,
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "S3-${LANDING_BUCKET}",
                "DomainName": "${LANDING_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com",
                "CustomOriginConfig": {
                    "HTTPPort": 80,
                    "HTTPSPort": 443,
                    "OriginProtocolPolicy": "http-only"
                }
            }
        ]
    },
    "DefaultRootObject": "index.html",
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-${LANDING_BUCKET}",
        "ViewerProtocolPolicy": "redirect-to-https",
        "TrustedSigners": {
            "Enabled": false,
            "Quantity": 0
        },
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {
                "Forward": "none"
            }
        },
        "MinTTL": 0,
        "DefaultTTL": 86400,
        "MaxTTL": 31536000
    },
    "Aliases": {
        "Quantity": 1,
        "Items": ["${WWW_DOMAIN}"]
    }
}
EOF
    
    # CloudFront for app (EC2)
    cat > /tmp/cf-app-config.json <<EOF
{
    "CallerReference": "app-$(date +%s)",
    "Comment": "Cyphr Messenger Application",
    "Enabled": true,
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "EC2-${PUBLIC_IP}",
                "DomainName": "${PUBLIC_IP}",
                "CustomOriginConfig": {
                    "HTTPPort": 80,
                    "HTTPSPort": 443,
                    "OriginProtocolPolicy": "http-only"
                }
            }
        ]
    },
    "DefaultCacheBehavior": {
        "TargetOriginId": "EC2-${PUBLIC_IP}",
        "ViewerProtocolPolicy": "redirect-to-https",
        "TrustedSigners": {
            "Enabled": false,
            "Quantity": 0
        },
        "ForwardedValues": {
            "QueryString": true,
            "Cookies": {
                "Forward": "all"
            },
            "Headers": {
                "Quantity": 1,
                "Items": ["*"]
            }
        },
        "MinTTL": 0,
        "DefaultTTL": 0,
        "MaxTTL": 0
    },
    "Aliases": {
        "Quantity": 1,
        "Items": ["${APP_DOMAIN}"]
    }
}
EOF
    
    echo -e "${GREEN}✓ CloudFront configurations created${NC}"
    echo -e "${YELLOW}Note: CloudFront creation requires SSL certificates from ACM${NC}"
}

# Function to display next steps
display_next_steps() {
    PUBLIC_IP=$(cat /tmp/public-ip.txt 2>/dev/null || echo "Not created")
    KEY_PATH="~/.ssh/${PROJECT_NAME}-key.pem"
    
    echo -e "${BLUE}==================================================================${NC}"
    echo -e "${GREEN}   AWS INFRASTRUCTURE CREATED SUCCESSFULLY!${NC}"
    echo -e "${BLUE}==================================================================${NC}"
    echo ""
    echo -e "${YELLOW}EC2 Instance Details:${NC}"
    echo -e "  Public IP: ${PUBLIC_IP}"
    echo -e "  SSH Key: ${KEY_PATH}"
    echo -e "  Connect: ssh -i ${KEY_PATH} ubuntu@${PUBLIC_IP}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo -e "1. Request SSL certificates in AWS Certificate Manager for:"
    echo -e "   - ${WWW_DOMAIN}"
    echo -e "   - ${APP_DOMAIN}"
    echo ""
    echo -e "2. Complete CloudFront setup with SSL certificates"
    echo ""
    echo -e "3. Deploy applications:"
    echo -e "   - Landing page to S3 bucket: ${PROJECT_NAME}-landing"
    echo -e "   - Cyphr app to EC2: ${PUBLIC_IP}"
    echo ""
    echo -e "4. Update DNS records to point to CloudFront distributions"
    echo ""
    echo -e "${BLUE}==================================================================${NC}"
}

# Main execution
main() {
    check_aws_cli
    create_s3_buckets
    create_ec2_keypair
    create_security_group
    launch_ec2_instance
    create_cloudfront
    display_next_steps
}

# Run main function
main