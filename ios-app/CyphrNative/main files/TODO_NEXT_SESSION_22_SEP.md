# 🎯 TODO СЛЕДУЮЩАЯ СЕССИЯ - CYPHR NATIVE iOS

> Reality Check Update — 24 Sep 2025
> - v5.0 Auth/Recovery: работает (challenge, dual‑sig, auto re‑bind на mismatch)
> - Исправлены 502/PM2; стартап‑очистка при 404; Recovery Phrase Reveal ок
> - Требуется системный UI‑редизайн, негативные QA‑кейсы, Delete Account

**Дата обновления**: 23 сентября 2025, 04:45 MSK
**Приоритет**: КРИТИЧЕСКИЙ - ЗАВЕРШИТЬ v5.0 НА СЕРВЕРЕ
**Оценка**: 5-8 часов работы
**Статус предыдущей сессии**: iOS готов, сервер требует доработки

---

## 🔴 P0 - ИСПРАВИТЬ СЕРВЕРНУЮ ЧАСТЬ v5.0 (САМОЕ КРИТИЧНОЕ!)

### 1. **ДОБАВИТЬ login-v5 ENDPOINT ПРАВИЛЬНО** ⏱️ 2 часа
**Файл на сервере**: `/var/www/cyphr/cyphr-id-rds-endpoints.cjs`

**ПРОБЛЕМА СЕССИИ 23.09**:
- Endpoint добавлен в файл но возвращает 404
- Код находится на строке 706 внутри функции initializeCyphrIdEndpoints
- Сервер логирует "✅ Cyphr ID v5.0 endpoints added" но endpoint не работает
- curl возвращает HTML вместо JSON (404 Not Found)
- Подозрение: Express не регистрирует маршрут из-за порядка middleware или конфликта

**ПРАВИЛЬНОЕ РЕШЕНИЕ:**
```javascript
// Добавить ВНУТРИ функции initializeCyphrIdEndpoints
// ПЕРЕД строкой 701 (закрывающая скобка функции)
// ПОСЛЕ других endpoints (например после recovery/confirm)

app.post('/api/cyphr-id/login-v5', async (req, res) => {
  // Код имеет доступ к challenges Map
  // Код имеет доступ к pool (database)
  // Код имеет доступ к jwt
});
```

### 2. **ИСПРАВИТЬ RECOVERY ENDPOINTS** ⏱️ 1 час
**Статус**: Существуют но возвращают `success: false`
- [ ] Проверить логику recovery/init
- [ ] Проверить логику recovery/confirm
- [ ] Добавить правильную проверку device binding

### 3. **iOS УЖЕ ГОТОВ - НЕ ТРОГАТЬ!** ✅
**Файлы**: Все iOS файлы УЖЕ обновлены правильно!

**УЖЕ СДЕЛАНО в iOS:**
- ✅ SecureEnclaveService - полностью соответствует v5.0
- ✅ NetworkService - GET для challenge исправлен
- ✅ AuthenticationService - dual signatures готовы
- ✅ CyphrIdentity - 12 слов реализовано

---

## 🔥 **ДЕТАЛЬНАЯ ИНСТРУКЦИЯ ДЛЯ СЕРВЕРА:**

### **SSH ПОДКЛЮЧЕНИЕ:**
```bash
ssh -i /Users/daniilbogdanov/cyphrmessenger/cyphr-messenger-key.pem ubuntu@23.22.159.209
cd /var/www/cyphr
```

### **ПРОВЕРКА ТЕКУЩЕГО СОСТОЯНИЯ:**
```bash
# Проверить что сервер работает
pm2 status

# Найти где заканчивается функция initializeCyphrIdEndpoints
grep -n "^};" cyphr-id-rds-endpoints.cjs | tail -1
# Должно показать строку ~701

# Проверить что challenges определен
grep -n "const challenges" cyphr-id-rds-endpoints.cjs
# Должно показать строку ~579
```

### **ПРАВИЛЬНОЕ ДОБАВЛЕНИЕ login-v5:**
```bash
# 1. Сделать backup
cp cyphr-id-rds-endpoints.cjs cyphr-id-rds-endpoints.backup.$(date +%s).cjs

# 2. Открыть файл для редактирования на строке 700
nano +700 cyphr-id-rds-endpoints.cjs

# 3. Добавить ПЕРЕД закрывающей скобкой функции
# 4. После добавления проверить синтаксис
node -c cyphr-id-rds-endpoints.cjs

# 5. Перезапустить
pm2 restart cyphr-backend

# 6. Проверить логи
pm2 logs cyphr-backend --lines 10
```

### **КОД ДЛЯ login-v5 (ПОЛНЫЙ И ПРАВИЛЬНЫЙ):**

⚠️ **ВНИМАНИЕ: В СЕССИИ 23.09 КОД УЖЕ ДОБАВЛЕН НА СТРОКУ 706, НО НЕ РАБОТАЕТ!**

**ДИАГНОСТИКА ДЛЯ СЛЕДУЮЩЕЙ СЕССИИ:**
1. Проверить что endpoint действительно на строке 706
2. Проверить что challenges Map на строке 579 доступна
3. Возможно нужно переместить endpoint выше в функции
4. Проверить нет ли конфликта с другими маршрутами
5. Добавить debug логирование при инициализации

```javascript
// ДОБАВИТЬ ПЕРЕД СТРОКОЙ 701 (закрывающая скобка)
// ВНУТРИ функции initializeCyphrIdEndpoints

/**
 * Login v5.0 with dual signatures
 * POST /api/cyphr-id/login-v5
 */
app.post('/api/cyphr-id/login-v5', async (req, res) => {
  try {
    const {
      cyphrId,
      authSignature,     // Ed25519 signature of challenge
      deviceSignature,   // P-256 SE signature of challenge
      devicePublicKey,   // DER encoded P-256 public key
      challengeId
    } = req.body;

    // Проверка параметров
    if (!cyphrId || !authSignature || !challengeId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Проверка challenge
    const storedChallenge = challenges.get(challengeId);
    if (!storedChallenge || storedChallenge.cyphrId !== cyphrId) {
      return res.status(401).json({
        success: false,
        error: 'CHALLENGE_EXPIRED',
        message: 'Invalid or expired challenge'
      });
    }

    const challenge = storedChallenge.challenge;
    challenges.delete(challengeId);

    // Получить пользователя из БД
    const userResult = await pool.query(`
      SELECT
        id,
        cyphr_id,
        public_key,
        device_fingerprint_hash,
        device_binding_pub
      FROM cyphr_identities
      WHERE cyphr_id = $1
    `, [cyphrId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Проверить Ed25519 подпись challenge
    const isValidAuthSig = verifySignature(
      user.public_key,
      challenge,
      authSignature
    );

    if (!isValidAuthSig) {
      return res.status(401).json({
        success: false,
        message: 'Invalid auth signature'
      });
    }

    // v5.0: Проверка device fingerprint
    if (devicePublicKey) {
      const deviceFingerprintHash = crypto
        .createHash('sha256')
        .update(Buffer.from(devicePublicKey, 'base64'))
        .digest('hex');

      // Проверить соответствие fingerprint
      if (user.device_fingerprint_hash &&
          user.device_fingerprint_hash !== deviceFingerprintHash) {
        return res.status(401).json({
          success: false,
          error: 'FINGERPRINT_MISMATCH',
          recoveryRequired: true,
          message: 'Device changed - recovery required'
        });
      }

      // Если это первый login - сохранить device fingerprint
      if (!user.device_fingerprint_hash) {
        await pool.query(
          'UPDATE cyphr_identities SET device_fingerprint_hash = $1 WHERE id = $2',
          [deviceFingerprintHash, user.id]
        );
      }
    }

    // TODO: Проверить P-256 подпись deviceSignature
    if (deviceSignature) {
      console.log('TODO: Verify device signature with SE public key');
    }

    // Создать JWT токен
    const token = jwt.sign(
      {
        userId: user.id,
        cyphrId: user.cyphr_id,
        type: 'cyphr_identity'
      },
      process.env.JWT_SECRET || 'cyphr_secret_2025',
      { expiresIn: '24h' }
    );

    // Обновить last_seen
    await pool.query(
      'UPDATE cyphr_identities SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Успешный ответ
    res.json({
      success: true,
      message: 'Login successful (v5.0)',
      token: token,
      user: {
        id: user.id,
        cyphr_id: user.cyphr_id
      }
    });

  } catch (error) {
    console.error('Login v5.0 error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ЗДЕСЬ ДОЛЖНА БЫТЬ ЗАКРЫВАЮЩАЯ СКОБКА ФУНКЦИИ
// };

### 3. **DUAL SIGNATURE (Account + Device)** ⏱️ 2 часа
**Файлы**: `AuthenticationService.swift`, `NetworkService.swift`

**Задачи:**
- [ ] При логине подписывать challenge двумя ключами
- [ ] Отправлять authSignature + deviceSignature
- [ ] Сервер проверяет обе подписи
- [ ] Обработка FINGERPRINT_MISMATCH

### 4. **ИСПРАВИТЬ RECOVERY FLOW** ⏱️ 3 часа
**Файлы**: `CyphrIdLoginView.swift`, `AuthenticationService.swift`

**Задачи:**
- [ ] УДАЛИТЬ шаг "Choose New ID" из recovery
- [ ] Recovery должен восстанавливать ТОТ ЖЕ @id
- [ ] Реализовать /recovery/init и /recovery/confirm
- [ ] Заменять device binding, не создавать новый аккаунт

---

## 🟡 P1 - ВАЖНЫЕ УЛУЧШЕНИЯ

### 5. **ИСПРАВИТЬ ДВОЙНОЙ FACE ID** ⏱️ 1 час
**Файлы**: `CyphrApp.swift`, `CyphrIdentity.swift`

**Проблема**: Face ID запрашивается дважды при запуске
- [ ] Передавать LAContext из первой проверки
- [ ] Или использовать метод без повторной аутентификации

### 6. **СОКРАТИТЬ ДО 12 СЛОВ** ⏱️ 1 час
**Файлы**: `HDWalletService.swift`, `CyphrIdentity.swift`

- [ ] Изменить генерацию на 12 слов (128 bit entropy)
- [ ] Миграция для пользователей с 24 словами

### 7. **SINGLE-KEY MODEL** ⏱️ 1 час
**Файлы**: `CyphrIdentity.swift`

- [ ] Использовать один Ed25519 ключ для login и recovery
- [ ] Удалить упоминания второго Recovery ключа

---

## 🟢 P2 - ОПТИМИЗАЦИИ

### 8. **ОБЪЕДИНИТЬ KEYCHAIN СЕРВИСЫ** ⏱️ 2 часа
- [ ] Оставить только EnterpriseKeychainService
- [ ] Удалить дублирующий KeychainService
- [ ] Проверить все вызовы

### 9. **RATE LIMITING ДЛЯ PIN** ⏱️ 1 час
- [ ] Реализовать прогрессивные задержки
- [ ] Wipe после 15 попыток

### 10. **ОПЦИОНАЛЬНОЕ СОХРАНЕНИЕ RECOVERY PHRASE** ⏱️ 30 мин
- [ ] Добавить checkbox при показе фразы
- [ ] По умолчанию НЕ сохранять

---

## 📋 **ПРОВЕРОЧНЫЙ ЧЕКЛИСТ:**

После реализации всех пунктов:
- [ ] Device fingerprint стабилен после обновления iOS
- [ ] Нет двойного запроса Face ID
- [ ] Recovery восстанавливает тот же @id
- [ ] Challenge от сервера, не от клиента
- [ ] Две подписи при логине (account + device)
- [ ] 12 слов вместо 24
- [ ] Один Keychain сервис
- [ ] Rate limiting работает

---

## 🚀 **КОМАНДА ДЛЯ СТАРТА:**

```bash
cd /Users/daniilbogdanov/cyphrmessenger/ios-app/CyphrNative
open CyphrNative.xcodeproj
echo "📱 Начинаем реализацию Cyphr ID v5.0"
echo "🎯 Приоритет: Secure Enclave Device Binding"
```

---

## ✅ Актуальный P0 (24 Sep)

1) UI Redesign (см. `main files/CODEX_files/redesign.md`)
   - Theme.swift токены; GlassBar/GlassCard/GlassField; GlassDock
   - Chats: без хедера; стеклянный поиск; FAB/CTA; пустое состояние с логотипом
   - Settings/Profile: стеклянные секции
2) QA (негативные сценарии)
   - CHALLENGE_EXPIRED, неверная подпись, тайм‑ауты, offline
3) Delete Account
   - Серверный endpoint (Ed25519 по challenge) + клиентский wipe, стартап‑проверка 404
4) Документация
   - Обновить overview/release/role_model/todo/codex под фактическое состояние

---

## 📊 **МЕТРИКИ УСПЕХА:**

- **Соответствие v5.0**: Поднять с 40% до 90%
- **Безопасность**: Устранить все критические уязвимости
- **UX**: Убрать двойной Face ID
- **Стабильность**: Device fingerprint переживает обновления

---

## ⚠️ **ВАЖНЫЕ ЗАМЕТКИ:**

1. **AWS оптимизирован** - экономия $175/месяц достигнута
2. **Backend работает** - сервер стабилен на 23.22.159.209
3. **Фокус на iOS** - критические проблемы безопасности требуют исправления
4. **Методичка v5.0** - следовать строго, это финальная архитектура

---

**GOOD LUCK! 🍀**
