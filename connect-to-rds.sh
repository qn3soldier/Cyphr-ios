#!/bin/bash

# AWS RDS Connection Script for Cyphr Messenger
# Created: 2025-09-04

echo "🔌 Connecting to AWS RDS PostgreSQL..."

# RDS Connection Details
export RDS_HOST="cyphr-messenger-prod.cgni4my4o6a2.us-east-1.rds.amazonaws.com"
export RDS_PORT="5432"
export RDS_USER="cyphr_admin"
export RDS_PASSWORD="CyphrRDS2025Secure!"
export RDS_DATABASE="postgres"

# Connect using psql
PGPASSWORD=$RDS_PASSWORD psql \
  --host=$RDS_HOST \
  --port=$RDS_PORT \
  --username=$RDS_USER \
  --dbname=$RDS_DATABASE \
  "$@"