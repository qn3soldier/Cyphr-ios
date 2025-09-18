#!/bin/bash

# 🚀 CYPHR MESSENGER - FULLY AUTOMATED DEPLOYMENT
# This script will deploy EVERYTHING automatically!

set -e

echo "
╔══════════════════════════════════════════════════════════╗
║     CYPHR MESSENGER - AUTOMATIC CLOUD DEPLOYMENT        ║
║                                                          ║
║  This will automatically:                               ║
║  ✓ Create AWS infrastructure                            ║
║  ✓ Deploy application                                   ║
║  ✓ Setup SSL certificates                               ║
║  ✓ Configure monitoring                                 ║
║  ✓ Enable auto-scaling                                  ║
╚══════════════════════════════════════════════════════════╝
"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check for required tools
    tools=("terraform" "aws" "git" "docker" "node")
    for tool in "${tools[@]}"; do
        if command -v $tool &> /dev/null; then
            echo -e "${GREEN}✓ $tool installed${NC}"
        else
            echo -e "${RED}✗ $tool not installed${NC}"
            echo -e "${YELLOW}Installing $tool...${NC}"
            
            case $tool in
                terraform)
                    # Install Terraform
                    curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
                    sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
                    sudo apt-get update && sudo apt-get install terraform
                    ;;
                aws)
                    # Install AWS CLI
                    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
                    unzip awscliv2.zip
                    sudo ./aws/install
                    rm -rf awscliv2.zip aws/
                    ;;
                docker)
                    # Install Docker
                    curl -fsSL https://get.docker.com -o get-docker.sh
                    sudo sh get-docker.sh
                    rm get-docker.sh
                    ;;
                node)
                    # Install Node.js
                    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
                    sudo apt-get install -y nodejs
                    ;;
            esac
        fi
    done
}

# Function to configure AWS
configure_aws() {
    echo -e "${YELLOW}Configuring AWS credentials...${NC}"
    
    if [ ! -f ~/.aws/credentials ]; then
        echo -e "${BLUE}Please enter your AWS credentials:${NC}"
        read -p "AWS Access Key ID: " aws_access_key
        read -s -p "AWS Secret Access Key: " aws_secret_key
        echo
        read -p "AWS Region (default: us-east-1): " aws_region
        aws_region=${aws_region:-us-east-1}
        
        aws configure set aws_access_key_id $aws_access_key
        aws configure set aws_secret_access_key $aws_secret_key
        aws configure set default.region $aws_region
        
        echo -e "${GREEN}✓ AWS configured${NC}"
    else
        echo -e "${GREEN}✓ AWS already configured${NC}"
    fi
}

# Function to generate SSH keys
generate_ssh_keys() {
    echo -e "${YELLOW}Generating SSH keys...${NC}"
    
    if [ ! -f ~/.ssh/cyphr-key ]; then
        ssh-keygen -t rsa -b 4096 -f ~/.ssh/cyphr-key -N "" -C "cyphr-messenger"
        echo -e "${GREEN}✓ SSH keys generated${NC}"
    else
        echo -e "${GREEN}✓ SSH keys already exist${NC}"
    fi
}

# Function to get user inputs
get_user_inputs() {
    echo -e "${BLUE}Please provide the following information:${NC}"
    
    # Domain name
    read -p "Domain name (e.g., cyphrmessenger.com): " domain_name
    while [ -z "$domain_name" ]; do
        echo -e "${RED}Domain name is required${NC}"
        read -p "Domain name: " domain_name
    done
    
    # Email for SSL
    read -p "Email for SSL certificates: " email
    while [ -z "$email" ]; do
        echo -e "${RED}Email is required${NC}"
        read -p "Email: " email
    done
    
    # Twilio credentials
    read -p "Twilio Account SID: " twilio_sid
    read -s -p "Twilio Auth Token: " twilio_auth
    echo
    read -p "Twilio Verify Service SID: " twilio_verify
    
    # Optional: Stellar
    read -p "Stellar Secret Key (optional, press Enter to skip): " stellar_key
    
    # Save to environment file
    cat > .env.production.auto << EOF
DOMAIN_NAME=$domain_name
EMAIL=$email
TWILIO_ACCOUNT_SID=$twilio_sid
TWILIO_AUTH_TOKEN=$twilio_auth
TWILIO_VERIFY_SID=$twilio_verify
STELLAR_SECRET_KEY=$stellar_key
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
EOF
    
    echo -e "${GREEN}✓ Configuration saved${NC}"
}

# Function to deploy infrastructure
deploy_infrastructure() {
    echo -e "${YELLOW}Deploying AWS infrastructure with Terraform...${NC}"
    
    cd infrastructure/terraform
    
    # Initialize Terraform
    terraform init
    
    # Create terraform.tfvars
    cat > terraform.tfvars << EOF
aws_region = "us-east-1"
domain_name = "$domain_name"
ssh_key_name = "cyphr-key"
EOF
    
    # Plan deployment
    terraform plan -out=tfplan
    
    # Apply deployment
    terraform apply tfplan
    
    # Get outputs
    SERVER_IP=$(terraform output -raw server_public_ip)
    echo -e "${GREEN}✓ Infrastructure deployed${NC}"
    echo -e "${GREEN}Server IP: $SERVER_IP${NC}"
    
    cd ../..
}

# Function to deploy application
deploy_application() {
    echo -e "${YELLOW}Deploying application to server...${NC}"
    
    # Wait for server to be ready
    echo "Waiting for server to be ready..."
    sleep 60
    
    # Copy files to server
    scp -i ~/.ssh/cyphr-key.pem -o StrictHostKeyChecking=no \
        -r ./* ubuntu@$SERVER_IP:/var/www/cyphr/
    
    # Copy environment file
    scp -i ~/.ssh/cyphr-key.pem -o StrictHostKeyChecking=no \
        .env.production.auto ubuntu@$SERVER_IP:/var/www/cyphr/.env.production.server
    
    # SSH and setup
    ssh -i ~/.ssh/cyphr-key.pem -o StrictHostKeyChecking=no ubuntu@$SERVER_IP << 'ENDSSH'
        cd /var/www/cyphr
        
        # Install dependencies
        npm install
        
        # Build application
        npm run build
        
        # Start services
        docker-compose up -d
        pm2 start ecosystem.config.js --env production
        pm2 save
        
        # Setup SSL
        sudo certbot --nginx -d $domain_name -d www.$domain_name \
            --non-interactive --agree-tos -m $email
        
        # Restart services
        sudo systemctl restart nginx
        pm2 restart all
        
        echo "Deployment complete!"
ENDSSH
    
    echo -e "${GREEN}✓ Application deployed${NC}"
}

# Function to setup monitoring
setup_monitoring() {
    echo -e "${YELLOW}Setting up monitoring...${NC}"
    
    ssh -i ~/.ssh/cyphr-key.pem ubuntu@$SERVER_IP << 'ENDSSH'
        # Setup monitoring script
        cd /var/www/cyphr
        chmod +x scripts/monitoring.sh
        nohup ./scripts/monitoring.sh > /var/log/cyphr/monitoring.log 2>&1 &
        
        # Setup backup cron
        (crontab -l 2>/dev/null; echo "0 2 * * * /var/www/cyphr/scripts/backup.sh") | crontab -
        
        # Setup log rotation
        sudo tee /etc/logrotate.d/cyphr << EOF
/var/log/cyphr/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 640 ubuntu ubuntu
    sharedscripts
}
EOF
        
        echo "Monitoring configured!"
ENDSSH
    
    echo -e "${GREEN}✓ Monitoring setup complete${NC}"
}

# Function to verify deployment
verify_deployment() {
    echo -e "${YELLOW}Verifying deployment...${NC}"
    
    # Check health endpoint
    if curl -f https://$domain_name/health &> /dev/null; then
        echo -e "${GREEN}✓ Health check passed${NC}"
    else
        echo -e "${RED}✗ Health check failed${NC}"
    fi
    
    # Check API
    if curl -f https://$domain_name/api/health &> /dev/null; then
        echo -e "${GREEN}✓ API check passed${NC}"
    else
        echo -e "${RED}✗ API check failed${NC}"
    fi
    
    # Check SSL
    if curl -f https://$domain_name &> /dev/null; then
        echo -e "${GREEN}✓ SSL working${NC}"
    else
        echo -e "${RED}✗ SSL not working${NC}"
    fi
}

# Main deployment flow
main() {
    echo -e "${BLUE}Starting automated deployment...${NC}"
    
    # Step 1: Check prerequisites
    check_prerequisites
    
    # Step 2: Configure AWS
    configure_aws
    
    # Step 3: Generate SSH keys
    generate_ssh_keys
    
    # Step 4: Get user inputs
    get_user_inputs
    
    # Step 5: Deploy infrastructure
    deploy_infrastructure
    
    # Step 6: Deploy application
    deploy_application
    
    # Step 7: Setup monitoring
    setup_monitoring
    
    # Step 8: Verify deployment
    verify_deployment
    
    echo "
╔══════════════════════════════════════════════════════════╗
║               🎉 DEPLOYMENT COMPLETE! 🎉                ║
╚══════════════════════════════════════════════════════════╝

Your application is now live at:
🌐 https://$domain_name

Server Details:
📍 IP Address: $SERVER_IP
🔑 SSH: ssh -i ~/.ssh/cyphr-key.pem ubuntu@$SERVER_IP

Monitoring:
📊 PM2: pm2 monit
📈 Logs: pm2 logs
🐳 Docker: docker-compose ps

Next Steps:
1. Update DNS records to point to $SERVER_IP
2. Test all functionality
3. Configure backup destination
4. Set up monitoring alerts

Need help? Check logs at:
- Application: /var/log/cyphr/
- Nginx: /var/log/nginx/
- PM2: ~/.pm2/logs/
"
}

# Run main function
main