# PR Title: [One-purpose patch] <feature/fix>

## 0) Scope & Safety
- [ ] Patch-only (точечные диффы, без перезаписи файлов)
- [ ] No secrets in diff (проверено вручную)
- [ ] Zero-Knowledge preserved (сервер не умеет расшифровывать)
- [ ] iOS min target ≥ 15.0 (не менялся в сторону снижения)
- [ ] Docs updated (status/hand-over)

---

## 1) PROPOSE — Что и зачем
**Проблема/Цель:**
Коротко и чётко, на какой критерий приёмки/архитектурный пункт ссылаемся.
(ENCRYPTION/SERVER для ZK; UX/ID для онбординга/биометрии/LoadingOverlay; Roadmap для прод‑готовности.)

**Артефакты/файлы:**
- `…/SomeView.swift` — LoadingOverlay для async
- `…/CyphrIdentity.swift` — исправление Keychain/LAContext
- `server/...` — без крипто/дешифрования (N/A)

**Риски/Митигирование:**
- Поведение навигации/сессий; откат фича‑флагом и revert.

---

## 2) APPLY — Что именно изменилось
- Ключевые диффы (списком, 3–7 строк)
- Нет добавления серверных crypto/wasm/decipher
- BIP39: файл в Copy Bundle Resources (если релевантно)
- Face ID/Keychain: корректный `LAContext` + `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
- LoadingOverlay: добавлен на все новые/изменённые async‑пути

**Скриншоты/видосы (если UI):**
Вставьте 1–3 изображения/гиф.

---

## 3) VERIFY — Как проверил(а)
**Локальные шаги:**
1. `xcodebuild -project <...> -scheme <...> -destination '<sim>' test` — OK
2. E2E: Sign Up → Security → Recovery → Chats — OK
3. Sign In (Face ID → PIN fallback) — OK
4. Send/Receive (если затрагивалось) — OK

**CI‑результаты:**
- iOS build/tests — ✅
- `forbid-server-decrypt` — ✅
- `secrets-scan` — ✅/⚠️ (комментарий)

**Acceptance:**
Какие пункты из чек‑листа/roadmap закрыты.

---

## 4) Rollback plan
- revert commit / отключение флага / быстрая миграция (если применимо)

---

## 5) Notes for next session
- Что осталось / что вынести в следующий PR