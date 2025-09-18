# 📦 CYPHR MESSENGER - DEPLOYMENT INSTRUCTIONS

## 🎯 Quick Deploy Guide

This guide will help you deploy Cyphr Messenger to AWS EC2 in production.

---

## 📋 Prerequisites

Before starting, ensure you have:

1. **AWS Account** with EC2 access
2. **Domain Name** (e.g., cyphrmessenger.com)
3. **API Keys**:
   - Twilio Auth Token
   - Stellar Secret Key (optional, for wallet)
4. **GitHub Repository** (for CI/CD)

---

## 🚀 Step-by-Step Deployment

### Step 1: Launch AWS EC2 Instance

1. **Login to AWS Console**
2. **Launch EC2 Instance**:
   - AMI: Ubuntu Server 22.04 LTS
   - Instance Type: t3.large (minimum)
   - Storage: 50GB SSD
   - Security Group: Create new with rules:
     ```
     SSH (22) - Your IP
     HTTP (80) - 0.0.0.0/0
     HTTPS (443) - 0.0.0.0/0
     Custom TCP (3001) - 0.0.0.0/0
     Custom TCP (3002) - 0.0.0.0/0
     ```
3. **Create/Select Key Pair** for SSH access
4. **Allocate Elastic IP** and associate with instance

### Step 2: Connect to EC2 Instance

```bash
# Replace with your key and IP
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

### Step 3: Clone Repository

```bash
# Clone the project
cd /home/ubuntu
git clone https://github.com/your-repo/cyphr-messenger.git
cd cyphr-messenger/project
```

### Step 4: Set Environment Variables

```bash
# Copy production environment template
cp .env.production.server.example .env.production.server

# Edit with your actual values
nano .env.production.server
```

**Required values to update:**
```env
TWILIO_AUTH_TOKEN=your_actual_twilio_auth_token
STELLAR_SECRET_KEY=your_stellar_secret_key
JWT_SECRET=generate_random_32_char_string
ENCRYPTION_KEY=generate_random_32_byte_key
```

### Step 5: Run Automated Deployment

```bash
# Make deployment script executable
chmod +x scripts/deploy-aws.sh

# Run deployment (replace with your domain and email)
./scripts/deploy-aws.sh cyphrmessenger.com admin@cyphrmessenger.com
```

This script will:
- Install all dependencies (Docker, Node.js, Nginx, etc.)
- Build the application
- Setup SSL certificates
- Configure firewall
- Start all services

### Step 6: Configure DNS

1. **Go to your DNS provider** (e.g., Cloudflare, Route53)
2. **Add A Records**:
   ```
   Type: A
   Name: @
   Value: YOUR_EC2_ELASTIC_IP
   
   Type: A
   Name: www
   Value: YOUR_EC2_ELASTIC_IP
   ```
3. **Wait for DNS propagation** (5-30 minutes)

### Step 7: Verify Deployment

```bash
# Check services status
pm2 status
docker-compose ps
sudo nginx -t

# Test endpoints
curl https://your-domain.com/health
curl https://your-domain.com/api/health

# Check logs
pm2 logs
docker-compose logs
```

---

## 🔧 Manual Configuration Steps

### Update Production URLs

1. **Update Frontend Environment**:
```bash
nano .env.production
```
Update:
```env
VITE_BACKEND_URL=https://your-domain.com/api
VITE_WEBSOCKET_URL=wss://your-domain.com
```

2. **Rebuild Frontend**:
```bash
npm run build
```

### Setup Monitoring

1. **Start Monitoring Script**:
```bash
chmod +x scripts/monitoring.sh
nohup ./scripts/monitoring.sh > /var/log/cyphr/monitoring.log 2>&1 &
```

2. **Setup Automated Backups**:
```bash
# Add to crontab
crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /var/www/cyphr/scripts/backup.sh > /var/log/cyphr/backup.log 2>&1
```

### Configure CloudWatch (Optional)

1. **Install CloudWatch Agent**:
```bash
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
```

2. **Configure and Start**:
```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
sudo systemctl start amazon-cloudwatch-agent
```

---

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### 1. Port Already in Use
```bash
# Find process using port
sudo lsof -i :3001
# Kill process
sudo kill -9 PID
```

#### 2. SSL Certificate Issues
```bash
# Renew certificate manually
sudo certbot renew --force-renewal
sudo nginx -s reload
```

#### 3. Database Connection Issues
```bash
# Check Supabase connection
curl https://fkhwhplufjzlicccgbrf.supabase.co/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"
```

#### 4. PM2 Process Crashes
```bash
# View error logs
pm2 logs cyphr-backend --err
# Restart with more memory
pm2 delete cyphr-backend
pm2 start ecosystem.config.js --max-memory-restart 2G
```

#### 5. Nginx 502 Bad Gateway
```bash
# Check backend is running
curl http://localhost:3001/health
# Restart services
docker-compose restart
pm2 restart all
sudo nginx -s reload
```

---

## 📊 Performance Optimization

### 1. Enable Swap (if needed)
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2. Optimize Node.js
```bash
# Set Node options in ecosystem.config.js
env: {
  NODE_OPTIONS: '--max-old-space-size=4096'
}
```

### 3. Enable Redis Caching
```bash
# Redis is included in docker-compose
docker-compose up -d redis
```

---

## 🔒 Security Hardening

### 1. Setup Fail2ban
```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 2. Disable Root Login
```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

### 3. Setup Automatic Updates
```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 📈 Scaling Guide

### Horizontal Scaling
1. **Launch additional EC2 instances**
2. **Setup Application Load Balancer (ALB)**
3. **Configure Auto Scaling Group**
4. **Use RDS for database** (instead of Supabase)
5. **Setup ElastiCache for Redis**

### Vertical Scaling
1. **Stop EC2 instance**
2. **Change instance type** (e.g., t3.xlarge)
3. **Start instance**

---

## 🔄 Update Deployment

### Manual Update
```bash
cd /var/www/cyphr
git pull origin main
npm install
npm run build
pm2 restart all
docker-compose up -d --build
```

### Automated CI/CD
Push to main branch triggers automatic deployment via GitHub Actions.

---

## 📝 Maintenance Commands

```bash
# View logs
pm2 logs
docker-compose logs -f

# Restart services
pm2 restart all
docker-compose restart
sudo systemctl restart nginx

# Check disk space
df -h

# Check memory
free -m

# Check processes
htop

# Database backup
./scripts/backup.sh

# SSL renewal
sudo certbot renew

# Update system
sudo apt update && sudo apt upgrade
```

---

## 🆘 Support

### Logs Location
- Application: `/var/log/cyphr/`
- PM2: `~/.pm2/logs/`
- Nginx: `/var/log/nginx/`
- Docker: `docker-compose logs`

### Health Endpoints
- Frontend: `https://your-domain.com`
- Backend: `https://your-domain.com/api/health`
- WebSocket: `wss://your-domain.com/socket.io/`

### Monitoring
- PM2 Dashboard: `pm2 monit`
- Docker Stats: `docker stats`
- System: `htop`

---

## ✅ Post-Deployment Checklist

- [ ] All services running (PM2, Docker, Nginx)
- [ ] SSL certificate active
- [ ] DNS properly configured
- [ ] Health endpoints responding
- [ ] WebSocket connection working
- [ ] Database connected
- [ ] File uploads working
- [ ] Monitoring active
- [ ] Backups configured
- [ ] Firewall enabled
- [ ] Environment variables secure
- [ ] Logs being collected
- [ ] Error tracking setup
- [ ] Performance acceptable (<100ms)
- [ ] Security scan passed

---

## 🎉 Deployment Complete!

Your Cyphr Messenger is now live at: `https://your-domain.com`

**Next Steps:**
1. Test all features thoroughly
2. Setup monitoring alerts
3. Configure analytics
4. Plan scaling strategy
5. Schedule security audits

---

**Need Help?** Check logs first, then refer to troubleshooting section above.