#!/bin/bash

# Enable RDS Encryption at Rest for Cyphr Messenger Database
# This script should be run once to enable encryption on AWS RDS

echo "🔐 Enabling RDS Encryption at Rest for Cyphr Messenger"
echo "=================================================="

# Configuration
DB_INSTANCE="cyphr-messenger-prod"
REGION="us-east-1"
KMS_KEY_ALIAS="alias/cyphr-rds-encryption"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
echo "🔍 Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run 'aws configure'"
    exit 1
fi

echo "✅ AWS credentials verified"

# Create KMS key for RDS encryption
echo "🔑 Creating KMS key for RDS encryption..."
KMS_KEY_ID=$(aws kms create-key \
    --description "Cyphr Messenger RDS Encryption Key" \
    --region $REGION \
    --query 'KeyMetadata.KeyId' \
    --output text 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✅ KMS key created: $KMS_KEY_ID"
    
    # Create alias for easier management
    aws kms create-alias \
        --alias-name $KMS_KEY_ALIAS \
        --target-key-id $KMS_KEY_ID \
        --region $REGION
    
    echo "✅ KMS key alias created: $KMS_KEY_ALIAS"
else
    echo "⚠️ KMS key might already exist, checking..."
    KMS_KEY_ID=$(aws kms describe-key \
        --key-id $KMS_KEY_ALIAS \
        --region $REGION \
        --query 'KeyMetadata.KeyId' \
        --output text 2>/dev/null)
    
    if [ -z "$KMS_KEY_ID" ]; then
        echo "❌ Failed to create or find KMS key"
        exit 1
    fi
    echo "✅ Using existing KMS key: $KMS_KEY_ID"
fi

# Check current RDS encryption status
echo "🔍 Checking current RDS encryption status..."
ENCRYPTION_STATUS=$(aws rds describe-db-instances \
    --db-instance-identifier $DB_INSTANCE \
    --region $REGION \
    --query 'DBInstances[0].StorageEncrypted' \
    --output text 2>/dev/null)

if [ "$ENCRYPTION_STATUS" == "true" ] || [ "$ENCRYPTION_STATUS" == "True" ]; then
    echo "✅ RDS instance is already encrypted!"
    exit 0
fi

echo "⚠️ RDS instance is NOT encrypted. Creating encrypted snapshot..."

# Create snapshot of current database
SNAPSHOT_ID="cyphr-encryption-snapshot-$(date +%Y%m%d-%H%M%S)"
echo "📸 Creating database snapshot: $SNAPSHOT_ID"

aws rds create-db-snapshot \
    --db-instance-identifier $DB_INSTANCE \
    --db-snapshot-identifier $SNAPSHOT_ID \
    --region $REGION

# Wait for snapshot to complete
echo "⏳ Waiting for snapshot to complete (this may take 5-10 minutes)..."
aws rds wait db-snapshot-completed \
    --db-snapshot-identifier $SNAPSHOT_ID \
    --region $REGION

echo "✅ Snapshot created successfully"

# Create encrypted copy of snapshot
ENCRYPTED_SNAPSHOT_ID="${SNAPSHOT_ID}-encrypted"
echo "🔐 Creating encrypted copy of snapshot: $ENCRYPTED_SNAPSHOT_ID"

aws rds copy-db-snapshot \
    --source-db-snapshot-identifier $SNAPSHOT_ID \
    --target-db-snapshot-identifier $ENCRYPTED_SNAPSHOT_ID \
    --kms-key-id $KMS_KEY_ID \
    --region $REGION

# Wait for encrypted snapshot
echo "⏳ Waiting for encrypted snapshot to complete..."
aws rds wait db-snapshot-completed \
    --db-snapshot-identifier $ENCRYPTED_SNAPSHOT_ID \
    --region $REGION

echo "✅ Encrypted snapshot created"

# Restore from encrypted snapshot
NEW_DB_INSTANCE="${DB_INSTANCE}-encrypted"
echo "🔄 Restoring database from encrypted snapshot to: $NEW_DB_INSTANCE"

aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier $NEW_DB_INSTANCE \
    --db-snapshot-identifier $ENCRYPTED_SNAPSHOT_ID \
    --region $REGION

# Wait for new instance to be available
echo "⏳ Waiting for encrypted database to be available (10-15 minutes)..."
aws rds wait db-instance-available \
    --db-instance-identifier $NEW_DB_INSTANCE \
    --region $REGION

echo "✅ Encrypted database instance created"

# Update security group and parameters
echo "🔧 Copying security settings to new instance..."
OLD_SG=$(aws rds describe-db-instances \
    --db-instance-identifier $DB_INSTANCE \
    --region $REGION \
    --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
    --output text)

aws rds modify-db-instance \
    --db-instance-identifier $NEW_DB_INSTANCE \
    --vpc-security-group-ids $OLD_SG \
    --apply-immediately \
    --region $REGION

echo "✅ Security settings copied"

echo "=================================================="
echo "🎉 RDS ENCRYPTION SETUP COMPLETE!"
echo ""
echo "NEXT STEPS:"
echo "1. Update your application to use new endpoint:"
echo "   aws rds describe-db-instances --db-instance-identifier $NEW_DB_INSTANCE --query 'DBInstances[0].Endpoint.Address' --output text"
echo ""
echo "2. Test the new encrypted database thoroughly"
echo ""
echo "3. Once verified, delete the old unencrypted instance:"
echo "   aws rds delete-db-instance --db-instance-identifier $DB_INSTANCE --skip-final-snapshot"
echo ""
echo "4. Rename encrypted instance to original name (optional):"
echo "   aws rds modify-db-instance --db-instance-identifier $NEW_DB_INSTANCE --new-db-instance-identifier $DB_INSTANCE --apply-immediately"
echo ""
echo "=================================================="