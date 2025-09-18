#!/bin/bash

# Cyphr Messenger Monitoring Script for macOS

LOG_DIR="$HOME/.cyphr-logs"
mkdir -p $LOG_DIR

echo "🔍 Starting Cyphr Messenger Monitoring..."
echo "📂 Logs directory: $LOG_DIR"

# Function to check service
check_service() {
    local SERVICE_NAME=$1
    local SERVICE_URL=$2
    
    if curl -f -s -m 10 "$SERVICE_URL" > /dev/null; then
        echo "$(date): ✅ $SERVICE_NAME is UP" | tee -a $LOG_DIR/uptime.log
        return 0
    else
        echo "$(date): ❌ $SERVICE_NAME is DOWN" | tee -a $LOG_DIR/uptime.log
        send_alert "$SERVICE_NAME is DOWN"
        return 1
    fi
}

# Function to send alerts
send_alert() {
    local MESSAGE=$1
    echo "🚨 ALERT: $MESSAGE" | tee -a $LOG_DIR/alerts.log
}

# Monitor CPU and Memory (macOS compatible)
check_resources() {
    CPU_USAGE=$(top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')
    MEM_PRESSURE=$(memory_pressure | grep "System-wide memory free percentage" | awk '{print $5}' | sed 's/%//')
    
    echo "$(date): CPU: ${CPU_USAGE:-0}%, Memory Free: ${MEM_PRESSURE:-50}%" | tee -a $LOG_DIR/resources.log
    
    # Simple threshold checking
    if [[ -n "$CPU_USAGE" ]] && (( $(echo "$CPU_USAGE > 80" | bc -l 2>/dev/null) )); then
        send_alert "High CPU usage: ${CPU_USAGE}%"
    fi
}

# Single monitoring cycle
run_monitoring_cycle() {
    echo "🔄 Running monitoring cycle..."
    
    check_service "Local Backend" "http://localhost:3001/health"
    check_service "Local Frontend" "http://localhost:5173/"
    check_service "Production" "http://18.207.49.24/health"
    check_resources
    
    echo "✅ Monitoring cycle complete"
    echo "---"
}

# Run 5 monitoring cycles then exit
for i in {1..5}; do
    echo "📊 Monitoring Cycle $i/5"
    run_monitoring_cycle
    if [ $i -lt 5 ]; then
        sleep 10
    fi
done

echo "
📊 MONITORING RESULTS:

📂 Log Files:
- Uptime: $LOG_DIR/uptime.log
- Alerts: $LOG_DIR/alerts.log  
- Resources: $LOG_DIR/resources.log

📈 Recent Status:"

if [ -f "$LOG_DIR/uptime.log" ]; then
    echo "$(tail -5 $LOG_DIR/uptime.log)"
fi

echo "
✅ Monitoring complete!"