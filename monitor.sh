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
