# 🚨 CURRENT ERRORS - CYPHR MESSENGER
## Последнее обновление: 19 августа 2025, 23:50 UTC

## 🔴 КРИТИЧЕСКИЕ ОШИБКИ (БЛОКИРУЮТ ИСПОЛЬЗОВАНИЕ)

### 1. ~~**LOGIN ENDPOINT НЕ РАБОТАЕТ**~~ ✅ ИСПРАВЛЕНО
- **Ошибка**: `Cannot POST /api/auth/send-otp`
- **Где**: Frontend использовал неправильный URL
- **Симптом**: При попытке войти - "Load failed"
- **Причина**: Frontend вызывал `/api/auth/send-otp`, а на сервере `/api/send-otp`
- **Исправление**: twilioService.js обновлен с правильными endpoints
- **Статус**: ✅ ИСПРАВЛЕНО (19 августа, 23:30 UTC)

### 2. **DISCOVERY UI НЕЧИТАЕМЫЙ**
- **Ошибка**: Темный текст на темном фоне
- **Где**: https://app.cyphrmessenger.app/discovery
- **Симптом**: Поле поиска почти невидимо, плохой контраст
- **Причина**: Неправильные Tailwind классы после замены Card компонентов
- **Файл**: `/src/components/discovery/DiscoveryHub.jsx`
- **Статус**: ❌ НЕ ИСПРАВЛЕНО

### 3. **НЕТ АЛЬТЕРНАТИВНЫХ МЕТОДОВ ВХОДА**
- **Ошибка**: Только phone number, нет email/username
- **Где**: https://app.cyphrmessenger.app/login
- **Симптом**: Нельзя войти через email или @cyphr_id
- **Причина**: Не реализованы альтернативные методы
- **Статус**: ❌ НЕ ИСПРАВЛЕНО

## 🟡 СРЕДНИЕ ОШИБКИ (ФУНКЦИОНАЛ ОГРАНИЧЕН)

### 4. **JWT AUTHENTICATION НА DISCOVERY**
- **Ошибка**: Discovery endpoints требуют JWT но frontend не отправляет
- **Симптом**: "Access token required" при вызове discovery API
- **Причина**: JWT middleware добавлен но frontend не обновлен
- **Статус**: ⚠️ ЧАСТИЧНО ИСПРАВЛЕНО

### 5. **QR SCANNER ОТСУТСТВУЕТ**
- **Ошибка**: QR generation работает, но scanning нет
- **Где**: Discovery Hub - QR Code метод
- **Причина**: Не реализован camera access
- **Статус**: ❌ НЕ ИСПРАВЛЕНО

## 🟢 ИСПРАВЛЕННЫЕ ОШИБКИ

### ✅ **BUILD ERRORS**
- **Было**: ChaCha20 и FinalKyber1024 CommonJS exports
- **Исправлено**: Конвертировано в ES6 modules
- **Коммит**: 19 августа, ~22:50 UTC

### ✅ **DISCOVERY SERVICE MIXED CALLS**
- **Было**: Смешаны Supabase и API calls
- **Исправлено**: Унифицировано на API calls
- **Файл**: `/src/services/discoveryService.js`

## 📊 СТАТИСТИКА ОШИБОК

- **Критических**: 3
- **Средних**: 2  
- **Исправлено**: 2
- **Всего активных**: 5

## 🔧 КОМАНДЫ ДЛЯ ДИАГНОСТИКИ

```bash
# Проверить login endpoint
ssh -i cyphr-messenger-key.pem ubuntu@23.22.159.209 \
  "grep -n 'send-otp' /var/www/cyphr/server.cjs"

# Проверить PM2 logs
ssh -i cyphr-messenger-key.pem ubuntu@23.22.159.209 \
  "pm2 logs cyphr-backend --lines 50 | grep -i error"

# Проверить nginx конфигурацию
ssh -i cyphr-messenger-key.pem ubuntu@23.22.159.209 \
  "cat /etc/nginx/sites-available/cyphr-messenger | grep location"
```

## 📝 ПРИМЕЧАНИЯ

- Login работал до начала этой сессии
- Discovery UI создан заново без учета существующего дизайна
- JWT middleware добавлен но не полностью интегрирован