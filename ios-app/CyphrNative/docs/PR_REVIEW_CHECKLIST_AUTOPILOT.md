# ✅ PR Review Checklist — Cyphr Autopilot (Patch-only)

## A. Zero-Knowledge (ZK) & Crypto Invariants
- [ ] **No server decrypt:** на стороне Node/Express отсутствуют любые попытки расшифровки, дешифровочные примитивы, Kyber/ChaCha-библиотеки, WASM-модули, Decapsulate/Decrypt-функции. Любые упоминания — только в клиентском iOS коде. (Архитектура запрещает дешифрование на сервере.)
      Evidence: CI `forbid-server-decrypt` зелёный.
      Rationale: Zero-Knowledge и Kyber+ChaCha только на iOS.
- [ ] **Public-only server:** сервер хранит только публичные ключи, зашифрованные блобы и минимальные метаданные; нет приватных ключей/сидов/фраз.
- [ ] **Контракты API без plaintext:** запросы/ответы не содержат открытого текста сообщения/ключей.

_Норматив:_ Encryption Architecture + Server Architecture.
(см. ENCRYPTION_ARCHITECTURE.md; SERVER_ARCHITECTURE.md)

## B. Secrets & Compliance
- [ ] **No secrets in code/PR:** никаких паролей/токенов/ключей в диффе, .env не коммитится; все секреты — через GitHub Secrets / AWS Secrets Manager.
- [ ] **Compromised-by-history rotation:** если PR затрагивает конфигурацию с упомянутыми ранее секретами, приложен план ротации и миграции.
- [ ] **Логи/дампы:** убедиться, что нет логов с чувствительными данными.

_Норматив:_ Incident & server ops правила, статус/инциденты.

## C. iOS Security & UX Flow (ID + Onboarding)
- [ ] **BIP39 в Bundle:** `bip39-english.txt` реально включён в **Copy Bundle Resources** Xcode‑таргета.
- [ ] **Face ID/Touch ID:** присутствует `NSFaceIDUsageDescription` в Info.plist; биометрия инициируется корректно с `LAContext`, есть PIN‑fallback и rate limiting.
- [ ] **Keychain policies:** приватные ключи/фразы — `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` + `biometryCurrentSet` где требуется; запись проверяется чтением.
- [ ] **Auto‑Login:** после регистрации сразу переход в `MainTabView`, JWT/сессия в Keychain, авто‑вход при старте.
- [ ] **LoadingOverlay:** все новые/изменённые async‑потоки (регистрация, логин, отправка сообщений/медиа, recovery) обёрнуты в LoadingOverlay (user‑feedback, отмены/таймауты).

_Норматив:_ Cyphr ID Architecture + UX Architecture + Roadmap.

## D. iOS Build & Targets
- [ ] **iOS min target ≥ 15.0**
- [ ] **ATS/Pinning:** нет `NSAllowsArbitraryLoads=true`; pinning запланирован/включён.
- [ ] **Unit/UI tests:** тесты для BIP39, Keychain/biometry, PQC encrypt/decrypt (локально), basic E2E onboarding.

## E. Scope & Process (Patch-only Discipline)
- [ ] **Patch-only:** PR содержит точечные диффы, без «перезаписи файла целиком»; один PR — одна цель.
- [ ] **Propose→Apply→Verify:** PR оформлен по шаблону (ниже), приложены логи сборки/тестов, скриншоты/видео по Verify.
- [ ] **Docs updated:** обновлён статус/hand‑over в документации после изменений.

## F. Rollback & Ops
- [ ] **Rollback plan:** чётко описан способ отката (фичефлаг/реверт/конфигурация).
- [ ] **Server untouched (crypto):** любые серверные правки не нарушают ZK‑инварианты (см. CI‑проверку).

### Почему именно так:
Сервер никогда не должен уметь расшифровывать; это краеугольный принцип, отражённый в архитектуре шифрования и серверной архитектуре.
(ENCRYPTION_ARCHITECTURE.md, SERVER_ARCHITECTURE.md)

### Почему проверяем BIP39/Face ID/Keychain/Auto‑Login/LoadingOverlay:
Это подтверждённые блокеры и требования UX/ID‑спецификаций и roadmap к production‑готовности.
(CLAUDE_recovered.md, CYPHR_PRODUCTION_ROADMAP.md, CYPHR_COMPLETE_UX_ARCHITECTURE.md, CYPHR_ID_ARCHITECTURE.md)