# 🎯 CYPHR MESSENGER - DEVELOPMENT WORKFLOW & PROGRESS TRACKING

## 📋 РАБОЧАЯ МОДЕЛЬ ДЛЯ CLAUDE

### 1️⃣ **НАЧАЛО КАЖДОЙ СЕССИИ**
```
1. Прочитать CLAUDE.md - понять текущий статус
2. Прочитать cyphr_claude_promt.md - основные цели
3. Прочитать cyphr_plan_claude.md - детальный план
4. Проверить DEVELOPMENT_WORKFLOW.md - последний прогресс
5. Загрузить TODO list из предыдущей сессии
```

### 2️⃣ **ПЕРЕД НАЧАЛОМ РАБОТЫ**
```
1. Проверить production статус:
   - curl https://app.cyphrmessenger.app/api/health
   - ssh ubuntu@23.22.159.209 "pm2 status"
   
2. Понять архитектуру:
   - Frontend: React + Vite (порт 5173 local, HTTPS production)
   - Backend: Node.js + Express (порт 3001)
   - WebRTC: отдельный сервер (порт 3002)
   - Socket.IO: real-time messaging
   - Database: Supabase PostgreSQL
   
3. Определить что РЕАЛЬНО работает vs что нужно починить
```

### 3️⃣ **ПРАВИЛЬНЫЙ ПОРЯДОК РАЗРАБОТКИ**
```
LOCAL → TEST → STAGING → PRODUCTION

1. LOCAL: Разработка на локальной машине
2. TEST: Тестирование функционала локально
3. STAGING: Тест на production-like окружении
4. PRODUCTION: Деплой на AWS (23.22.159.209)
```

### 4️⃣ **СТРУКТУРА ФАЙЛОВ PRODUCTION**
```
/var/www/cyphr/
├── server.ts          # TypeScript версия (компилируется в .cjs)
├── server.cjs         # Скомпилированный главный сервер
├── full-socketio-server.cjs  # Socket.IO сервер
├── enterprise-webrtc.cjs     # WebRTC сервер
├── dist/              # Собранный frontend
└── .env              # Production переменные
```

## 📊 ТЕКУЩИЙ РЕАЛЬНЫЙ СТАТУС (17 августа 2025)

### ✅ **ЧТО ДЕЙСТВИТЕЛЬНО РАБОТАЕТ:**
- ✅ Production сервер на AWS развернут
- ✅ HTTPS/SSL сертификаты активны
- ✅ Frontend доступен по https://app.cyphrmessenger.app
- ✅ Basic API endpoints (/api/health)
- ✅ Базовая регистрация и авторизация
- ✅ HD Wallet с Stellar интеграцией
- ✅ Post-quantum криптография (Kyber1024)

### ❌ **ЧТО НЕ РАБОТАЕТ / ТРЕБУЕТ ИСПРАВЛЕНИЯ:**
- ❌ Group management endpoints (добавлены в код, но не работают)
- ❌ Real-time messaging через Socket.IO (конфликт портов)
- ❌ WebRTC видеозвонки (TURN сервер не настроен правильно)
- ❌ File upload/sharing
- ❌ Voice messages
- ❌ Полная интеграция wallet transactions

### ⚠️ **ТЕХНИЧЕСКИЕ ПРОБЛЕМЫ:**
1. **Конфликт портов**: socketio и backend используют один порт 3001
2. **PM2 конфигурация**: запускаются не те файлы (full-server.cjs вместо server.cjs)
3. **TypeScript компиляция**: множество ошибок типов
4. **База данных**: не все таблицы созданы (group_banned_members, etc)

## 📝 АКТУАЛЬНЫЙ TODO LIST

### 🔥 **КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ:**
- [ ] Исправить конфликт портов (socketio vs backend)
- [ ] Настроить правильные PM2 процессы
- [ ] Создать недостающие таблицы в БД
- [ ] Исправить TypeScript ошибки компиляции

### 🚀 **ПРИОРИТЕТ 1: Базовая функциональность**
- [ ] Восстановить real-time messaging
- [ ] Починить группы управления правами
- [ ] Интегрировать WebRTC правильно
- [ ] Завершить wallet transaction flow

### 📦 **ПРИОРИТЕТ 2: Расширенные функции**
- [ ] File upload с шифрованием
- [ ] Voice messages
- [ ] Message search
- [ ] Multi-device sync

### 🎨 **ПРИОРИТЕТ 3: UX улучшения**
- [ ] Оптимизация производительности
- [ ] Улучшение UI/UX
- [ ] Push notifications
- [ ] Offline mode

## 🔧 ПРАВИЛЬНЫЙ ПОДХОД К ИСПРАВЛЕНИЯМ

### **Шаг 1: Диагностика**
```bash
# Проверить что реально работает
curl https://app.cyphrmessenger.app/api/health
ssh ubuntu@23.22.159.209 "pm2 list"
ssh ubuntu@23.22.159.209 "pm2 logs --lines 50"
```

### **Шаг 2: Локальная разработка**
```bash
# Работать локально СНАЧАЛА
npm run dev          # Frontend
npm run server       # Backend
npm test            # Тесты
```

### **Шаг 3: Тестирование**
```bash
# Проверить функционал локально
curl http://localhost:3001/api/health
# Тестировать новые endpoints
# Проверить совместимость
```

### **Шаг 4: Деплой**
```bash
# Только после успешного локального теста
scp server.ts ubuntu@23.22.159.209:/var/www/cyphr/
ssh ubuntu@23.22.159.209 "cd /var/www/cyphr && npm run build"
ssh ubuntu@23.22.159.209 "pm2 restart all"
```

## 📈 МЕТРИКИ ПРОГРЕССА

| Компонент | План | Реализовано | Работает | Протестировано |
|-----------|------|-------------|----------|----------------|
| Auth System | 100% | 100% | ✅ | ✅ |
| HD Wallet | 100% | 100% | ✅ | ⚠️ |
| Messaging | 100% | 80% | ⚠️ | ❌ |
| Groups | 100% | 60% | ❌ | ❌ |
| WebRTC | 100% | 70% | ⚠️ | ❌ |
| File Upload | 100% | 20% | ❌ | ❌ |
| Voice Msg | 100% | 0% | ❌ | ❌ |

## 🎯 СЛЕДУЮЩИЕ ШАГИ (ПРАВИЛЬНЫЙ ПОДХОД)

1. **ОСТАНОВИТЬСЯ и ДИАГНОСТИРОВАТЬ** текущее состояние
2. **ИСПРАВИТЬ БАЗОВЫЕ ПРОБЛЕМЫ** (порты, PM2, компиляция)
3. **ТЕСТИРОВАТЬ ЛОКАЛЬНО** каждое изменение
4. **ДЕПЛОИТЬ ОСТОРОЖНО** с backup'ами
5. **ДОКУМЕНТИРОВАТЬ** каждое изменение

## ⚡ БЫСТРЫЕ КОМАНДЫ

```bash
# SSH на сервер
ssh -i ~/cyphrmessenger/cyphr-messenger-key.pem ubuntu@23.22.159.209

# Проверка статуса
pm2 status
pm2 logs --lines 100

# Перезапуск сервисов
pm2 restart cyphr-backend
pm2 restart cyphr-socketio
pm2 restart cyphr-webrtc

# Сборка frontend
npm run build
npx vite build

# Проверка API
curl https://app.cyphrmessenger.app/api/health
```

## 💡 ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **НЕ ТОРОПИТЬСЯ** - лучше медленно но правильно
2. **ТЕСТИРОВАТЬ ВСЁ** - каждое изменение должно быть проверено
3. **BACKUP ПЕРЕД ИЗМЕНЕНИЯМИ** - всегда делать резервные копии
4. **ДОКУМЕНТИРОВАТЬ** - обновлять CLAUDE.md после каждой сессии
5. **СЛЕДОВАТЬ ПЛАНУ** - не отклоняться от основных целей

---

**Последнее обновление**: 17 августа 2025, 23:30
**Статус проекта**: ТРЕБУЕТ СИСТЕМАТИЧЕСКОГО ПОДХОДА
**Следующий шаг**: ИСПРАВИТЬ БАЗОВЫЕ ПРОБЛЕМЫ ИНФРАСТРУКТУРЫ