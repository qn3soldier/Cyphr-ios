# Cyphr Messenger - Настройка окружения

## 1. Установка зависимостей

```bash
cd project
npm install
```

## 2. Настройка .env файла

Скопируйте .env.example в .env и заполните все значения:

### Supabase
1. Создайте проект на https://supabase.com
2. Перейдите в Settings -> API
3. Скопируйте URL и anon key

### Twilio (для SMS OTP)
1. Создайте аккаунт на https://twilio.com
2. Создайте Verify Service в Console -> Verify
3. Скопируйте Account SID, Auth Token и Service SID

### Stellar (для крипто-транзакций)
1. Создайте тестовый кошелек на https://laboratory.stellar.org
2. Получите тестовые XLM из friendbot
3. Скопируйте secret и public keys

### Firebase (для push-уведомлений)
1. Создайте проект на https://console.firebase.google.com
2. Добавьте Web App
3. Скопируйте конфигурацию из Firebase SDK snippet

## 3. Настройка базы данных

Выполните SQL из project/supabase-schema.sql и project/supabase-encrypted-tx.sql в Supabase SQL Editor

## 4. Запуск приложения

```bash
# В одном терминале
npm run dev

# В другом терминале  
npm run dev-server
```

Приложение будет доступно на http://localhost:5173

## Особенности

- ✅ Постквантовое шифрование (Kyber1024 + ChaCha20)
- ✅ Зашифрованные крипто-транзакции с ZK-proofs
- ✅ Современный UI с glassmorphism эффектами  
- ✅ Tailwind CSS v4.0 с @tailwindcss/postcss
- ✅ WebRTC для видеозвонков
- ✅ Push-уведомления через Firebase
