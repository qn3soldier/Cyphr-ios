#!/bin/bash

# Cyphr Messenger - Automated Backup Script
# Backs up database, files, and configurations

set -e

# Configuration
BACKUP_DIR="/var/backups/cyphr"
S3_BUCKET="s3://cyphr-backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="cyphr_backup_${TIMESTAMP}"

# Supabase Configuration
SUPABASE_URL="https://fkhwhplufjzlicccgbrf.supabase.co"
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY:-""}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create backup directory
mkdir -p $BACKUP_DIR

echo -e "${GREEN}Starting backup: $BACKUP_NAME${NC}"

# Function to backup database
backup_database() {
    echo -e "${YELLOW}Backing up database...${NC}"
    
    # Export Supabase data using REST API
    curl -X GET \
        "${SUPABASE_URL}/rest/v1/?select=*" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -o "${BACKUP_DIR}/${BACKUP_NAME}_database.json"
    
    # Compress database backup
    gzip "${BACKUP_DIR}/${BACKUP_NAME}_database.json"
    
    echo -e "${GREEN}✓ Database backup complete${NC}"
}

# Function to backup application files
backup_files() {
    echo -e "${YELLOW}Backing up application files...${NC}"
    
    # Create tar archive of application
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}_files.tar.gz" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='logs' \
        --exclude='dist' \
        /var/www/cyphr
    
    echo -e "${GREEN}✓ Files backup complete${NC}"
}

# Function to backup configurations
backup_configs() {
    echo -e "${YELLOW}Backing up configurations...${NC}"
    
    # Create configs directory
    mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}_configs"
    
    # Copy configuration files
    cp /var/www/cyphr/.env.production.server "${BACKUP_DIR}/${BACKUP_NAME}_configs/" 2>/dev/null || true
    cp /var/www/cyphr/ecosystem.config.js "${BACKUP_DIR}/${BACKUP_NAME}_configs/" 2>/dev/null || true
    cp /etc/nginx/sites-available/cyphr "${BACKUP_DIR}/${BACKUP_NAME}_configs/nginx.conf" 2>/dev/null || true
    
    # Copy PM2 configuration
    pm2 save
    cp ~/.pm2/dump.pm2 "${BACKUP_DIR}/${BACKUP_NAME}_configs/pm2_dump.pm2" 2>/dev/null || true
    
    # Create tar archive
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}_configs.tar.gz" \
        -C "${BACKUP_DIR}" \
        "${BACKUP_NAME}_configs"
    
    # Clean up temp directory
    rm -rf "${BACKUP_DIR}/${BACKUP_NAME}_configs"
    
    echo -e "${GREEN}✓ Configurations backup complete${NC}"
}

# Function to backup Docker volumes
backup_docker_volumes() {
    echo -e "${YELLOW}Backing up Docker volumes...${NC}"
    
    # Get list of volumes
    volumes=$(docker volume ls -q | grep cyphr || true)
    
    if [ ! -z "$volumes" ]; then
        for volume in $volumes; do
            docker run --rm \
                -v $volume:/data \
                -v $BACKUP_DIR:/backup \
                alpine tar -czf "/backup/${BACKUP_NAME}_volume_${volume}.tar.gz" -C /data .
        done
        echo -e "${GREEN}✓ Docker volumes backup complete${NC}"
    else
        echo -e "${YELLOW}No Docker volumes to backup${NC}"
    fi
}

# Function to upload to S3
upload_to_s3() {
    echo -e "${YELLOW}Uploading to S3...${NC}"
    
    if command -v aws &> /dev/null; then
        # Upload all backup files to S3
        aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}_database.json.gz" $S3_BUCKET/
        aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}_files.tar.gz" $S3_BUCKET/
        aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}_configs.tar.gz" $S3_BUCKET/
        
        # Upload Docker volume backups
        for file in ${BACKUP_DIR}/${BACKUP_NAME}_volume_*.tar.gz; do
            [ -f "$file" ] && aws s3 cp "$file" $S3_BUCKET/
        done
        
        echo -e "${GREEN}✓ S3 upload complete${NC}"
    else
        echo -e "${YELLOW}AWS CLI not installed, skipping S3 upload${NC}"
    fi
}

# Function to clean old backups
cleanup_old_backups() {
    echo -e "${YELLOW}Cleaning old backups...${NC}"
    
    # Remove local backups older than retention period
    find $BACKUP_DIR -name "cyphr_backup_*" -type f -mtime +$RETENTION_DAYS -delete
    
    # Clean S3 backups if AWS CLI is available
    if command -v aws &> /dev/null; then
        aws s3 ls $S3_BUCKET/ | while read -r line; do
            createDate=$(echo $line | awk '{print $1" "$2}')
            createDate=$(date -d "$createDate" +%s)
            olderThan=$(date -d "$RETENTION_DAYS days ago" +%s)
            if [[ $createDate -lt $olderThan ]]; then
                fileName=$(echo $line | awk '{print $4}')
                if [[ $fileName == cyphr_backup_* ]]; then
                    aws s3 rm $S3_BUCKET/$fileName
                fi
            fi
        done
    fi
    
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Function to verify backup
verify_backup() {
    echo -e "${YELLOW}Verifying backup integrity...${NC}"
    
    # Check if backup files exist and are not empty
    if [ -s "${BACKUP_DIR}/${BACKUP_NAME}_database.json.gz" ] && \
       [ -s "${BACKUP_DIR}/${BACKUP_NAME}_files.tar.gz" ] && \
       [ -s "${BACKUP_DIR}/${BACKUP_NAME}_configs.tar.gz" ]; then
        echo -e "${GREEN}✓ Backup verification passed${NC}"
        return 0
    else
        echo -e "${RED}✗ Backup verification failed${NC}"
        return 1
    fi
}

# Function to send notification
send_notification() {
    status=$1
    message=$2
    
    # Slack notification
    if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
        if [ "$status" = "success" ]; then
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"✅ Backup successful: $message\"}" \
                $SLACK_WEBHOOK_URL
        else
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"❌ Backup failed: $message\"}" \
                $SLACK_WEBHOOK_URL
        fi
    fi
    
    # Email notification
    if [ ! -z "$EMAIL_TO" ]; then
        echo "$message" | mail -s "Cyphr Backup $status" $EMAIL_TO
    fi
}

# Main backup process
main() {
    echo "==========================================="
    echo "Cyphr Messenger Backup"
    echo "Time: $(date)"
    echo "==========================================="
    
    # Run backups
    backup_database
    backup_files
    backup_configs
    backup_docker_volumes
    
    # Verify backup
    if verify_backup; then
        # Upload to S3
        upload_to_s3
        
        # Clean old backups
        cleanup_old_backups
        
        # Calculate backup size
        total_size=$(du -sh ${BACKUP_DIR}/${BACKUP_NAME}* | awk '{sum+=$1} END {print sum}')
        
        echo -e "${GREEN}✨ Backup completed successfully!${NC}"
        echo "Backup name: $BACKUP_NAME"
        echo "Total size: ${total_size}MB"
        echo "Location: $BACKUP_DIR"
        
        send_notification "success" "Backup $BACKUP_NAME completed. Size: ${total_size}MB"
    else
        echo -e "${RED}Backup failed!${NC}"
        send_notification "failure" "Backup $BACKUP_NAME failed"
        exit 1
    fi
}

# Run main function
main

# Add to crontab for daily backups:
# 0 2 * * * /var/www/cyphr/scripts/backup.sh > /var/log/cyphr/backup.log 2>&1