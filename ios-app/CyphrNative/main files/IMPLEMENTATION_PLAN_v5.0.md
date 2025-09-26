# 📋 ПОЛНЫЙ ПЛАН ИСПРАВЛЕНИЯ ДЛЯ СООТВЕТСТВИЯ v5.0

**Документ**: План приведения iOS приложения в соответствие с Cyphr_ID_Enterprise_Methodology_NO_ARGON_v5.0.md
**Дата создания**: 22 сентября 2025
**Последнее обновление**: 23 сентября 2025 (вечер)
**Статус (Reality Check 2025‑09‑24)**: 85–90% по спецификации (Auth + Recovery работают; авто‑rebind при mismatch; стартап‑очистка при 404; UI/QA/некоторые крайние кейсы в работе)
**Оценка**: 5-7 дней
**Потрачено**: 2 дня

---

## 🎯 ЦЕЛЬ
Привести iOS приложение Cyphr Native в полное соответствие со спецификацией v5.0, исправив критические несоответствия в device binding, authentication flow и recovery процессе.

## 📊 REALITY CHECK (24 Sep)

1) Login/Recovery v5.0 — OK: challenge‑response, dual‑signature, re‑bind.
2) Device Binding — OK: P‑256 in SE, DER(SPKI), SHA256(fingerprint).
3) Startup check — OK: если сервер 404 по @id, локальная identity стирается.
4) Recovery Phrase — исправлено: Reveal запрашивает FaceID и подгружает из Keychain.
5) UI — не покрыто планом v5.0: требуется системный редизайн (см. CODEX_files/redesign.md).
6) QA — требуется прогон на девайсе: негативные сценарии (expired challenge, подпись). 

Ниже — исходная структура плана (не изменяем), а фактический статус приведён в этом блоке.

### ❌ Критические расхождения (обновлён статус):
1. [ИСПРАВЛЕНО] Device Binding → P‑256 Secure Enclave; fingerprint = SHA256(DER(SPKI(pub)))
2. [ИСПРАВЛЕНО] Single‑Key (один Ed25519) вместо двух ключей
3. [ИСПРАВЛЕНО] 12 слов BIP39 (128‑bit entropy)
4. [ИСПРАВЛЕНО] Challenge‑response (login и recovery)
5. [ИСПРАВЛЕНО] Recovery = re‑bind (НЕ новый аккаунт)
6. [ИСПРАВЛЕНО] Keychain консолидация: активные флоу используют EnterpriseKeychainService; legacy wrapper не используется

---

## PHASE 1: SECURE ENCLAVE DEVICE BINDING (Критично!)
**Срок: 1-2 дня**
**Приоритет: МАКСИМАЛЬНЫЙ**
**СТАТУС: ✅ ВЫПОЛНЕНО (23 сентября 2025)**

### 1.1 Создать новый DeviceBindingService ✅ ВЫПОЛНЕНО
```swift
// Заменит текущий нестабильный DeviceIdentityService
class DeviceBindingService {
    // P-256 ключ в Secure Enclave
    func generateDeviceBindingKey() -> SecKey
    // SHA256(DER(publicKey)) как fingerprint
    func getDeviceFingerprintHash() -> String
    // Подпись challenge для dual-signature
    func signChallenge(_ challenge: Data) -> Data
}
```

**Ключевые требования:**
- Генерация P-256 ключа в Secure Enclave
- `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` БЕЗ `.biometryCurrentSet`
- SHA256(DER(publicKey)) как device_fingerprint_hash
- Стабильность при обновлении iOS

### 1.2 Обновить CyphrIdentity ⚠️ ЧАСТИЧНО
**Что сделано:**
- ✅ SecureEnclaveService создан с правильными методами
- ✅ Device binding через SecureEnclaveService реализован
- ✅ Backward compatibility с legacy fingerprint
**Что дополнительно сделано:**
- ✅ Экспорт deviceBindingPublicKey в DER(SPKI)
- ✅ Фингерпринт = SHA256(DER(SPKI(pub)))
- ⚠️ Legacy DeviceIdentityService присутствует в репо, но не используется в активных флоу (к удалению в финальной чистке)

### 1.3 Исправить NetworkService endpoints ✅ ВЫПОЛНЕНО В iOS
- ✅ Добавлен метод `getChallenge(cyphrId:)` - изменен с POST на GET
- ✅ Обновлен `loginCyphrIdentity()` для dual signatures
- ✅ Добавлены `initiateRecovery()` и `confirmRecovery()` методы
**Сервер:** ✅ Принимает запросы (контракты v5.0 подтверждены); исправлен 502; проверка /challenge и /recovery/init

---

## PHASE 2: SINGLE-KEY MODEL + 12 WORDS
**Срок: 1 день**
**СТАТУС: ✅ Выполнено (функционально), остаётся негативное/долгое QA**

### 2.1 Унифицировать на один Ed25519 ключ ✅ ВЫПОЛНЕНО
- ✅ Удалены все P256 методы для auth (только Ed25519)
- ✅ Используется ТОЛЬКО Ed25519 для auth/recovery
- ✅ Детерминированный вывод из BIP39 seed

### 2.2 Переход на 12 слов BIP39 ✅ ВЫПОЛНЕНО
- ✅ CyphrIdentity.generateRecoveryPhrase12Words() реализован
- ✅ entropy: 128 bits вместо 256
- ✅ words: 12 вместо 24
**Проверка UI:** ✅ RecoveryPhraseView отображает 12 слов; BIP39 загружается из bundle (2048 слов)

### 2.3 Recovery = re-binding (не новый аккаунт) ✅ ВЫПОЛНЕНО
- ✅ Recovery восстанавливает тот же @id (ввод существующего @id)
- ✅ Сервер заменяет device binding при подтверждении

---

## PHASE 3: CHALLENGE-RESPONSE AUTHENTICATION
**Срок: 1 день**
**СТАТУС: ✅ ВЫПОЛНЕНО (23 сентября 2025)**

### 3.1 Реализовать challenge flow ✅ В iOS / ❌ НА СЕРВЕРЕ
**iOS выполнено:**
- ✅ AuthenticationService.loginWithCyphrId() использует challenge-response
- ✅ Добавлен signChallenge() для подписи challenge от сервера
- ✅ Dual signatures реализованы (Ed25519 + P256-SE)

**Сервер:**
- ✅ /challenge, /login, /recovery/init, /recovery/confirm — реализованы и протестированы

### 3.2 Обработка FINGERPRINT_MISMATCH ⚠️ КОД ГОТОВ
- ✅ Логика в AuthenticationService готова
- ❌ Не протестировано из-за неработающего сервера

### 3.3 JWT управление ✅ ВЫПОЛНЕНО
- ✅ AuthTokenStore использует WhenUnlockedThisDeviceOnly
- ✅ JWT хранится с правильной политикой

---

## PHASE 4: KEYCHAIN КОНСОЛИДАЦИЯ
**Срок: 0.5 дня**

### 4.1 Унифицировать на EnterpriseKeychainService
- Удалить KeychainService wrapper
- Все обращения через Enterprise версию
- Единая политика доступа

### 4.2 PIN без Argon2 (NO-ARGON спецификация)
```swift
// EnterpriseKeychainService
pinKey = PBKDF2-SHA256(PIN, salt, iterations=50-120ms)
pepperKey = random 32 bytes в Keychain
KEK_pin = HKDF-SHA256(pinKey, pepperKey, "CYPHR-KEK-v1")
dek_pin_wrap = AES-GCM(KEK_pin, DEK)
```

### 4.3 Recovery phrase хранение
- НЕ сохранять по умолчанию
- Опциональное сохранение с Face ID
- При сохранении: `.biometryCurrentSet`

---

## PHASE 5: BACKEND INTEGRATION
**Срок: 1-2 дня**
**СТАТУС: ✅ ВЫПОЛНЕНО (23 сентября 2025)**

### 5.1 Database schema ✅ ВЫПОЛНЕНО
- ✅ Все v5.0 колонки УЖЕ существуют в БД:
  - `device_fingerprint_hash` VARCHAR(64)
  - `device_binding_pub` TEXT
  - `fingerprint_method_ver` SMALLINT
  - `last_seen` TIMESTAMPTZ

### 5.2 API endpoints ✅ ГОТОВО
**Что работает:**
- ✅ POST /api/cyphr-id/register — v5.0 контракт
- ✅ GET /api/cyphr-id/challenge — issue nonce + challengeId
- ✅ POST /api/cyphr-id/login — dual‑signature + fingerprint check + JWT
- ✅ POST /api/cyphr-id/recovery/init — recoveryChallenge
- ✅ POST /api/cyphr-id/recovery/confirm — re‑bind + JWT

### 5.3 Migration период ❌ НЕ НАЧАТ
- Невозможно без работающих endpoints

---

## PHASE 6: TESTING & QA
**Срок: 1 день**
**СТАТУС: ⚠️ QA в процессе (unit/integration не покрыты полностью)**

### 6.1 Unit tests ❌ НЕ СДЕЛАНО
- ✅ Device binding/Challenge/Recovery — серверный E2E тест пройден
- ✅ iOS флоу обновлён и готов; on‑device E2E — рекомендован как финальная проверка UX
- ✅ PIN rate limiting — базовая версия в EnterpriseKeychainService

### 6.2 Integration tests ❌ НЕ СДЕЛАНО
- ✅ Сервер готов; пройден synthetic E2E
- ✅ Клиентский код соответствует v5.0; on‑device E2E — финальная UX‑проверка

### 6.3 Performance targets ❌ НЕ ИЗМЕРЕНО
- Невозможно без работающего сервера

---

## 📈 МЕТРИКИ УСПЕХА

### Обязательные (Definition of Done):
- [✅] Device Binding v2 через Secure Enclave (DER/SPKI + SHA256)
- [✅] Single‑Key (один Ed25519)
- [✅] 12 слов BIP39
- [✅] Challenge‑response login/recovery (сервер/клиент контракты)
- [✅] Recovery = re‑bind
- [✅] Клиентский флоу готов (on‑device E2E — check UX)

### Желательные:
- [ ] Миграция существующих пользователей без потери данных
- [ ] Graceful fallback для устройств без SE
- [ ] Offline mode с кешированием JWT

---

## ⚠️ РИСКИ И МИТИГАЦИЯ

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Потеря доступа при миграции | Средняя | Критично | Backup старых ключей на 30 дней |
| SE недоступен на старых устройствах | Низкая | Средне | Fallback на обычный Keychain |
| Backend несовместимость | Средняя | Высоко | Версионирование API |
| Производительность упадёт | Низкая | Средне | Кеширование и оптимизация |

---

## 🚀 ПОРЯДОК ВЫПОЛНЕНИЯ (факт)

**День 1-2:** Phase 1 — ✅ Выполнено (SE‑binding + DER/SPKI)
**День 3:** Phase 2 — ✅ Выполнено (Single‑Key + 12 слов)
**День 4:** Phase 3 — ✅ Выполнено (Challenge‑Response)
**День 5:** Phase 5 — ✅ Выполнено (Backend интеграция + серверный E2E)
**День 6:** Phase 4 — ⚠️ В процессе (Keychain/Face ID полировка)
**День 7:** Phase 6 — ⚠️ iOS E2E и финальный QA

---

## 📊 **РЕАЛЬНЫЙ СТАТУС НА 24 СЕНТЯБРЯ 2025:**

### **ЧТО РЕАЛЬНО ВЫПОЛНЕНО:**
1. **iOS код обновлён** под v5.0 (Register/Login/Recovery, DER/SPKI, challengeId)
2. **Сервер и БД** приведены к v5.0; все эндпоинты работают
3. **Серверный E2E** (register→login dual→mismatch→recovery→login) — пройден; добавлен авто‑rebind на клиенте

### **КРИТИЧЕСКИЕ БЛОКЕРЫ:**
• Остались: негативные тесты (expired/malformed), покрытие unit/integration, финальный QA.

### **РЕАЛЬНАЯ ГОТОВНОСТЬ: ~85–90% по v5.0**
