# 🚨 КОМАНДА ДЛЯ СЛЕДУЮЩЕЙ СЕССИИ CLAUDE CODE - 19 АВГУСТА 2025

## 🔥 ОБЯЗАТЕЛЬНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ ИЗУЧЕНИЯ ФАЙЛОВ:

### **ШАГ 1: КРАЕУГОЛЬНЫЕ МАНИФЕСТЫ (ОБЯЗАТЕЛЬНО ПРОЧИТАТЬ ПОЛНОСТЬЮ)**
```bash
# 1. Основной prompt с техническими требованиями
cat /Users/daniilbogdanov/cyphrmessenger/cyphr_claude_promt.txt

# 2. Детальный план развития (7 фаз)
cat /Users/daniilbogdanov/cyphrmessenger/cyphr_plan_claude.txt  

# 3. Принципы работы (нерушимые правила)
cat /Users/daniilbogdanov/cyphrmessenger/CLAUDE_WORK_MANIFESTO.md

# 4. Инструкция по началу сессий
cat /Users/daniilbogdanov/cyphrmessenger/START_HERE_CLAUDE.md

# 5. Модель разработки  
cat /Users/daniilbogdanov/cyphrmessenger/DEVELOPMENT_WORKFLOW.md
```

### **ШАГ 2: ТЕКУЩИЙ СТАТУС (ПОНЯТЬ ЧТО РЕАЛЬНО СДЕЛАНО)**
```bash
# 6. Последние достижения сессии 18 августа
cat /Users/daniilbogdanov/cyphrmessenger/SESSION_STATUS.md

# 7. Обновленный статус проекта  
cat /Users/daniilbogdanov/cyphrmessenger/CLAUDE.md | head -100

# 8. Актуальные задачи
cat /Users/daniilbogdanov/cyphrmessenger/TODO_CURRENT.md
```

## 🎯 **КРИТИЧЕСКИЙ ПЛАН НА СЛЕДУЮЩУЮ СЕССИЮ (19 АВГУСТА 2025)**

### **ДОСТИЖЕНИЯ 18 АВГУСТА:**
- ✅ **POST-QUANTUM CRYPTO**: Kyber1024 + ChaCha20 реализовано в SocketService
- ✅ **ZERO KNOWLEDGE**: Сервер НЕ видит plain text сообщения  
- ✅ **JWT AUTH**: Протестировано с реальными OTP кодами
- ✅ **SCALING**: Rate limit увеличен до 1000+ users
- ✅ **WebRTC + TURN**: Конфигурация готова

### **🚀 ПРИОРИТЕТЫ НА 19 АВГУСТА (СОГЛАСНО cyphr_plan_claude.txt):**

#### **ФАЗА 1: ЗАВЕРШИТЬ POST-QUANTUM IMPLEMENTATION**
1. **HD WALLET ENDPOINTS** - реализовать `/api/wallet/*` на сервере (НЕ РЕАЛИЗОВАНЫ!)
2. **REAL-TIME MESSAGING** - интегрировать Kyber1024 с Socket.IO полностью
3. **ГРУППЫ С ШИФРОВАНИЕМ** - multi-user encrypted с post-quantum keys
4. **PERFORMANCE OPTIMIZATION** - достичь <20ms для всех crypto операций

#### **ФАЗА 2: ENTERPRISE SCALABILITY (cyphr_plan_claude.txt Phase 6)**  
5. **CONNECTION POOLING** - PostgreSQL pool для 1000+ concurrent users
6. **REDIS CLUSTERING** - горизонтальное масштабирование state
7. **AWS LOAD BALANCER** - Auto Scaling Group + ELB
8. **MONITORING** - New Relic для production metrics

#### **ФАЗА 3: PRODUCTION FEATURES (cyphr_plan_claude.txt Phase 4)**
9. **FILE SHARING** - encrypted attachments до 2GB
10. **VOICE MESSAGES** - MediaRecorder + ChaCha20 encryption  
11. **CROSS-CHAIN WALLET** - BTC/ETH/Solana integration
12. **AI ANOMALY DETECTION** - networkx для spam/threats

## ⚠️ **КРИТИЧЕСКИЕ ПРАВИЛА ИЗ CLAUDE_WORK_MANIFESTO.md:**

1. **🔥 ТОЛЬКО УЛУЧШЕНИЕ, НЕ ДЕГРАДАЦИЯ** - исправлять bugs в ПОЛНОМ коде
2. **🧠 ЛОГИЧЕСКИЙ АНАЛИЗ** - найти корневую причину, не симптом  
3. **📈 ПОСТОЯННАЯ САМООПТИМИЗАЦИЯ** - обновлять CLAUDE.md с новыми знаниями
4. **🏆 КОНКУРЕНТНОЕ ПРЕВОСХОДСТВО** - только лучше Signal, WhatsApp, Telegram
5. **📝 ЧЕСТНОСТЬ В ОТЧЕТАХ** - если не работает, так и писать

## 🎯 **КОНКРЕТНЫЙ ПЛАН ДЕЙСТВИЙ (ПЕРВЫЕ 30 МИНУТ СЕССИИ):**

### **НЕМЕДЛЕННО:**
1. **HD WALLET SERVER ENDPOINTS** - их НЕТ на сервере, но frontend их вызывает
2. **REAL-TIME MESSAGING TESTING** - Kyber1024 integration с Socket.IO  
3. **PERFORMANCE BENCHMARKING** - проверить <20ms target для crypto

### **ЗАТЕМ:**  
4. **CONNECTION POOLING** - PostgreSQL pool для enterprise scaling
5. **LOAD BALANCER** - AWS ALB setup для 1000+ concurrent users

## 📋 **КОМАНДЫ ДЛЯ ДИАГНОСТИКИ:**
```bash
# Проверить что сервер жив
curl -s https://app.cyphrmessenger.app/api/health

# Проверить отсутствующие wallet endpoints  
curl -s https://app.cyphrmessenger.app/api/wallet/balance

# SSH на сервер для реализации
ssh -i /Users/daniilbogdanov/cyphrmessenger/cyphr-messenger-key.pem ubuntu@23.22.159.209
```

## 🚀 **ЦЕЛЬ СЕССИИ:**
**МИНИМУМ: HD Wallet endpoints реализованы + Real-time messaging протестировано**
**МАКСИМУМ: Enterprise scaling (connection pooling + load balancer) готов**

---
*Обновлено: 18 августа 2025, 19:25 UTC - Context 8% remaining*
*Следующая сессия: Начать с изучения ВСЕХ краеугольных манифестов!*