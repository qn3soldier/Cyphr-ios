# 🚀 CYPHR MESSENGER - ПОЛНАЯ МИГРАЦИЯ НА AWS

## 📋 OVERVIEW
Полная миграция с Netlify + старый AWS на новую единую AWS инфраструктуру для максимальной безопасности и производительности.

## 🎯 ЦЕЛИ МИГРАЦИИ
- ✅ Единый security perimeter
- ✅ CloudFront CDN для всего
- ✅ Централизованный monitoring
- ✅ Enterprise-grade security
- ✅ Готовность к 100K+ пользователей

## 📊 АРХИТЕКТУРА

```
┌─────────────────────────────────────────────────────────┐
│                   USERS (GLOBAL)                         │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│              CLOUDFRONT CDN (GLOBAL EDGE)               │
│  ┌────────────────────────────────────────────────┐     │
│  │ www.cyphrmessenger.app → S3 Landing Page       │     │
│  └────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────┐     │
│  │ app.cyphrmessenger.app → EC2 Application       │     │
│  └────────────────────────────────────────────────┘     │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                    AWS US-EAST-1                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │           S3 BUCKETS                             │   │
│  │  • cyphr-messenger-landing (Static Website)      │   │
│  │  • cyphr-messenger-assets (App Assets)           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │           EC2 INSTANCE (t3.medium)               │   │
│  │  • Ubuntu 22.04 LTS                              │   │
│  │  • Node.js + PM2                                 │   │
│  │  • Nginx Reverse Proxy                           │   │
│  │  • Cyphr App + API + WebSocket                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         SECURITY & NETWORKING                    │   │
│  │  • VPC with Security Groups                      │   │
│  │  • AWS WAF (Web Application Firewall)            │   │
│  │  • AWS Shield (DDoS Protection)                  │   │
│  │  • ACM (SSL Certificates)                        │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

## 🔧 ПОШАГОВАЯ ИНСТРУКЦИЯ

### STEP 1: ПОДГОТОВКА AWS АККАУНТА

```bash
# 1. Установить AWS CLI (если нет)
brew install awscli

# 2. Настроить credentials
aws configure
# Введите:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: us-east-1
# - Default output: json

# 3. Проверить доступ
aws sts get-caller-identity
```

### STEP 2: СОЗДАНИЕ ИНФРАСТРУКТУРЫ

```bash
# 1. Сделать скрипт исполняемым
chmod +x aws-full-migration.sh

# 2. Запустить создание инфраструктуры
./aws-full-migration.sh

# Скрипт создаст:
# - S3 buckets для landing page и assets
# - EC2 instance с Elastic IP
# - Security Groups с правилами
# - SSH ключи для доступа
# - Подготовку для CloudFront
```

### STEP 3: НАСТРОЙКА SSL СЕРТИФИКАТОВ

#### В AWS Console:
1. Откройте **AWS Certificate Manager (ACM)**
2. Нажмите **Request Certificate** → **Request a public certificate**
3. Добавьте домены:
   - `www.cyphrmessenger.app`
   - `cyphrmessenger.app`
   - `app.cyphrmessenger.app`
   - `*.cyphrmessenger.app` (wildcard)
4. Выберите **DNS validation**
5. Добавьте CNAME записи в DNS для валидации

### STEP 4: СОЗДАНИЕ CLOUDFRONT DISTRIBUTIONS

#### Для Landing Page (www):
1. CloudFront Console → **Create Distribution**
2. Origin Settings:
   - Origin Domain: `cyphr-messenger-landing.s3-website-us-east-1.amazonaws.com`
   - Origin Protocol: HTTP only
3. Default Cache Behavior:
   - Viewer Protocol Policy: **Redirect HTTP to HTTPS**
   - Allowed HTTP Methods: GET, HEAD
   - Cache Policy: **CachingOptimized**
4. Distribution Settings:
   - Alternate Domain Names: `www.cyphrmessenger.app`, `cyphrmessenger.app`
   - SSL Certificate: Выбрать из ACM
   - Security Policy: TLSv1.2_2021

#### Для Application (app):
1. CloudFront Console → **Create Distribution**
2. Origin Settings:
   - Origin Domain: EC2 Public IP (из вывода скрипта)
   - Origin Protocol: HTTP only
3. Default Cache Behavior:
   - Viewer Protocol Policy: **Redirect HTTP to HTTPS**
   - Allowed HTTP Methods: ALL
   - Cache Policy: **CachingDisabled** (для динамического контента)
   - Origin Request Policy: **AllViewer**
4. Distribution Settings:
   - Alternate Domain Names: `app.cyphrmessenger.app`
   - SSL Certificate: Выбрать из ACM

### STEP 5: ДЕПЛОЙ ПРИЛОЖЕНИЙ

```bash
# 1. Подготовить environment variables
cp .env.example .env.production
# Отредактировать .env.production с production значениями

# 2. Сделать deploy скрипт исполняемым
chmod +x deploy-to-aws.sh

# 3. Запустить deployment
./deploy-to-aws.sh

# Скрипт выполнит:
# - Загрузку landing page в S3
# - Build и упаковку Cyphr app
# - Deployment на EC2
# - Настройку Nginx
# - Запуск через PM2
```

### STEP 6: ОБНОВЛЕНИЕ DNS

После получения CloudFront distribution URLs:

#### В вашем DNS провайдере:
```
Type    Name    Value                               TTL
------  ------  ----------------------------------  ----
CNAME   www     dxxxxxxxxxxxxx.cloudfront.net      300
CNAME   app     dyyyyyyyyyyyyy.cloudfront.net      300
```

### STEP 7: ПРОВЕРКА И МОНИТОРИНГ

```bash
# SSH подключение к серверу
ssh -i ~/.ssh/cyphr-messenger-key.pem ubuntu@<EC2-IP>

# Проверка статуса приложения
pm2 status
pm2 logs cyphr-app

# Проверка Nginx
sudo nginx -t
sudo systemctl status nginx

# Проверка портов
sudo netstat -tlnp

# Логи
tail -f /var/log/nginx/error.log
pm2 logs --lines 100
```

## 🔒 SECURITY CHECKLIST

- [ ] SSL/TLS сертификаты активны для всех доменов
- [ ] Security Groups настроены (только необходимые порты)
- [ ] CloudFront WAF правила активированы
- [ ] S3 bucket policies настроены правильно
- [ ] Nginx security headers добавлены
- [ ] Environment variables защищены
- [ ] SSH доступ только по ключу
- [ ] Автоматические security updates включены

## 📊 МОНИТОРИНГ

### CloudWatch Dashboards
1. Создать dashboard для:
   - EC2 CPU/Memory/Network
   - CloudFront requests/errors
   - S3 bucket requests

### Алерты
```bash
# Настроить CloudWatch Alarms для:
- High CPU usage (>80%)
- High memory usage (>90%)
- HTTP 5xx errors
- SSL certificate expiration
```

## 🚨 TROUBLESHOOTING

### Проблема: Сайт не доступен
```bash
# Проверить EC2 instance
aws ec2 describe-instance-status --instance-ids <instance-id>

# Проверить Security Groups
aws ec2 describe-security-groups --group-ids <sg-id>

# Проверить CloudFront
aws cloudfront get-distribution --id <distribution-id>
```

### Проблема: SSL ошибки
```bash
# На сервере
sudo certbot certificates
sudo certbot renew --dry-run
```

### Проблема: 502 Bad Gateway
```bash
# Проверить backend
pm2 status
pm2 restart cyphr-app

# Проверить Nginx
sudo nginx -t
sudo systemctl restart nginx
```

## 💰 ОПТИМИЗАЦИЯ РАСХОДОВ

1. **Reserved Instances**: Купить на 1 год = -40% стоимости
2. **S3 Intelligent Tiering**: Автоматическая оптимизация storage
3. **CloudFront Caching**: Максимизировать cache hit ratio
4. **Правильный instance type**: Начать с t3.medium, масштабировать по необходимости

## ✅ ФИНАЛЬНАЯ ПРОВЕРКА

- [ ] Landing page доступна на https://www.cyphrmessenger.app
- [ ] Application доступна на https://app.cyphrmessenger.app
- [ ] WebSocket соединения работают
- [ ] HD Wallet функционирует
- [ ] SMS OTP отправляется
- [ ] Все API endpoints отвечают
- [ ] SSL сертификаты валидны
- [ ] CloudFront CDN работает
- [ ] Monitoring настроен

## 📞 ПОДДЕРЖКА

При проблемах с миграцией:
1. Проверить логи: `pm2 logs`, `/var/log/nginx/`
2. AWS Support (если есть план)
3. CloudWatch Logs для диагностики

---

**🎉 После выполнения всех шагов, Cyphr Messenger будет полностью развернут на единой, безопасной AWS инфраструктуре!**