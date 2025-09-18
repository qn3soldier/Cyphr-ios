# 🔥 ОБЯЗАТЕЛЬНАЯ СИСТЕМА РАБОТЫ CLAUDE НАД CYPHR MESSENGER

## 📋 ОБЯЗАТЕЛЬНЫЙ ПОРЯДОК ЗАПУСКА КАЖДОЙ СЕССИИ

### **STEP 1: ЧИТАТЬ ВСЕ КРИТИЧЕСКИЕ ФАЙЛЫ (100% ОБЯЗАТЕЛЬНО!)**
```bash
# В ТОЧНОМ ПОРЯДКЕ:
1. /Users/daniilbogdanov/cyphrmessenger/CLAUDE_WORK_SYSTEM.md # ЭТА ИНСТРУКЦИЯ
2. /Users/daniilbogdanov/cyphrmessenger/SESSION_STATUS.md     # Текущее состояние
3. /Users/daniilbogdanov/cyphrmessenger/TODO_CURRENT.md       # Активные задачи
4. /Users/daniilbogdanov/cyphrmessenger/CURRENT_ERRORS.md     # Текущие ошибки
5. /Users/daniilbogdanov/cyphrmessenger/PROJECT_ARCHITECTURE.md # ПОЛНАЯ АРХИТЕКТУРА
6. /Users/daniilbogdanov/cyphrmessenger/API_ENDPOINTS.md      # ВСЕ API ENDPOINTS
7. /Users/daniilbogdanov/cyphrmessenger/CLAUDE.md             # Главные инструкции
8. /Users/daniilbogdanov/cyphrmessenger/cyphr_claude_promt.txt # Elite team подход
9. /Users/daniilbogdanov/cyphrmessenger/REVOLUTIONARY_USER_DISCOVERY_ARCHITECTURE.md # Discovery
```

### **STEP 2: ПРОВЕРИТЬ РЕАЛЬНОЕ СОСТОЯНИЕ PRODUCTION**
```bash
# ВСЕГДА выполнять ЭТИ команды:
1. ssh -i cyphr-messenger-key.pem ubuntu@23.22.159.209 "pm2 status"
2. curl https://app.cyphrmessenger.app/api/health
3. curl -X POST https://app.cyphrmessenger.app/api/auth/send-otp -d '{"phone":"+19075388374"}'
4. curl https://app.cyphrmessenger.app/api/discovery/check-cyphr-id -d '{"cyphrId":"test"}'
```

### **STEP 3: ПОНЯТЬ ЧТО СЛОМАНО ПРЯМО СЕЙЧАС**
```bash
# Проверить:
- Login работает? (send-otp endpoint)
- Registration работает? (verify-otp endpoint)  
- Discovery работает? (discovery endpoints)
- UI загружается? (открыть в браузере)
- Какие ошибки в консоли браузера?
- Какие ошибки в PM2 logs?
```

### **STEP 4: ОБНОВИТЬ ДОКУМЕНТАЦИЮ ПЕРЕД НАЧАЛОМ**
```bash
# ОБЯЗАТЕЛЬНО обновить:
1. SESSION_STATUS.md - с РЕАЛЬНЫМ текущим состоянием
2. TODO_CURRENT.md - с РЕАЛЬНЫМИ приоритетами
3. CURRENT_ERRORS.md - с ВСЕМИ текущими ошибками
```

## 🚨 КРИТИЧЕСКИЕ ПРАВИЛА РАБОТЫ

### **ПРАВИЛО 1: ELITE TEAM APPROACH (ИЗ cyphr_claude_promt.txt)**
```
Я ОБЯЗАН работать как команда экспертов:
- Security Lead (like Moxie from Signal)
- Backend Architect (like Telegram's Nikolai)
- Frontend Master (like WhatsApp UI team)
- Blockchain Specialist (like TON devs)
- DevOps Guru (like AWS experts)
- QA/Audit Tester
```

### **ПРАВИЛО 2: ТОЛЬКО PRODUCTION-READY РЕШЕНИЯ**
```
❌ ЗАПРЕЩЕНО:
- Игрушечные решения
- Упрощения "для теста"
- In-memory вместо Redis
- Localhost тестирование вместо production

✅ ОБЯЗАТЕЛЬНО:
- Enterprise архитектура для 10,000+ users
- Load balancer + auto-scaling
- Redis clustering
- Proper error handling
- Production deployment на AWS
```

### **ПРАВИЛО 3: НЕ ЛОМАТЬ ТО ЧТО РАБОТАЕТ**
```
ПЕРЕД любым изменением:
1. Проверить работает ли сейчас
2. Сделать backup
3. Понять зависимости
4. Тестировать после изменения
5. Откатить если сломалось
```

### **ПРАВИЛО 4: ОБНОВЛЯТЬ ДОКУМЕНТАЦИЮ ВСЕГДА**
```
ПОСЛЕ каждого изменения обновить:
- SESSION_STATUS.md - что сделано
- TODO_CURRENT.md - что осталось
- CURRENT_ERRORS.md - новые/исправленные ошибки
- CLAUDE.md - новые знания о системе
```

## 📊 ТЕКУЩЕЕ КРИТИЧЕСКОЕ СОСТОЯНИЕ (19 АВГУСТА 2025)

### **🔴 ЧТО СЛОМАНО ПРЯМО СЕЙЧАС:**
1. **LOGIN НЕ РАБОТАЕТ**: "Cannot POST /api/auth/send-otp" - endpoint не найден
2. **DISCOVERY UI УРОДЛИВЫЙ**: Темный фон с темным текстом, нечитаемо
3. **НЕТ ВАРИАНТОВ ВХОДА**: Только phone, нет email/username опций

### **🟡 ЧТО РАБОТАЕТ ЧАСТИЧНО:**
1. **Discovery API**: Endpoints работают но требуют JWT
2. **Frontend deployed**: Но с ошибками UI
3. **Database**: Schema готова но не все используется

### **🟢 ЧТО РАБОТАЕТ:**
1. **Infrastructure**: AWS EC2 + Redis + PM2
2. **Post-quantum crypto**: Kyber1024 + ChaCha20
3. **Database schema**: Все таблицы созданы

## 🎯 ПРИОРИТЕТЫ ИСПРАВЛЕНИЯ

### **PRIORITY 1: ВОССТАНОВИТЬ LOGIN (КРИТИЧНО!)**
```bash
# Проверить почему /api/auth/send-otp не работает:
1. Проверить server.cjs на сервере - есть ли route
2. Проверить PM2 logs - какие ошибки
3. Восстановить endpoint если удален
```

### **PRIORITY 2: ИСПРАВИТЬ DISCOVERY UI**
```bash
# Взять правильный дизайн из:
- /src/pages/Chats.jsx
- /src/pages/NewChat.jsx
- Использовать glass классы и градиентный фон
```

### **PRIORITY 3: ДОБАВИТЬ ВАРИАНТЫ ВХОДА**
```bash
# Как в WhatsApp/Telegram:
- Phone number (SMS OTP)
- Email (Email OTP)
- Username (@cyphr_id)
```

## 📁 ФАЙЛЫ КОТОРЫЕ НУЖНО ОБНОВЛЯТЬ

### **ВСЕГДА ОБНОВЛЯТЬ ПОСЛЕ КАЖДОЙ СЕССИИ:**
1. `SESSION_STATUS.md` - итоги сессии
2. `TODO_CURRENT.md` - обновленные задачи
3. `CURRENT_ERRORS.md` - статус ошибок
4. `CLAUDE.md` - новые критические знания

### **СОЗДАТЬ ЕСЛИ НЕ СУЩЕСТВУЮТ:**
1. `CURRENT_ERRORS.md` - список всех текущих ошибок
2. `DEPLOYMENT_LOG.md` - история всех деплоев
3. `API_STATUS.md` - статус всех API endpoints

## 🚀 КОНКУРЕНТЫ И ЦЕЛИ

### **МЫ ДОЛЖНЫ ПРЕВЗОЙТИ:**
- **WhatsApp**: 2+ billion users, простота использования
- **Telegram**: Скорость, боты, каналы
- **Signal**: Приватность, open source
- **WeChat**: Super app функциональность
- **Discord**: Community features, voice

### **НАШИ УНИКАЛЬНЫЕ ПРЕИМУЩЕСТВА:**
1. **Post-quantum security** (Kyber1024) - никто не имеет
2. **Zero-knowledge architecture** - даже мы не видим данные
3. **6 методов discovery** - больше чем у всех конкурентов
4. **Integrated HD wallet** - безопасные крипто-платежи

## ⚠️ КРИТИЧЕСКИЕ КОМАНДЫ ДЛЯ ПРОВЕРКИ

```bash
# 1. ПРОВЕРКА СЕРВЕРА
ssh -i /Users/daniilbogdanov/cyphrmessenger/cyphr-messenger-key.pem ubuntu@23.22.159.209

# 2. ПРОВЕРКА PM2
pm2 status
pm2 logs cyphr-backend --lines 100

# 3. ПРОВЕРКА API
curl https://app.cyphrmessenger.app/api/health
curl -X POST https://app.cyphrmessenger.app/api/auth/send-otp -d '{"phone":"+19075388374"}'

# 4. ПРОВЕРКА DISCOVERY
curl https://app.cyphrmessenger.app/api/discovery/check-cyphr-id -d '{"cyphrId":"test"}'

# 5. BUILD & DEPLOY
npm run build
rsync -avz dist/ ubuntu@23.22.159.209:/var/www/cyphr/dist/
```

## 📝 ОБЯЗАТЕЛЬНЫЙ ЧЕКЛИСТ ПЕРЕД ЗАВЕРШЕНИЕМ СЕССИИ

- [ ] Обновил SESSION_STATUS.md с реальным статусом
- [ ] Обновил TODO_CURRENT.md с актуальными задачами  
- [ ] Обновил CURRENT_ERRORS.md со всеми ошибками
- [ ] Проверил что не сломал то что работало
- [ ] Задеплоил изменения на production AWS
- [ ] Протестировал в реальном браузере
- [ ] Обновил CLAUDE.md если узнал что-то критически важное

---

**ЭТОТ ФАЙЛ - ЗАКОН! СЛЕДОВАТЬ ВСЕГДА БЕЗ ИСКЛЮЧЕНИЙ!**