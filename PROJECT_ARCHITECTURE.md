# 🏗️ CYPHR MESSENGER - ПОЛНАЯ АРХИТЕКТУРА ПРОЕКТА
## Создано: 19 августа 2025 для полного понимания

## 📊 ОБЩАЯ АРХИТЕКТУРА

### **FRONTEND (React + Vite)**
```
src/
├── pages/              # Основные страницы
│   ├── Welcome.jsx     # Начальный экран
│   ├── Login.jsx       # Вход (для существующих)
│   ├── PhoneRegistration.jsx  # Регистрация
│   ├── ProfileSetup.jsx       # Настройка профиля
│   ├── Chats.jsx      # Список чатов (ГЛАВНЫЙ ЭКРАН)
│   ├── Chat.jsx       # Отдельный чат
│   ├── NewChat.jsx    # Поиск пользователей
│   ├── Calls.jsx      # Звонки
│   ├── Settings.jsx   # Настройки
│   └── CryptoWallet.jsx # Кошелек
│
├── components/        # Компоненты
│   ├── Layout.jsx     # Основной layout с BottomNav
│   ├── BottomNav.jsx  # Нижняя навигация
│   ├── discovery/     # Discovery система
│   │   └── DiscoveryHub.jsx # 6 методов поиска
│   ├── chat/          # Компоненты чата
│   └── wallet/        # Компоненты кошелька
│
├── api/               # API сервисы
│   ├── authService.js # Аутентификация
│   ├── twilioService.js # SMS OTP
│   ├── socketService.js # WebSocket
│   ├── discoveryService.js # Поиск пользователей
│   ├── stellarService.js # Blockchain
│   └── crypto/        # Криптография
│       ├── quantumCrypto.js # Kyber1024
│       ├── chacha20.js # ChaCha20
│       └── finalKyber1024.js # Production crypto
│
└── App.jsx           # Главный роутинг

ГЛАВНЫЙ FLOW:
Welcome → Login/Registration → Profile → Chats (главный экран)
```

### **BACKEND (Node.js + Express)**
```
/var/www/cyphr/
├── server.cjs         # Главный сервер (порт 3001)
├── discovery-api-endpoints.cjs # Discovery endpoints
├── .env              # Environment переменные
└── dist/             # Frontend билд

ОСНОВНЫЕ ENDPOINTS:
/api/send-otp         # Отправка SMS
/api/auth/verify-otp-jwt # Верификация с JWT
/api/profile          # Профиль пользователя
/api/discovery/*      # Discovery методы (с JWT)
/api/messages/*       # Сообщения
/api/wallet/*         # Кошелек
```

### **INFRASTRUCTURE**
```
AWS EC2: 23.22.159.209
├── PM2: cyphr-backend (Node.js сервер)
├── Nginx: Reverse proxy + SSL
├── Redis: Session storage
└── Supabase: PostgreSQL database

URLS:
- https://app.cyphrmessenger.app (Application)
- https://www.cyphrmessenger.app (Landing)
```

## 🔐 AUTHENTICATION FLOW

```mermaid
1. Phone Number → 2. SMS OTP → 3. JWT Tokens → 4. Access App

STORAGE:
- sessionStorage: accessToken, userId
- localStorage: refreshToken, publicKey
- IndexedDB: encrypted messages, wallet
```

## 💬 MESSAGING СИСТЕМА

### **REAL-TIME (Socket.io)**
```javascript
Events:
- user_online/offline
- send_message
- typing_start/stop
- message_delivered/read
```

### **ENCRYPTION**
```javascript
1. Generate Kyber1024 keypair
2. Exchange public keys
3. Encapsulate shared secret
4. Encrypt with ChaCha20
5. Send encrypted message
```

## 💰 WALLET СИСТЕМА

```javascript
BIP39: 24-word seed phrase
├── Stellar: Primary blockchain
├── HD Derivation: Multiple addresses
├── Encryption: AES-GCM + PIN
└── Storage: Local only (Zero-Knowledge)
```

## 🔍 DISCOVERY СИСТЕМА (6 МЕТОДОВ)

1. **@cyphr_id** - Уникальные usernames
2. **QR Codes** - Временные токены
3. **Share Links** - cyphr.me/add/username
4. **Quantum Handshake** - P2P обмен
5. **Nearby** - Региональный поиск
6. **Phone** - Хешированные номера

## 🎨 UI/UX DESIGN SYSTEM

### **ПРАВИЛЬНЫЕ СТИЛИ (из Chats.jsx)**
```css
/* Фон */
bg-gradient-to-b from-[rgb(10,14,39)] to-[rgb(30,36,80)]

/* Карточки */
glass rounded-xl

/* Inputs */
glass rounded-lg px-4 py-3 text-white placeholder-white/60

/* Кнопки */
bg-gradient-to-r from-violet-600 to-purple-600

/* Эффекты */
blur-[128px] opacity-20 animate-pulse
```

## 📁 КРИТИЧЕСКИЕ ФАЙЛЫ

### **MUST READ КАЖДУЮ СЕССИЮ:**
1. `CLAUDE_WORK_SYSTEM.md` - Как работать
2. `SESSION_STATUS.md` - Что было сделано
3. `TODO_CURRENT.md` - Что нужно сделать
4. `CURRENT_ERRORS.md` - Что сломано
5. `PROJECT_ARCHITECTURE.md` - Этот файл

### **REFERENCE ФАЙЛЫ:**
1. `CLAUDE.md` - Главные инструкции
2. `cyphr_claude_promt.txt` - Elite team подход
3. `cyphr_plan_claude.txt` - Master план
4. `REVOLUTIONARY_USER_DISCOVERY_ARCHITECTURE.md` - Discovery детали

## ⚠️ КРИТИЧЕСКИЕ ЗАВИСИМОСТИ

```javascript
// Post-Quantum Crypto
@ayxdele/kinetic-keys - Kyber1024 WASM

// Blockchain
@stellar/stellar-sdk - Основной blockchain

// Real-time
socket.io-client - WebSocket связь

// Database
@supabase/supabase-js - PostgreSQL client

// SMS
Twilio (server-side) - OTP verification
```

## 🚨 ИЗВЕСТНЫЕ ПРОБЛЕМЫ

1. **Discovery UI** - Уродливый дизайн, нужен рефакторинг
2. **Bundle Size** - 4.8MB слишком большой
3. **No Email Login** - Только phone
4. **No QR Scanner** - Только generation
5. **No Tests** - Нет unit/e2e тестов

## 📈 МЕТРИКИ ПРОЕКТА

- **Users**: Alice (+19075388374), Bob (+13212225005)
- **Code**: ~50,000 строк
- **Components**: 28 страниц/экранов
- **API Endpoints**: ~30
- **Production Ready**: 75/100

## 🎯 КОНКУРЕНТНЫЕ ПРЕИМУЩЕСТВА

1. **Post-Quantum** - Kyber1024 (никто не имеет)
2. **Zero-Knowledge** - Сервер не видит данные
3. **6 Discovery Methods** - Больше чем у всех
4. **Integrated Wallet** - HD multi-chain
5. **QIRN** - Offline mesh networking

---

**ЭТОТ ФАЙЛ - КАРТА ВСЕГО ПРОЕКТА!**