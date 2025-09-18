#!/bin/bash

# Cyphr Messenger - Production Monitoring Script
# Monitors application health and sends alerts

# Configuration
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""}
EMAIL_TO=${EMAIL_TO:-"admin@cyphrmessenger.com"}
APP_URL="https://cyphrmessenger.com"
CHECK_INTERVAL=60  # seconds
ERROR_THRESHOLD=3  # consecutive failures before alert

# Counters
HEALTH_FAILURES=0
API_FAILURES=0
WS_FAILURES=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to send Slack notification
send_slack_alert() {
    if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Cyphr Alert: $1\"}" \
            $SLACK_WEBHOOK_URL
    fi
}

# Function to send email alert
send_email_alert() {
    echo "$1" | mail -s "Cyphr Alert" $EMAIL_TO
}

# Function to check service health
check_health() {
    response=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/health)
    if [ $response -eq 200 ]; then
        echo -e "${GREEN}✓ Health check passed${NC}"
        HEALTH_FAILURES=0
        return 0
    else
        HEALTH_FAILURES=$((HEALTH_FAILURES+1))
        echo -e "${RED}✗ Health check failed (attempt $HEALTH_FAILURES)${NC}"
        if [ $HEALTH_FAILURES -ge $ERROR_THRESHOLD ]; then
            send_slack_alert "Health check failed $HEALTH_FAILURES times!"
            send_email_alert "Health check failed at $APP_URL/health"
        fi
        return 1
    fi
}

# Function to check API
check_api() {
    response=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/api/health)
    if [ $response -eq 200 ]; then
        echo -e "${GREEN}✓ API check passed${NC}"
        API_FAILURES=0
        return 0
    else
        API_FAILURES=$((API_FAILURES+1))
        echo -e "${RED}✗ API check failed (attempt $API_FAILURES)${NC}"
        if [ $API_FAILURES -ge $ERROR_THRESHOLD ]; then
            send_slack_alert "API check failed $API_FAILURES times!"
        fi
        return 1
    fi
}

# Function to check disk space
check_disk_space() {
    usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $usage -gt 80 ]; then
        echo -e "${YELLOW}⚠ Disk usage high: ${usage}%${NC}"
        send_slack_alert "Disk usage is at ${usage}%"
    else
        echo -e "${GREEN}✓ Disk usage: ${usage}%${NC}"
    fi
}

# Function to check memory
check_memory() {
    memory=$(free -m | awk 'NR==2{printf "%.1f", $3*100/$2}')
    if (( $(echo "$memory > 80" | bc -l) )); then
        echo -e "${YELLOW}⚠ Memory usage high: ${memory}%${NC}"
        send_slack_alert "Memory usage is at ${memory}%"
    else
        echo -e "${GREEN}✓ Memory usage: ${memory}%${NC}"
    fi
}

# Function to check PM2 processes
check_pm2() {
    pm2_status=$(pm2 jlist 2>/dev/null)
    if [ $? -eq 0 ]; then
        online_count=$(echo $pm2_status | jq '[.[] | select(.pm2_env.status == "online")] | length')
        total_count=$(echo $pm2_status | jq '. | length')
        
        if [ $online_count -eq $total_count ]; then
            echo -e "${GREEN}✓ All PM2 processes online ($online_count/$total_count)${NC}"
        else
            echo -e "${RED}✗ PM2 processes offline ($online_count/$total_count)${NC}"
            send_slack_alert "PM2 processes offline: $online_count/$total_count running"
        fi
    else
        echo -e "${YELLOW}⚠ PM2 not running${NC}"
    fi
}

# Function to check Docker containers
check_docker() {
    running=$(docker ps --format "table {{.Names}}\t{{.Status}}" | grep -c "Up")
    total=$(docker ps -a --format "table {{.Names}}" | tail -n +2 | wc -l)
    
    if [ $running -eq $total ]; then
        echo -e "${GREEN}✓ All Docker containers running ($running/$total)${NC}"
    else
        echo -e "${RED}✗ Docker containers down ($running/$total)${NC}"
        send_slack_alert "Docker containers down: $running/$total running"
    fi
}

# Function to check SSL certificate
check_ssl() {
    expiry_date=$(echo | openssl s_client -servername $APP_URL -connect $APP_URL:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
    expiry_epoch=$(date -d "$expiry_date" +%s)
    current_epoch=$(date +%s)
    days_left=$(( ($expiry_epoch - $current_epoch) / 86400 ))
    
    if [ $days_left -lt 7 ]; then
        echo -e "${RED}✗ SSL certificate expires in $days_left days${NC}"
        send_slack_alert "SSL certificate expires in $days_left days!"
    elif [ $days_left -lt 30 ]; then
        echo -e "${YELLOW}⚠ SSL certificate expires in $days_left days${NC}"
    else
        echo -e "${GREEN}✓ SSL certificate valid for $days_left days${NC}"
    fi
}

# Function to check response time
check_response_time() {
    response_time=$(curl -o /dev/null -s -w '%{time_total}' $APP_URL)
    response_ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)
    
    if [ $response_ms -gt 1000 ]; then
        echo -e "${RED}✗ Response time: ${response_ms}ms (>1s)${NC}"
        send_slack_alert "Slow response time: ${response_ms}ms"
    elif [ $response_ms -gt 500 ]; then
        echo -e "${YELLOW}⚠ Response time: ${response_ms}ms${NC}"
    else
        echo -e "${GREEN}✓ Response time: ${response_ms}ms${NC}"
    fi
}

# Main monitoring loop
echo "🔍 Starting Cyphr Messenger Monitoring"
echo "Checking every $CHECK_INTERVAL seconds..."
echo ""

while true; do
    echo "========================"
    echo "$(date '+%Y-%m-%d %H:%M:%S')"
    echo "========================"
    
    check_health
    check_api
    check_disk_space
    check_memory
    check_pm2
    check_docker
    check_ssl
    check_response_time
    
    echo ""
    sleep $CHECK_INTERVAL
done