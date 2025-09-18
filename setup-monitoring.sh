#!/bin/bash

echo "🔍 Setting up Production Monitoring for Cyphr Messenger"

# Create monitoring configuration
cat > monitoring-config.json << 'EOF'
{
  "name": "cyphr-messenger",
  "monitoring": {
    "healthCheck": {
      "url": "http://localhost:3001/health",
      "interval": 30000,
      "timeout": 5000,
      "retries": 3
    },
    "metrics": {
      "cpu": true,
      "memory": true,
      "disk": true,
      "network": true,
      "responseTime": true
    },
    "alerts": {
      "email": "admin@cyphrmessenger.app",
      "slack": "",
      "thresholds": {
        "cpu": 80,
        "memory": 90,
        "responseTime": 1000,
        "errorRate": 5
      }
    },
    "logs": {
      "level": "info",
      "rotation": "daily",
      "retention": 7,
      "path": "/var/log/cyphr"
    }
  }
}
EOF

# Create PM2 ecosystem file for production
cat > ecosystem.config.production.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'cyphr-backend',
      script: './server.ts',
      interpreter: 'tsx',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
      restart_delay: 4000
    },
    {
      name: 'cyphr-websocket',
      script: './websocket-server.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: './logs/websocket-error.log',
      out_file: './logs/websocket-out.log',
      log_file: './logs/websocket-combined.log',
      time: true,
      watch: false,
      max_memory_restart: '512M'
    }
  ]
};
EOF

# Create health check script
cat > health-check.mjs << 'EOF'
#!/usr/bin/env node
import fetch from 'node-fetch';
import nodemailer from 'nodemailer';

const SERVICES = [
  { name: 'Backend API', url: 'http://localhost:3001/health' },
  { name: 'Frontend', url: 'http://localhost:5173/' },
  { name: 'WebSocket', url: 'http://localhost:3002/health' },
  { name: 'Production', url: 'https://app.cyphrmessenger.app/health' }
];

async function checkHealth() {
  const results = [];
  
  for (const service of SERVICES) {
    try {
      const response = await fetch(service.url, { timeout: 5000 });
      results.push({
        service: service.name,
        status: response.ok ? 'UP' : 'DOWN',
        statusCode: response.status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      results.push({
        service: service.name,
        status: 'DOWN',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Check if any service is down
  const downServices = results.filter(r => r.status === 'DOWN');
  
  if (downServices.length > 0) {
    console.error('⚠️ Services Down:', downServices);
    // Send alert (implement email/slack notification here)
  } else {
    console.log('✅ All services healthy');
  }
  
  return results;
}

// Run health check
if (import.meta.url === `file://${process.argv[1]}`) {
  checkHealth()
    .then(results => console.log(JSON.stringify(results, null, 2)))
    .catch(console.error);
}

export { checkHealth };
EOF

# Create uptime monitoring script
cat > monitor.sh << 'EOF'
#!/bin/bash

# Cyphr Messenger Monitoring Script

LOG_DIR="/var/log/cyphr"
mkdir -p $LOG_DIR

# Function to check service
check_service() {
    local SERVICE_NAME=$1
    local SERVICE_URL=$2
    
    if curl -f -s "$SERVICE_URL" > /dev/null; then
        echo "$(date): $SERVICE_NAME is UP" >> $LOG_DIR/uptime.log
        return 0
    else
        echo "$(date): $SERVICE_NAME is DOWN" >> $LOG_DIR/uptime.log
        # Send alert
        send_alert "$SERVICE_NAME is DOWN"
        return 1
    fi
}

# Function to send alerts
send_alert() {
    local MESSAGE=$1
    echo "ALERT: $MESSAGE" >> $LOG_DIR/alerts.log
    
    # Send to Discord/Slack webhook (add your webhook URL)
    # curl -X POST -H 'Content-type: application/json' \
    #     --data "{\"text\":\"🚨 Cyphr Alert: $MESSAGE\"}" \
    #     YOUR_WEBHOOK_URL
}

# Monitor CPU and Memory
check_resources() {
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    MEM_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
    
    echo "$(date): CPU: ${CPU_USAGE}%, Memory: ${MEM_USAGE}%" >> $LOG_DIR/resources.log
    
    # Alert if thresholds exceeded
    if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
        send_alert "High CPU usage: ${CPU_USAGE}%"
    fi
    
    if (( $(echo "$MEM_USAGE > 90" | bc -l) )); then
        send_alert "High memory usage: ${MEM_USAGE}%"
    fi
}

# Main monitoring loop
while true; do
    check_service "Backend" "http://localhost:3001/health"
    check_service "Frontend" "http://localhost:5173/"
    check_resources
    sleep 30
done
EOF

chmod +x health-check.mjs monitor.sh

# Create DNS configuration instructions
cat > dns-setup.md << 'EOF'
# DNS Configuration for Cyphr Messenger

## Required DNS Records

### Main Domain
```
Type: A
Name: app
Value: 18.207.49.24
TTL: 300
```

### API Subdomain
```
Type: A
Name: api
Value: 18.207.49.24
TTL: 300
```

### WebSocket Subdomain
```
Type: A
Name: ws
Value: 18.207.49.24
TTL: 300
```

## Cloudflare Configuration (if using)

1. **SSL/TLS Setting**: Full (strict)
2. **Always Use HTTPS**: ON
3. **HTTP Strict Transport Security (HSTS)**: Enable
4. **Minimum TLS Version**: 1.2
5. **Opportunistic Encryption**: ON
6. **TLS 1.3**: ON
7. **Automatic HTTPS Rewrites**: ON

## Verification

After DNS propagation (5-30 minutes), verify with:

```bash
dig app.cyphrmessenger.app
nslookup app.cyphrmessenger.app
curl -I https://app.cyphrmessenger.app
```

## Production URLs

- Frontend: https://app.cyphrmessenger.app
- API: https://api.cyphrmessenger.app
- WebSocket: wss://ws.cyphrmessenger.app
EOF

echo "
✅ Monitoring Setup Complete!

FILES CREATED:
- monitoring-config.json - Monitoring configuration
- ecosystem.config.production.js - PM2 production config
- health-check.mjs - Health check script
- monitor.sh - Continuous monitoring script
- dns-setup.md - DNS configuration guide

NEXT STEPS:
1. Configure DNS records as per dns-setup.md
2. Deploy to production server
3. Start monitoring: ./monitor.sh &
4. Setup PM2: pm2 start ecosystem.config.production.js

MONITORING DASHBOARD:
- PM2 Web: pm2 web
- Logs: tail -f logs/*.log
"