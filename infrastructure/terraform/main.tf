# Cyphr Messenger - Complete AWS Infrastructure as Code
# This will create everything needed for production deployment

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.0"
}

# Variables
variable "aws_region" {
  description = "AWS region for deployment"
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domain name for the application"
  default     = "cyphrmessenger.com"
}

variable "ssh_key_name" {
  description = "Name of SSH key pair"
  default     = "cyphr-key"
}

# Provider
provider "aws" {
  region = var.aws_region
}

# VPC Configuration
resource "aws_vpc" "cyphr_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "cyphr-vpc"
    Project = "CyphrMessenger"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "cyphr_igw" {
  vpc_id = aws_vpc.cyphr_vpc.id

  tags = {
    Name = "cyphr-igw"
  }
}

# Public Subnet
resource "aws_subnet" "cyphr_public_subnet" {
  vpc_id                  = aws_vpc.cyphr_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "cyphr-public-subnet"
  }
}

# Route Table
resource "aws_route_table" "cyphr_public_rt" {
  vpc_id = aws_vpc.cyphr_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.cyphr_igw.id
  }

  tags = {
    Name = "cyphr-public-route-table"
  }
}

# Route Table Association
resource "aws_route_table_association" "cyphr_public_rta" {
  subnet_id      = aws_subnet.cyphr_public_subnet.id
  route_table_id = aws_route_table.cyphr_public_rt.id
}

# Security Group
resource "aws_security_group" "cyphr_sg" {
  name        = "cyphr-security-group"
  description = "Security group for Cyphr Messenger"
  vpc_id      = aws_vpc.cyphr_vpc.id

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Restrict to your IP in production
  }

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Backend API
  ingress {
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # WebSocket
  ingress {
    from_port   = 3002
    to_port     = 3002
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cyphr-security-group"
  }
}

# Key Pair
resource "aws_key_pair" "cyphr_key" {
  key_name   = var.ssh_key_name
  public_key = file("~/.ssh/cyphr-key.pub") # You'll need to generate this

  tags = {
    Name = "cyphr-ssh-key"
  }
}

# EC2 Instance
resource "aws_instance" "cyphr_server" {
  ami           = "ami-0c02fb55731490381" # Ubuntu 22.04 LTS in us-east-1
  instance_type = "t3.large"
  
  subnet_id                   = aws_subnet.cyphr_public_subnet.id
  vpc_security_group_ids      = [aws_security_group.cyphr_sg.id]
  key_name                    = aws_key_pair.cyphr_key.key_name
  associate_public_ip_address = true

  root_block_device {
    volume_type = "gp3"
    volume_size = 50
    encrypted   = true
  }

  user_data = file("${path.module}/user_data.sh")

  tags = {
    Name = "cyphr-production-server"
    Project = "CyphrMessenger"
    Environment = "Production"
  }
}

# Elastic IP
resource "aws_eip" "cyphr_eip" {
  domain = "vpc"
  instance = aws_instance.cyphr_server.id

  tags = {
    Name = "cyphr-elastic-ip"
  }
}

# Route53 Hosted Zone (Optional - if you want AWS to manage DNS)
resource "aws_route53_zone" "cyphr_zone" {
  name = var.domain_name

  tags = {
    Name = "cyphr-dns-zone"
  }
}

# Route53 A Records
resource "aws_route53_record" "cyphr_a" {
  zone_id = aws_route53_zone.cyphr_zone.zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [aws_eip.cyphr_eip.public_ip]
}

resource "aws_route53_record" "cyphr_www" {
  zone_id = aws_route53_zone.cyphr_zone.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.cyphr_eip.public_ip]
}

# S3 Bucket for Backups
resource "aws_s3_bucket" "cyphr_backups" {
  bucket = "cyphr-backups-${random_id.bucket_suffix.hex}"

  tags = {
    Name = "cyphr-backups"
    Project = "CyphrMessenger"
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 8
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "cyphr_backups_versioning" {
  bucket = aws_s3_bucket.cyphr_backups.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "cyphr_backups_encryption" {
  bucket = aws_s3_bucket.cyphr_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "cyphr_logs" {
  name              = "/aws/ec2/cyphr"
  retention_in_days = 30

  tags = {
    Name = "cyphr-logs"
    Project = "CyphrMessenger"
  }
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "cyphr-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "120"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors EC2 cpu utilization"

  dimensions = {
    InstanceId = aws_instance.cyphr_server.id
  }
}

# IAM Role for EC2
resource "aws_iam_role" "cyphr_ec2_role" {
  name = "cyphr-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Role Policy
resource "aws_iam_role_policy" "cyphr_ec2_policy" {
  name = "cyphr-ec2-policy"
  role = aws_iam_role.cyphr_ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:*",
          "cloudwatch:*",
          "logs:*"
        ]
        Resource = "*"
      }
    ]
  })
}

# Instance Profile
resource "aws_iam_instance_profile" "cyphr_profile" {
  name = "cyphr-ec2-profile"
  role = aws_iam_role.cyphr_ec2_role.name
}

# Outputs
output "server_public_ip" {
  value = aws_eip.cyphr_eip.public_ip
  description = "Public IP address of the server"
}

output "server_public_dns" {
  value = aws_instance.cyphr_server.public_dns
  description = "Public DNS of the server"
}

output "ssh_connection" {
  value = "ssh -i ~/.ssh/${var.ssh_key_name}.pem ubuntu@${aws_eip.cyphr_eip.public_ip}"
  description = "SSH connection command"
}

output "application_url" {
  value = "https://${var.domain_name}"
  description = "Application URL"
}

output "nameservers" {
  value = aws_route53_zone.cyphr_zone.name_servers
  description = "Route53 nameservers for domain configuration"
}