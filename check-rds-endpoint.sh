#!/bin/bash

# 🔍 CYPHR MESSENGER - RDS ENDPOINT CHECKER
# 
# This script helps you find your actual RDS endpoint before running migration

echo "🔍 CYPHR MESSENGER - RDS ENDPOINT CHECKER"
echo "========================================"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first:"
    echo "   brew install awscli"
    echo "   or visit: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check AWS credentials
echo "🔑 Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Run:"
    echo "   aws configure"
    echo "   Then enter your Access Key ID, Secret Access Key, and region"
    exit 1
fi

CALLER=$(aws sts get-caller-identity --query 'Arn' --output text)
echo "✅ AWS credentials valid: $CALLER"

# List RDS instances
echo ""
echo "📊 Finding RDS PostgreSQL instances..."

INSTANCES=$(aws rds describe-db-instances \
    --query 'DBInstances[?Engine==`postgres`].[DBInstanceIdentifier,Endpoint.Address,DBInstanceStatus,DBInstanceClass]' \
    --output table)

if [[ -z "$INSTANCES" || "$INSTANCES" == *"None"* ]]; then
    echo "❌ No PostgreSQL RDS instances found in current region"
    echo ""
    echo "🚀 TO CREATE RDS INSTANCE:"
    echo "aws rds create-db-instance \\"
    echo "  --db-instance-identifier cyphr-messenger-db \\"
    echo "  --db-instance-class db.t3.micro \\"
    echo "  --engine postgres \\"
    echo "  --master-username postgres \\"
    echo "  --master-user-password 'Cyphr2025EnterpriseSecurePassword123' \\"
    echo "  --allocated-storage 20 \\"
    echo "  --backup-retention-period 7 \\"
    echo "  --storage-encrypted \\"
    echo "  --publicly-accessible"
    exit 1
fi

echo "$INSTANCES"

# Get the first PostgreSQL instance endpoint
ENDPOINT=$(aws rds describe-db-instances \
    --query 'DBInstances[?Engine==`postgres`] | [0].Endpoint.Address' \
    --output text)

if [[ "$ENDPOINT" != "None" && -n "$ENDPOINT" ]]; then
    echo ""
    echo "✅ FOUND RDS ENDPOINT: $ENDPOINT"
    echo ""
    echo "📝 UPDATE YOUR MIGRATION SCRIPTS:"
    echo "Replace this line in migrate-to-rds-enterprise.mjs:"
    echo "  host: 'cyphr-messenger-db.c123abc456def.us-east-1.rds.amazonaws.com',"
    echo "With:"
    echo "  host: '$ENDPOINT',"
    echo ""
    echo "🧪 TEST CONNECTION:"
    echo "node test-rds-migration.mjs"
    echo ""
    echo "🚀 RUN MIGRATION:"
    echo "node migrate-to-rds-enterprise.mjs"
else
    echo "❌ No endpoint found"
fi

# Check security groups
echo ""
echo "🔒 Checking security groups..."
SECURITY_GROUPS=$(aws rds describe-db-instances \
    --query 'DBInstances[?Engine==`postgres`] | [0].VpcSecurityGroups[0].VpcSecurityGroupId' \
    --output text)

if [[ "$SECURITY_GROUPS" != "None" && -n "$SECURITY_GROUPS" ]]; then
    echo "🛡️  Security Group: $SECURITY_GROUPS"
    echo ""
    echo "⚠️  IMPORTANT: Ensure port 5432 is open in security group:"
    echo "aws ec2 authorize-security-group-ingress \\"
    echo "  --group-id $SECURITY_GROUPS \\"
    echo "  --protocol tcp \\"
    echo "  --port 5432 \\"
    echo "  --cidr 0.0.0.0/0"  # Note: Use specific IP in production
fi

echo ""
echo "🎯 NEXT STEPS:"
echo "1. Update RDS endpoint in migration scripts"
echo "2. Ensure security group allows port 5432"
echo "3. Run test-rds-migration.mjs to verify connection"
echo "4. Run migrate-to-rds-enterprise.mjs for full migration"