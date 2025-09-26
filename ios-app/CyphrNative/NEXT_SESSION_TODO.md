# ✅ Next Session TODO (Cyphr Messenger)
**Date prepared:** September 20, 2025 — evening
**Owner:** Codex Autopilot

## 1) Welcome UI — Restore 1:1 visuals (no logic change)
- [ ] Вернуть точный дизайн Welcome (неон‑лого, градиенты, glassmorphism) согласно исходной реализации (`possible_trash/WelcomeView 2.swift`).
- [ ] Сохранить только потоки: авто Face ID при наличии identity, PIN‑экран после биометрии.
- [ ] Скрыть сетевой баннер на Welcome (если мешает), оставить для SignUp/Login экранов.

## 2) Identity state with empty DB
- [ ] При пустой БД сервер отдаёт 404 на `GET /api/cyphr-id/user/:id`; UI обязан показывать «новое устройство» (никаких «Device Identity Found»).
- [ ] Не выполнять авто‑wipe локальных ключей; wipe остаётся отдельной функцией.
- [ ] Написать быструю проверку при старте: лог (Splash → check → route) фиксируется в EXECUTION_LOG.md.

## 3) PIN flow
- [ ] Завершить PIN‑поток: единый экран ввода PIN (уже добавлен) + опция «забыли PIN?» с переходом на recovery.
- [ ] Вынести настройку/смену PIN в Settings/Profile.

## 4) Networking & Messaging
- [ ] Дедуп в `NetworkService.swift` (убрать случайные дубли `loginCyphrIdentityP256`, `StringOrInt` если встретятся при слияниях).
- [ ] Финализировать заглушки discovery/WebRTC/Wallet на реальные эндпоинты после подтверждения серверного контракта.
- [ ] Messaging smoke‑test: отправка/получение текста, расшифровка, создание чата; проверить Kyber payload на сервере (PM2 логи).

## 5) Build & QA
- [ ] Прогнать `xcodebuild -project CyphrNative.xcodeproj -scheme CyphrNative -destination 'platform=iOS Simulator,name=iPhone 16 Pro,OS=18.6' build` локально до успеха, сверить Result Bundle.
- [ ] Ручной сценарий: Sign Up → Auto Login → Logout → Face ID → PIN → Recovery; сверить PM2‑логи и Socket.IO reconnect.
- [ ] На устройстве проверить доступность `kyber_private_key`/`auth_token` после force quit/перезапуска.

> **Note:** Дизайн Welcome не менять — только восстановить. Все изменения логировать в `EXECUTION_LOG.md`. Любые серверные правки — отдельно согласовать.
