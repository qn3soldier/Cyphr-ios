CYPHR MESSENGER — Единственный детальный план (MD)
Цель: довести iOS‑клиент, бекенд и UX/UI до «Enterprise/Production‑ready» состояния без указания сроков, с чёткими правилами работы через ChatGPT Codex (терминал/IDE), едиными стандартами качества, безопасностью уровня «zero‑knowledge» и проверяемыми критериями приёмки.

0) Что уже есть и что критично сломано (объективный baseline)
	•	Архитектура: зафиксирована — Zero‑Knowledge сервер, пост‑квантовая криптография Kyber1024 + ChaCha20‑Poly1305, вся криптография на iOS, сервер только маршрутизирует шифроблоки. ENCRYPTION_ARCHITECTURE  SERVER_ARCHITECTURE 
	•	iOS: реализованы ключевые модули (SwiftKyber, гибридное шифрование, SecuritySetup, RecoveryPhrase, LoadingOverlay), но есть блокеры: BIP39 ресурс не подключён в Bundle, Face ID не вызывает системный промпт/Keychain не даёт доступ к ключам, автологин после регистрации отсутствует, часть сервисов и навигации требует интеграции и компиляционных правок. CLAUDE_recovered 
	•	Бэкенд (AWS/EC2 + RDS): поднят, PM2 стабилен, Twilio/Supabase удалены, эндпоинты Cyphr ID и messaging работают, RDS/схема описаны, zero‑knowledge соблюдён. (Секреты в документах нужно считать скомпрометированными и перевыпустить). CLAUDE_recovered  SERVER_ARCHITECTURE DATABASE_ARCHITECTURE 
	•	UX Architecture: полный flow, требования к онбордингу, логину, recovery, основным табам (Chats/Calls/Wallet/Profile), модальные паттерны и матрица ошибок — задокументированы и согласованы. Нужно привести реализацию в точное соответствие. CYPHR_COMPLETE_UX_ARCHITECTURE 
	•	Roadmap/мастер‑план: есть готовая структура задач от «Foundation Fixes» до «Enterprise/Scale». Наш план ниже агрегирует, конкретизирует и делает исполнимым через Codex. CYPHR_PRODUCTION_ROADMAP CYPHR_IMPLEMENTATION_MASTERPLAN 

1) Нерушимые принципы и «Стоп‑флажки»
	1	Zero‑knowledge by design: приватные ключи и фразы никогда не покидают устройство; сервер не способенрасшифровать; только публичные ключи/хэши/шифроблоки. Проверяем это на каждом изменении (code review + интеграционные тесты). ENCRYPTION_ARCHITECTURE  SERVER_ARCHITECTURE 
	2	Crypto on iOS: SwiftKyber + CryptoKit; запрет любых серверных «подсобных» расшифровок/кейменеджмента. ENCRYPTION_ARCHITECTURE 
	3	Device‑binding: устройство = личность, биометрия/ПИН = пароль, recovery phrase = единственный резерв. Потоки входа и восстановления должны этому соответствовать. SERVER_ARCHITECTURE 
	4	Секреты вне кода: любые пароли/ключи, обнаруженные в документах, считаем скомпрометированными, ротуем и переносим в Secrets Manager/переменные окружения. Ссылаться в коде только на переменные среды. CLAUDE_recovered  SERVER_ARCHITECTURE  ENCRYPTION_ARCHITECTURE 
	5	Согласованность с UX‑спеком: фактические экраны/стримы обязаны соответствовать «COMPLETE UX ARCHITECTURE & FLOW MAP». Любое расхождение — баг. CYPHR_COMPLETE_UX_ARCHITECTURE 

2) Как правильно работать через ChatGPT Codex (терминал / IDE)
Ниже — практические «SOP» (Standard Operating Procedures) и готовые промпты‑шаблоны. Они учитывают уроки из инцидента с перезаписью документации и регламент из CLAUDE_recovered.md. 
CLAUDE_recovered
2.1 Базовые правила для Codex
	•	Только «Edit»/patch‑мод: запрещено перезаписывать существующие файлы целиком («Write»). Все правки — как дифф/патч к конкретным файлам. (Урок инцидента с потерей CLAUDE.md.) CLAUDE_recovered 
	•	Прежде чем менять — читать: в начале каждой сессии Codex должен:
	◦	просканировать Documentation/ и main files/ (CLAUDE_recovered.md, ENCRYPTION_ARCHITECTURE.md, CYPHR_ID_ARCHITECTURE.md, DATABASE_ARCHITECTURE.md, SERVER_ARCHITECTURE.md, ROADMAP/MASTERPLAN, TODO_NEXT_SESSION…). CLAUDE_recovered  ENCRYPTION_ARCHITECTURE SERVER_ARCHITECTURE  DATABASE_ARCHITECTURE  CYPHR_PRODUCTION_ROADMAP CYPHR_IMPLEMENTATION_MASTERPLAN 
	◦	построить карту изменений и список блокеров из CLAUDE_recovered.md (BIP39/FaceID/Keychain/Auto‑Login/деплой таргета/компиляционные ошибки). CLAUDE_recovered 
	•	Трёхфазный цикл каждой задачи: Propose → Apply → Verify
	1	Propose: описать идею/дифф/затронутые файлы/риски.
	2	Apply: внести минимально‑достаточный патч.
	3	Verify: собрать проект, запустить тесты/симулятор, выполнить быстрые ручные прогоны.
	•	Один патч — одна цель: не смешивать несвязанные изменения.
	•	Консервативность: без опасных API (force unwrap, блокирующие сети на main) и без отступления от Security/UX‑спека. CYPHR_COMPLETE_UX_ARCHITECTURE  ENCRYPTION_ARCHITECTURE 
	•	Документирование: после каждого значимого изменения обновлять статус‑файл/hand‑over в репозитории (см. шаблоны в CLAUDE_recovered.md). CLAUDE_recovered 
2.2 Шаблон стартового промпта для Codex (вставить как «супер‑инструкция»)
Роль: опытный iOS/Swift/SwiftUI/Крипто‑инженер + Node.js backend. Контекст проекта: Zero‑Knowledge, Kyber1024+ChaCha20, Cyphr ID без телефона/email. Правила работы: • Чтение всех доков в Documentation/ и main files/ перед правками. • Только «edit/patch» дифф‑правки, без перезаписи файлов. • Каждая задача: Propose → Apply → Verify (сборка Xcode, быстрые E2E проверки). • Никаких серверных дешифровок. • Любые секреты — через env/Secrets Manager. Команды проверки (локально):

cd ios-app/CyphrNative
xcodebuild -scheme CyphrNative -project CyphrNative.xcodeproj -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.0' build
swift build
Соблюдать: UX‑flows из CYPHR_COMPLETE_UX_ARCHITECTURE.md и ID‑архитектуру из CYPHR_ID_ARCHITECTURE.md. Первая цель: закрыть блокеры BIP39/Keychain/FaceID/Auto‑Login, синхронизировать навигацию и подключить PostQuantumCrypto к MessagingService.
(Этот шаблон соответствует «ритуалам сессии» из CLAUDE_recovered.md, включая hand‑over и запрет на «Write».) 
CLAUDE_recovered
2.3 Типовые мини‑промпты для конкретных задач
	•	BIP39 Bundle Fix: «Открой CyphrIdentity.swift и вызовы getBIP39WordList(). Добавь проверку ресурса в Bundle, graceful fallback, удали fatalError. Проверь, что Resources/bip39-english.txt реально попал в Bundle ResourcesXcode‑проекта. Приложи минимальный патч + шаги проверки (сборка + генерация фразы в симуляторе).» CYPHR_PRODUCTION_ROADMAP  CLAUDE_recovered 
	•	Face ID/Keychain: «В KeychainService и местах вызова биометрии внедри LAContext с localizedReason, обработай errSecInteractionNotAllowed, добавь PIN‑fallback. После записи ключа — верификация чтением. Приложи патч и сценарий проверки на устройстве.» CLAUDE_recovered  SERVER_ARCHITECTURE 
	•	Auto‑Login: «После успешной регистрации сохрани JWT в Keychain, выставь isAuthenticated = true и навигируй в MainTabView. Покрой это UI‑тестом простейшего онбординга.» CYPHR_PRODUCTION_ROADMAP CYPHR_COMPLETE_UX_ARCHITECTURE 
	•	Post‑Quantum Messaging: «Интегрируй PostQuantumCrypto в MessagingService: Kyber encapsulate → ChaCha20‑Poly1305 → сформируй HybridEncryptedPayload и используй существующие messaging endpoints. Добавь юнит‑тесты на шифрование/дешифрование.» ENCRYPTION_ARCHITECTURE  SERVER_ARCHITECTURE 

3) Рабочая структура задач (без сроков)
Ниже — «дорожная карта исполнения» без времени: Треки с полнотой требований и чётким Definition of Done (DoD) и Acceptance Tests.
Трек A — Фундамент iOS: аутентификация и хранилище
A1. Подключить BIP39 и убрать краши
	•	Включить Resources/bip39-english.txt в Bundle Resources, добавить checksum‑проверку (SHA‑256).
	•	В CyphrIdentity.getBIP39WordList() — безопасная загрузка, fallback на статический список, никаких fatalError. DoD: генерация и верификация 12 слов в Recovery UI, защита от скриншота активна. CLAUDE_recovered CYPHR_COMPLETE_UX_ARCHITECTURE 
A2. Face ID / Touch ID / PIN (biometric‑first, PIN‑fallback)
	•	Единый BiometricAuthService с корректным LAContext, человекочитаемые ошибки, автоматический откат на PIN (прогрессивные задержки).
	•	Правильные kSecAttrAccessible* и SecAccessControl для ключей, проверка успешной записи. DoD: биометрия показывает системный промпт; при неуспехе — PIN; после 15 неудачных попыток — авто‑wipe; автолок после таймаута. CYPHR_PRODUCTION_ROADMAP  SERVER_ARCHITECTURE 
A3. Auto‑Login + сессии
	•	После register — мгновенный вход, сохранение JWT в Keychain, восстановление сессии при старте.
	•	Обновление токена, корректная обработка истечения. DoD: «Sign Up → Recovery → Chats» без лишних экранов; повторный запуск приложения открывает чаты после биометрии/ПИН. CYPHR_PRODUCTION_ROADMAP  CYPHR_COMPLETE_UX_ARCHITECTURE 
A4. Верифицировать соответствие UX‑потокам
	•	Реализовать последовательность «ID → Keys → Biometric → PIN → Register → Recovery», как в UX‑архитектуре; фикс навигации и LoadingOverlay в каждом async. DoD: пошаговые индикаторы, все модальные состояния и ошибки по матрице. CYPHR_COMPLETE_UX_ARCHITECTURE  CLAUDE_recovered 
Трек B — Крипто и сообщения (E2E + PQC)
B1. Интеграция PostQuantumCrypto в MessagingService
	•	Kyber1024 encapsulation → общий секрет → ChaCha20‑Poly1305 запечатывает полезную нагрузку.
	•	Структура HybridEncryptedPayload (ciphertext, nonce, tag, senderId, ts). DoD: успешная отправка/получение текстового сообщения между двумя учётками; дешифровка только на iOS. ENCRYPTION_ARCHITECTURE  SERVER_ARCHITECTURE 
B2. Точность транспортного уровня
	•	HTTPS/WSS + пиннинг сертификата (ATS), корректные эндпоинты send/history/get-public-key. DoD: пиннинг включён, все запросы через TLS1.3, ошибки сети отображаются пользовательски. ENCRYPTION_ARCHITECTURE  SERVER_ARCHITECTURE 
B3. Ошибки/состояния
	•	Везде LoadingOverlay, понятные сообщения, retry, оффлайн‑очередь. DoD: нет «Something went wrong»; есть действия пользователя и логика повторов. CYPHR_PRODUCTION_ROADMAP 
Трек C — Медиа/голос/P2P
C1. Медиа‑пайплайн (фото/видео/документы)
	•	PHPicker, превью, сжатие, удаление EXIF/гео; шифрование файла и thumbnail разными ключами; загрузка на S3 с TTL/fallback; прогресс. DoD: отправка и просмотр медиа полностью зашифрованы, прогресс отображается; EXIF отсутствует. ENCRYPTION_ARCHITECTURE  DATABASE_ARCHITECTURE 
C2. Голосовые
	•	AVAudioEngine + Opus; chunk‑шифрование ChaCha20; UI записи/воспроизведения; waveform; P2P через WebRTC DataChannel, fallback → S3. DoD: запись/отправка/прослушивание; устойчивость к прерыванию сети; «hold to record» UX. ENCRYPTION_ARCHITECTURE  CYPHR_COMPLETE_UX_ARCHITECTURE 
Трек D — Кошелёк (HD‑wallet)
D1. Завершить UI и фоновые операции
	•	Балансы, история, send/receive, QR; авторизация транзакций по порогам (PIN/биометрия); в профиле — предупреждения при Reset Identity. DoD: транзакции выполняются; приватные ключи кошелька не покидают устройство; Reset проверяет баланс и предупреждает. CYPHR_COMPLETE_UX_ARCHITECTURE 
Трек E — Бэкенд и БД (Zero‑Knowledge соблюдение)
E1. Эндпоинты Cyphr ID / Messaging — соответствие спекам
	•	/api/cyphr-id/check|register|login|recover|invalidate, /api/messaging/send|history|get-public-key — форматы данных/коды ошибок выровнены со схемами клиента; никакой дешифровки. DoD: контракт «по документации»; инт‑тесты клиент↔сервер. SERVER_ARCHITECTURE ENCRYPTION_ARCHITECTURE 
E2. Секреты и конфиги
	•	Ротация обнаруженных паролей/токенов; перенос в .env/AWS Secrets Manager; обновление PM2/ecosystem; Health‑cheks. DoD: ни одного секрета в репозитории/логах; health и логи чистые. SERVER_ARCHITECTURE  CLAUDE_recovered 
E3. Схема БД
	•	Соответствие прод‑схеме: партиционирование messages, S3 для больших блобов, double‑hash контактов, индексы/GIN/BRIN; политики RLS по образцу. DoD: миграции применяются; пиковые запросы укладываются в заявленные лимиты. DATABASE_ARCHITECTURE 
Трек F — UX/UI polish (доведение до уровня Signal/WhatsApp)
	•	Прогресс‑хедеры «Step X of Y», анимации, тактильная отдача, тёмная тема, индикаторы «typing/online», «swipe to reply», корректные пустые состояния, единые модалки. DoD: визуально и тактильно «как нативный топ‑мессенджер»; все паттерны из UX‑дока соблюдены. CYPHR_COMPLETE_UX_ARCHITECTURE 
Трек G — Безопасность и приватность
	•	Пиннинг TLS, защита RecoveryPhrase (скриншоты/запись/буфер), auto‑lock/blur, Argon2 для PIN‑хэширования (или согласованный алгоритм), rate‑limiting, логика wipe, защита метаданных (обфускация времени, отсутствие EXIF). DoD: чек‑лист шифрования/приватности полностью зелёный; эксплойты из модели угроз не воспроизводятся. ENCRYPTION_ARCHITECTURE  CYPHR_COMPLETE_UX_ARCHITECTURE 

4) Definition of Done (DoD) и Acceptance Tests — по каждому треку
Критерии приёмки должны быть автоматизируемыми максимально возможно. Ниже — сокращённый список (полный — в репозитории тестов).
iOS аутентификация
	•	BIP39: юнит‑тест проверяет, что из Bundle читаются ровно 2048 слов; детерминированные тест‑векторы — OK. (Падений/fatalError нет.) CYPHR_PRODUCTION_ROADMAP 
	•	Biometry/PIN: на устройстве появляется системный промпт; при ошибке — PIN; после 15 неудач — wipe; Keychain survive restart (инструментальный тест). SERVER_ARCHITECTURE 
	•	Auto‑Login: E2E UI‑тест «SignUp→Recovery→Chats» без экранов логина; при рестарте — биометрия и мгновенный вход. CYPHR_COMPLETE_UX_ARCHITECTURE 
Сообщения
	•	PQC E2E: модульный тест «encrypt→route→decrypt»: текст до 4KB; зашифрованный blob недешифруем сервером; проверка тэгов аутентичности. ENCRYPTION_ARCHITECTURE 
	•	Сеть/ошибки: имитация 500/timeout/offline — UI показывает чёткие сообщения и предлагает retry; Offline‑очередь доставляет при восстановлении. CYPHR_PRODUCTION_ROADMAP 
Медиа/голос
	•	EXIF/гео: в выгруженном на S3 зашифрованном объекте нет метаданных; превью шифруется отдельным ключом. ENCRYPTION_ARCHITECTURE  DATABASE_ARCHITECTURE 
	•	Voice: записанный клип → Opus → chunk‑шифрование → доставка P2P или S3 → воспроизведение, waveform отображается. ENCRYPTION_ARCHITECTURE 
Бэкенд/БД
	•	Контракты: snapshot‑тесты схем запрос/ответ для /api/cyphr-id/*, /api/messaging/* совпадают со спеком; никакой дешифровки; public‑keys кэшируются; rate‑limit включён. SERVER_ARCHITECTURE 
	•	Схема: миграции создают партиции, индексы; latency запросов в пределах спецификаций; файловые блобы только в S3. DATABASE_ARCHITECTURE 
UX/UI
	•	Соответствие макетам: онбординг и основные табы — пиксель‑перфект по структуре/паттернам; LoadingOverlay в каждом async. CYPHR_COMPLETE_UX_ARCHITECTURE  CYPHR_PRODUCTION_ROADMAP 

5) Архитектурные конвенции и код‑стайл
	•	Swift: async/await, Result только там, где оправдано; без fatalError в прод; никаких принтов в прод (логгирование через абстракцию).
	•	Безопасность: запрет на force unwrap; Keychain доступ — только через сервис с централизованной политикой (biometry/PIN, kSecAttrAccessibleWhenUnlockedThisDeviceOnly). SERVER_ARCHITECTURE 
	•	Навигация: ObservableObject + @StateObject, без прямого UIKit из SwiftUI; правила навигации/guards — как в UX‑архитектуре. CYPHR_COMPLETE_UX_ARCHITECTURE 
	•	Сервер: Express + Socket.IO, input validation, rate‑limiting, helmet, CORS, JWT; никакой криптографии расшифровки. SERVER_ARCHITECTURE 

6) Безопасность и приватность — контрольный список
	•	TLS pinning / ATS (iOS), TLS1.3 (сервер), RDS SSL. SERVER_ARCHITECTURE  ENCRYPTION_ARCHITECTURE 
	•	Keychain: biometryCurrentSet, ThisDeviceOnly, без iCloud‑синхронизации; очистка в Reset. SERVER_ARCHITECTURE 
	•	Recovery: защита экрана (скриншот/запись), авто‑очистка буфера обмена через 30с, верификация 3 слов. CYPHR_COMPLETE_UX_ARCHITECTURE 
	•	Metadata hygiene: удаление EXIF/гео, округление timestamps, хэш‑идентификаторы. DATABASE_ARCHITECTURE  ENCRYPTION_ARCHITECTURE 
	•	Server: отсутствие приватных ключей/фраз/открытого текста, только зашифрованные блобы и публичные ключи. SERVER_ARCHITECTURE  ENCRYPTION_ARCHITECTURE 

7) Тестовая стратегия
	•	Unit (iOS): BIP39, Kyber encapsulate/decapsulate (заглушки), ChaCha20 seal/open, Keychain policies, UsernameValidator, PIN rate limiting. ENCRYPTION_ARCHITECTURE  CYPHR_COMPLETE_UX_ARCHITECTURE 
	•	UI Tests (iOS): Onboarding E2E; SignIn (bio/PIN); Send/Receive message; Media send; Voice record/play. CYPHR_COMPLETE_UX_ARCHITECTURE 
	•	Contract Tests (API): JSON‑снимки ответов; негативные сценарии (403/404/500/timeout). SERVER_ARCHITECTURE 
	•	Load/Perf: пиковая скорость вставки сообщений/истории, WebSocket фан‑аут, задержки <100ms E2E (в локальной/стейдж среде). DATABASE_ARCHITECTURE  ENCRYPTION_ARCHITECTURE 

8) Подготовка к выкату / публикации
	•	iOS проект: корректный deployment target (≥ iOS 15), все ресурсы добавлены в bundle, privacy‑маніфесты/permissions строки, ATS/pinning, сборка на устройстве. CLAUDE_recovered 
	•	Набор маркетинговых материалов: скриншоты, превью, описание, политика приватности (с акцентом на zero‑knowledge). (Требования — см. ROADMAP.) CYPHR_PRODUCTION_ROADMAP 
	•	Операции: PM2 процессы, health‑checks, логирование, алёрты CloudWatch; секреты — через .env/Secrets Manager; ротация унаследованных паролей. SERVER_ARCHITECTURE  CLAUDE_recovered 

9) Шаблон «ручки» для каждой сессии Codex (Handover)
Фиксируется в репозитории (например, DOCS/SESSION_LOGS/YYYY-MM-DD.md) — формат наследуем из CLAUDE_recovered.md. 
CLAUDE_recovered

## 📅 СЕССИЯ [ДАТА] — [КРАТКОЕ НАЗВАНИЕ]
### ✅ Что сделано
- [Файл:Строки] — [Суть патча]
- …

### ❌ Проблемы/риски
- …

### 🔍 Верификация
- Команда сборки/запуска:
- Скриншоты/логи/результаты тестов:

### 🎯 Следующие шаги
- [ ] Задача 1 …
- [ ] Задача 2 …

10) Конкретные стартовые действия (сегодня, без сроков — просто порядок)
Эти шаги можно буквально выполнить с Codex в терминале/IDE.
	1	Зафиксировать секреты: удалить из кода/конфига, перевыпустить и поместить в .env/AWS Secrets Manager, перечитать сервер pm2 restart. (Все найденные в документах пароли/ключи считать скомпрометированными.) CLAUDE_recovered  SERVER_ARCHITECTURE 
	2	BIP39 в Bundle: добавить Resources/bip39-english.txt в Copy Bundle Resources; патч CyphrIdentity.getBIP39WordList(); мини‑тест: сгенерировать 12 слов в Recovery. CLAUDE_recovered  CYPHR_PRODUCTION_ROADMAP 
	3	Face ID/Keychain: внедрить BiometricAuthService, исправить доступность ключей, добавить диагностический экран Dev‑Diagnostics (наличие ключей/ошибки). CLAUDE_recovered  SERVER_ARCHITECTURE 
	4	Auto‑Login: после register сразу выставлять isAuthenticated и навигировать в MainTabView; хранить JWT в Keychain; при старте — биометрия и бесшовный вход. CYPHR_PRODUCTION_ROADMAP CYPHR_COMPLETE_UX_ARCHITECTURE 
	5	Post‑Quantum Messaging: подключить PostQuantumCrypto к MessagingService и пройти E2E (текст). ENCRYPTION_ARCHITECTURE  SERVER_ARCHITECTURE 
	6	LoadingOverlay: применить ко всем async в онбординге/логине/отправке сообщений. CLAUDE_recovered CYPHR_PRODUCTION_ROADMAP 

11) Ссылки на спецификации (что читать при споре)
	•	Текущий набор проблем/статус, локации серверов, инфраструктура, баг‑лист — CLAUDE_recovered.md. CLAUDE_recovered 
	•	Production roadmap/критерии готовности к релизу — CYPHR_PRODUCTION_ROADMAP.md. CYPHR_PRODUCTION_ROADMAP 
	•	Полная UX архитектура/потоки/правила навигации и модалок — CYPHR_COMPLETE_UX_ARCHITECTURE.md. CYPHR_COMPLETE_UX_ARCHITECTURE 
	•	Cyphr ID (аутентификация/биометрия/PIN/Recovery/Device‑binding) — CYPHR_ID_ARCHITECTURE.md. SERVER_ARCHITECTURE 
	•	Сервер (эндпоинты, сокеты, Zero‑Knowledge ограничения) — SERVER_ARCHITECTURE.md. SERVER_ARCHITECTURE 
	•	Шифрование (Kyber1024 + ChaCha20, медиа/голос/звонки, ключевая иерархия) — ENCRYPTION_ARCHITECTURE.md. ENCRYPTION_ARCHITECTURE 
	•	База данных (RDS/Postgres, партиции, S3, double‑hash, индексы) — DATABASE_ARCHITECTURE.md. DATABASE_ARCHITECTURE 
	•	Мастер‑план реализации/масштабирование/командная структура — CYPHR_IMPLEMENTATION_MASTERPLAN.md. CYPHR_IMPLEMENTATION_MASTERPLAN 

Финальная пометка
Да — Codex сможет довести проект до нужного состояния, если строго соблюдать данную операционную модель: «только patch‑правки», обязательное чтение и соответствие спецификациям, трифазный цикл Propose → Apply → Verify, автоматизация приёмки и ненарушаемые принципы Zero‑Knowledge/PQC. Мы зафиксировали полный перечень задач, критерии DoD/Acceptance и рабочие подсказки для Codex. На любом этапе опирайтесь на конкретные документы — они уже содержат все технические договорённости и контрольные точки качества. 
CLAUDE_recovered
 
CYPHR_PRODUCTION_ROADMAP
 
CYPHR_COMPLETE_UX_ARCHITECTURE
 
SERVER_ARCHITECTURE
ENCRYPTION_ARCHITECTURE
 
DATABASE_ARCHITECTURE
 
CYPHR_IMPLEMENTATION_MASTERPLAN
