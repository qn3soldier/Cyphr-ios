# 🚀 ENTERPRISE INFRASTRUCTURE PLAN - CYPHR MESSENGER
**Цель**: Масштабирование до 10,000+ одновременных пользователей  
**Бюджет**: ~$2,000-5,000/месяц для 10K пользователей

---

## 📊 ТЕКУЩАЯ АРХИТЕКТУРА (100-200 пользователей)
```
[Users] → [Single EC2 t3.medium] → [RDS PostgreSQL]
```
**Проблемы:**
- Single point of failure
- Нет кэширования
- Нет автомасштабирования
- DB bottleneck

---

## 🏗️ ENTERPRISE АРХИТЕКТУРА (10,000+ пользователей)

```
                    [CloudFront CDN]
                           ↓
                    [Route 53 DNS]
                           ↓
                [Application Load Balancer]
                    ↙         ↓         ↘
            [EC2 #1]    [EC2 #2]    [EC2 #3]
              ↓            ↓            ↓
         [Redis Cluster] ←→ [RDS Primary]
                              ↙        ↘
                    [Read Replica]  [Read Replica]
```

---

## 📋 ПЛАН МИГРАЦИИ (ПОШАГОВО)

### PHASE 1: КЭШИРОВАНИЕ (1-2 дня) 💰 +$150/месяц
**Добавляем Redis для снижения нагрузки на БД**

#### 1.1 Создать ElastiCache Redis:
```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id cyphr-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1 \
  --security-group-ids sg-09b60ea8a809311fc
```

#### 1.2 Обновить код для Redis:
```javascript
// redis-cache.cjs
const redis = require('redis');
const client = redis.createClient({
  host: 'cyphr-redis.xxxxx.cache.amazonaws.com',
  port: 6379
});

// Кэшировать JWT токены
async function cacheToken(userId, token) {
  await client.setex(`token:${userId}`, 3600, token);
}

// Кэшировать user data
async function cacheUser(userId, userData) {
  await client.setex(`user:${userId}`, 300, JSON.stringify(userData));
}
```

---

### PHASE 2: LOAD BALANCER (1 день) 💰 +$25/месяц
**Распределяем нагрузку между серверами**

#### 2.1 Создать Application Load Balancer:
```bash
aws elbv2 create-load-balancer \
  --name cyphr-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-09b60ea8a809311fc \
  --scheme internet-facing \
  --type application
```

#### 2.2 Создать Target Group:
```bash
aws elbv2 create-target-group \
  --name cyphr-targets \
  --protocol HTTP \
  --port 3001 \
  --vpc-id vpc-xxx \
  --health-check-path /health
```

---

### PHASE 3: AUTO SCALING (2-3 дня) 💰 +$200-500/месяц
**Автоматическое масштабирование под нагрузкой**

#### 3.1 Создать AMI из текущего сервера:
```bash
aws ec2 create-image \
  --instance-id i-03103703e9cc9e76d \
  --name "cyphr-messenger-v2" \
  --description "Cyphr with optimizations"
```

#### 3.2 Launch Template:
```bash
aws ec2 create-launch-template \
  --launch-template-name cyphr-template \
  --version-description "Production template" \
  --launch-template-data '{
    "ImageId": "ami-xxx",
    "InstanceType": "t3.small",
    "SecurityGroupIds": ["sg-09b60ea8a809311fc"],
    "UserData": "base64-encoded-startup-script"
  }'
```

#### 3.3 Auto Scaling Group:
```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name cyphr-asg \
  --launch-template LaunchTemplateName=cyphr-template \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 3 \
  --target-group-arns arn:aws:elasticloadbalancing:xxx
```

#### 3.4 Scaling Policies:
```bash
# Scale UP при CPU > 70%
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name cyphr-asg \
  --policy-name scale-up \
  --scaling-adjustment 2 \
  --adjustment-type ChangeInCapacity \
  --cooldown 300

# Scale DOWN при CPU < 30%
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name cyphr-asg \
  --policy-name scale-down \
  --scaling-adjustment -1 \
  --adjustment-type ChangeInCapacity \
  --cooldown 300
```

---

### PHASE 4: DATABASE SCALING (1-2 дня) 💰 +$300/месяц
**Read replicas для распределения чтения**

#### 4.1 Создать Read Replicas:
```bash
aws rds create-db-instance-read-replica \
  --db-instance-identifier cyphr-read-1 \
  --source-db-instance-identifier cyphr-messenger-prod \
  --db-instance-class db.t3.medium

aws rds create-db-instance-read-replica \
  --db-instance-identifier cyphr-read-2 \
  --source-db-instance-identifier cyphr-messenger-prod \
  --db-instance-class db.t3.medium
```

#### 4.2 Обновить код для read/write split:
```javascript
// db-pools.cjs
const writePool = new Pool({
  host: 'cyphr-messenger-prod.xxx.rds.amazonaws.com',
  // ... для INSERT, UPDATE, DELETE
});

const readPool = new Pool({
  host: 'cyphr-read-1.xxx.rds.amazonaws.com',
  // ... для SELECT запросов
});

// Smart routing
function getPool(query) {
  if (query.match(/INSERT|UPDATE|DELETE/i)) {
    return writePool;
  }
  return readPool;
}
```

---

### PHASE 5: CDN & STATIC FILES (1 день) 💰 +$50/месяц
**CloudFront для статики и API кэширования**

#### 5.1 Создать S3 bucket для статики:
```bash
aws s3 mb s3://cyphr-static-assets
aws s3 sync ./public s3://cyphr-static-assets --acl public-read
```

#### 5.2 CloudFront Distribution:
```bash
aws cloudfront create-distribution \
  --origin-domain-name cyphr-alb.amazonaws.com \
  --default-cache-behavior '{
    "TargetOriginId": "cyphr-api",
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }'
```

---

### PHASE 6: MESSAGE QUEUE (2-3 дня) 💰 +$100/месяц
**SQS для асинхронных операций**

#### 6.1 Создать SQS очереди:
```bash
# Для отправки сообщений
aws sqs create-queue --queue-name cyphr-messages

# Для push notifications
aws sqs create-queue --queue-name cyphr-notifications

# Dead letter queue
aws sqs create-queue --queue-name cyphr-dlq
```

#### 6.2 Worker процессы:
```javascript
// message-worker.cjs
const AWS = require('aws-sdk');
const sqs = new AWS.SQS();

async function processMessages() {
  const messages = await sqs.receiveMessage({
    QueueUrl: 'https://sqs.us-east-1.amazonaws.com/xxx/cyphr-messages',
    MaxNumberOfMessages: 10
  }).promise();
  
  for (const msg of messages.Messages) {
    // Encrypt and store message
    await processMessage(JSON.parse(msg.Body));
    
    // Delete from queue
    await sqs.deleteMessage({
      QueueUrl: queueUrl,
      ReceiptHandle: msg.ReceiptHandle
    }).promise();
  }
}
```

---

## 💰 СТОИМОСТЬ ИНФРАСТРУКТУРЫ

### Для 1,000 пользователей:
- EC2 (2x t3.small): $30/месяц
- RDS (db.t3.medium): $70/месяц
- Redis (cache.t3.micro): $15/месяц
- Load Balancer: $25/месяц
- **ИТОГО: ~$140/месяц**

### Для 10,000 пользователей:
- EC2 (5x t3.medium): $200/месяц
- RDS (db.r5.large + 2 replicas): $500/месяц
- Redis (cache.m5.large): $150/месяц
- Load Balancer: $25/месяц
- CloudFront: $50/месяц
- SQS: $20/месяц
- **ИТОГО: ~$945/месяц**

### Для 100,000 пользователей:
- EC2 (20x c5.xlarge): $2,400/месяц
- RDS (db.r5.2xlarge + 4 replicas): $2,000/месяц
- Redis Cluster: $500/месяц
- Load Balancers: $100/месяц
- CloudFront: $200/месяц
- SQS/SNS: $100/месяц
- **ИТОГО: ~$5,300/месяц**

---

## 🔐 ДОПОЛНИТЕЛЬНЫЕ УЛУЧШЕНИЯ

### 1. **Monitoring & Alerting:**
```bash
# CloudWatch Dashboards
aws cloudwatch put-dashboard \
  --dashboard-name CyphrMetrics \
  --dashboard-body file://dashboard.json

# Alarms
aws cloudwatch put-metric-alarm \
  --alarm-name high-cpu \
  --alarm-description "CPU > 80%" \
  --metric-name CPUUtilization \
  --threshold 80
```

### 2. **Security:**
- WAF для защиты от DDoS
- Secrets Manager для ключей
- VPC с private subnets
- Security Groups с минимальными правами

### 3. **CI/CD Pipeline:**
```yaml
# GitHub Actions deploy.yml
name: Deploy to AWS
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to EC2
        run: |
          aws deploy create-deployment \
            --application-name cyphr-app \
            --deployment-group production \
            --github-location repository=cyphr/messenger
```

### 4. **Disaster Recovery:**
- Automated backups каждые 6 часов
- Multi-AZ deployment
- Snapshot retention 30 дней
- Восстановление < 1 час

---

## 📈 МЕТРИКИ УСПЕХА

### При правильной реализации:
- **Response time**: < 100ms (p95)
- **Uptime**: 99.95%
- **Concurrent users**: 10,000+
- **Messages/sec**: 5,000+
- **Auto-scaling**: 30 секунд
- **Recovery time**: < 5 минут

---

## 🚀 КОМАНДА ДЛЯ БЫСТРОГО СТАРТА

```bash
# Terraform для автоматизации всего
terraform init
terraform plan -var="environment=production"
terraform apply

# Или AWS CloudFormation
aws cloudformation create-stack \
  --stack-name cyphr-enterprise \
  --template-body file://enterprise-stack.yaml \
  --capabilities CAPABILITY_IAM
```

---

## ⚡ САМЫЙ БЫСТРЫЙ ПУТЬ

**Использовать AWS Elastic Beanstalk:**
```bash
# Создает всю инфраструктуру автоматически!
eb init cyphr-messenger --platform node.js
eb create cyphr-prod --instance-type t3.medium --scale 3
eb deploy
```

Elastic Beanstalk автоматически создаст:
- ✅ Load Balancer
- ✅ Auto Scaling Group  
- ✅ CloudWatch monitoring
- ✅ Health checks
- ✅ Rolling deployments

**Это займет 30 минут вместо недели!**