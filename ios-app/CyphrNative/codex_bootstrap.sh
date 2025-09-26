#!/bin/bash
# 🚀 CYPHR CODEX BOOTSTRAP SCRIPT v3.1
# Автономная инициализация для GPT Codex Agent
# Дата: 18 сентября 2025

set -euo pipefail

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       🚀 CYPHR CODEX AUTOPILOT BOOTSTRAP v3.1         ║${NC}"
echo -e "${BLUE}║            Zero-Knowledge iOS Messenger                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Проверка текущей директории
EXPECTED_DIR="/Users/daniilbogdanov/cyphrmessenger/ios-app/CyphrNative"
CURRENT_DIR=$(pwd)

if [ "$CURRENT_DIR" != "$EXPECTED_DIR" ]; then
    echo -e "${YELLOW}⚠️  Переход в рабочую директорию...${NC}"
    cd "$EXPECTED_DIR" || {
        echo -e "${RED}❌ Не могу перейти в $EXPECTED_DIR${NC}"
        exit 1
    }
fi

echo -e "${GREEN}✅ Рабочая директория: $(pwd)${NC}"
echo ""

# ═══════════════════════════════════════════════════════════
# PRE-FLIGHT CHECKS
# ═══════════════════════════════════════════════════════════

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    PRE-FLIGHT CHECKS                       ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# CHECK 1: Xcode установлен
echo -n "1. Проверка Xcode... "
if command -v xcodebuild &> /dev/null; then
    XCODE_VERSION=$(xcodebuild -version | head -1)
    echo -e "${GREEN}✅ $XCODE_VERSION${NC}"
else
    echo -e "${RED}❌ Xcode не установлен!${NC}"
    echo "   Установите Xcode из App Store"
    exit 1
fi

# CHECK 2: Recovery phrase = 12 слов (не 24!)
echo -n "2. Recovery phrase настроен для 12 слов... "
if grep -q "wordCount = 12" HDWalletService.swift 2>/dev/null || \
   grep -q "mnemonicWordCount: 12" HDWalletService.swift 2>/dev/null; then
    echo -e "${GREEN}✅ 12 words (128-bit entropy)${NC}"
else
    echo -e "${YELLOW}⚠️  Требуется проверка (должно быть 12, НЕ 24!)${NC}"
fi

# CHECK 3: BIP39 wordlist существует
echo -n "3. BIP39 wordlist файл... "
if [ -f "Resources/bip39-english.txt" ]; then
    WORD_COUNT=$(wc -l < Resources/bip39-english.txt | tr -d ' ')
    if [ "$WORD_COUNT" -eq "2048" ]; then
        echo -e "${GREEN}✅ Найден (2048 слов)${NC}"
    else
        echo -e "${RED}❌ Неверное количество слов: $WORD_COUNT (должно быть 2048)${NC}"
    fi
else
    echo -e "${RED}❌ НЕ НАЙДЕН! Критический блокер!${NC}"
fi

# CHECK 4: Keychain Policy правильный
echo -n "4. Keychain policy (WhenUnlockedThisDeviceOnly)... "
if grep -q "kSecAttrAccessibleWhenUnlockedThisDeviceOnly" EnterpriseKeychainService.swift 2>/dev/null; then
    echo -e "${GREEN}✅ Правильный policy${NC}"
else
    echo -e "${YELLOW}⚠️  Требуется проверка${NC}"
fi

# CHECK 5: iOS Target >= 15.0
echo -n "5. iOS deployment target... "
if [ -f "CyphrNative.xcodeproj/project.pbxproj" ]; then
    if grep -q "IPHONEOS_DEPLOYMENT_TARGET = 15" CyphrNative.xcodeproj/project.pbxproj || \
       grep -q "IPHONEOS_DEPLOYMENT_TARGET = 16" CyphrNative.xcodeproj/project.pbxproj || \
       grep -q "IPHONEOS_DEPLOYMENT_TARGET = 17" CyphrNative.xcodeproj/project.pbxproj; then
        echo -e "${GREEN}✅ >= 15.0${NC}"
    else
        echo -e "${RED}❌ Неверный target (должен быть >= 15.0)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Xcode project не найден${NC}"
fi

# CHECK 6: Face ID permission
echo -n "6. Face ID usage description... "
if [ -f "Info.plist" ] && grep -q "NSFaceIDUsageDescription" Info.plist; then
    echo -e "${GREEN}✅ Настроено${NC}"
else
    echo -e "${YELLOW}⚠️  Требуется добавить в Info.plist${NC}"
fi

# CHECK 7: SwiftKyber существует
echo -n "7. SwiftKyber (Post-Quantum Crypto)... "
if [ -d "SwiftKyber" ]; then
    echo -e "${GREEN}✅ Локальный пакет найден${NC}"
else
    echo -e "${RED}❌ НЕ НАЙДЕН! Критично для шифрования!${NC}"
fi

# CHECK 8: Server не содержит decrypt
echo -n "8. Server Zero-Knowledge compliance... "
if [ -d "../../server" ]; then
    if grep -r "decrypt\|Decapsulate\|ChaCha20\|Kyber" ../../server --include="*.js" --include="*.cjs" &>/dev/null; then
        echo -e "${RED}❌ НАРУШЕНИЕ! Сервер содержит крипто-примитивы!${NC}"
    else
        echo -e "${GREEN}✅ Сервер чистый (no decryption)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Server директория не найдена${NC}"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                   CRITICAL BLOCKERS STATUS                 ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Отображаем статус критических блокеров
echo -e "${YELLOW}📋 КРИТИЧЕСКИЕ БЛОКЕРЫ (из CLAUDE_recovered.md):${NC}"
echo ""
echo "1. ${RED}BIP39 НЕ В BUNDLE${NC}"
echo "   📁 Resources/bip39-english.txt существует"
echo "   ❌ НЕ добавлен в Copy Bundle Resources"
echo "   🔧 Fix: Xcode → Build Phases → Copy Bundle Resources → Add"
echo ""
echo "2. ${RED}FACE ID ДВОЙНОЙ ПРОМПТ${NC}"
echo "   📱 BiometricAuthService.swift + KeychainService конфликт"
echo "   🔧 Fix: Единый LAContext для обоих сервисов"
echo ""
echo "3. ${RED}KEYCHAIN НЕ СОХРАНЯЕТ${NC}"
echo "   🔐 Ключи теряются после перезапуска"
echo "   🔧 Fix: kSecAttrAccessibleWhenUnlockedThisDeviceOnly"
echo ""
echo "4. ${RED}AUTO-LOGIN НЕ РАБОТАЕТ${NC}"
echo "   🚪 После регистрации пользователь застревает"
echo "   🔧 Fix: isAuthenticated → MainTabView transition"
echo ""
echo "5. ${RED}SOCKET.IO НЕ ПОДКЛЮЧАЕТСЯ${NC}"
echo "   🔌 WebSocket connection fails"
echo "   🔧 Fix: Правильная конфигурация Socket.IO"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    ARCHITECTURE RULES                      ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${GREEN}✅ ОБЯЗАТЕЛЬНО:${NC}"
echo "• Zero-Knowledge: Сервер НИКОГДА не видит private keys"
echo "• Post-Quantum: Kyber1024 + ChaCha20 только на клиенте"
echo "• Recovery: ВСЕГДА 12 слов (НЕ 24!)"
echo "• Keychain: WhenUnlockedThisDeviceOnly + biometryCurrentSet"
echo "• UX Flow: ID→Keys→Biometric→PIN→Register→Recovery→MainTabView"
echo ""

echo -e "${RED}❌ ЗАПРЕЩЕНО:${NC}"
echo "• Добавлять crypto/decrypt на сервер"
echo "• Использовать 24 слова для recovery"
echo "• Перезаписывать файлы целиком (только patch/diff)"
echo "• Коммитить секреты в код"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    READY FOR CODEX                        ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Создаем файл статуса для Codex
cat > CODEX_STATUS.json << EOF
{
  "version": "3.1.0",
  "date": "$(date -Iseconds)",
  "status": "READY_FOR_FIXES",
  "real_completion": 62,
  "critical_blockers": [
    {
      "id": "BIP39_BUNDLE",
      "severity": "CRITICAL",
      "file": "Resources/bip39-english.txt",
      "issue": "Not in Copy Bundle Resources",
      "fix": "Add to Xcode Build Phases"
    },
    {
      "id": "FACE_ID_DOUBLE",
      "severity": "HIGH",
      "file": "BiometricAuthService.swift",
      "issue": "Double Face ID prompt",
      "fix": "Single LAContext instance"
    },
    {
      "id": "KEYCHAIN_PERSISTENCE",
      "severity": "CRITICAL",
      "file": "EnterpriseKeychainService.swift",
      "issue": "Keys lost on restart",
      "fix": "Use kSecAttrAccessibleWhenUnlockedThisDeviceOnly"
    },
    {
      "id": "AUTO_LOGIN",
      "severity": "HIGH",
      "file": "CyphrIdSignUpView.swift",
      "issue": "No auto-login after signup",
      "fix": "Set isAuthenticated and navigate"
    },
    {
      "id": "SOCKET_IO",
      "severity": "HIGH",
      "file": "MessagingService.swift",
      "issue": "WebSocket fails to connect",
      "fix": "Configure Socket.IO properly"
    }
  ],
  "architecture": {
    "zero_knowledge": true,
    "post_quantum": "Kyber1024+ChaCha20",
    "recovery_words": 12,
    "ios_min_target": "15.0",
    "keychain_policy": "WhenUnlockedThisDeviceOnly+biometryCurrentSet"
  },
  "server": {
    "host": "23.22.159.209",
    "url": "https://app.cyphrmessenger.app",
    "database": "cyphr-messenger-prod.cgni4my4o6a2.us-east-1.rds.amazonaws.com"
  }
}
EOF

echo -e "${GREEN}✅ CODEX_STATUS.json создан${NC}"
echo ""

# Финальные инструкции
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              📋 ИНСТРУКЦИИ ДЛЯ CODEX AGENT             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "1. ${GREEN}ЧИТАТЬ ПЕРВЫМ:${NC}"
echo "   • main files/CLAUDE_recovered.md (реальный статус)"
echo "   • main files/ENCRYPTION_ARCHITECTURE.md"
echo "   • main files/CYPHR_ID_ARCHITECTURE.md"
echo "   • main files/SERVER_ARCHITECTURE.md"
echo ""
echo "2. ${GREEN}ИСПРАВИТЬ БЛОКЕРЫ (по порядку):${NC}"
echo "   • BIP39 → Xcode Build Phases"
echo "   • Face ID → Single LAContext"
echo "   • Keychain → Правильный policy"
echo "   • Auto-login → Navigation flow"
echo "   • Socket.IO → Configuration"
echo ""
echo "3. ${GREEN}ИСПОЛЬЗОВАТЬ PATCH-ONLY:${NC}"
echo "   • git diff для каждого изменения"
echo "   • Один PR = одна проблема"
echo "   • Тестировать после каждого fix"
echo ""
echo "4. ${GREEN}CI/CD ПРОВЕРКИ:${NC}"
echo "   • forbid-server-decrypt (ZK guard)"
echo "   • secrets-scan (gitleaks)"
echo "   • ios-build-test (Xcode)"
echo "   • Danger.js автоматический review"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}        🚀 BOOTSTRAP ЗАВЕРШЕН! READY FOR CODEX!           ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Запись в лог
echo "Bootstrap completed at $(date)" >> codex_bootstrap.log
echo "Critical blockers: 5" >> codex_bootstrap.log
echo "Real completion: 62%" >> codex_bootstrap.log