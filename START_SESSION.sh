#!/bin/bash
# 🚀 CYPHR MESSENGER - SESSION STARTUP SCRIPT
# ВСЕГДА ЗАПУСКАТЬ В НАЧАЛЕ КАЖДОЙ СЕССИИ!

echo "=========================================="
echo "🚀 CYPHR MESSENGER SESSION STARTUP"
echo "=========================================="
echo ""

echo "📚 [1/9] СИСТЕМА РАБОТЫ..."
echo "----------------------------------------"
cat /Users/daniilbogdanov/cyphrmessenger/CLAUDE_WORK_SYSTEM.md | head -50
echo ""

echo "📊 [2/9] ТЕКУЩИЙ СТАТУС..."
echo "----------------------------------------"
cat /Users/daniilbogdanov/cyphrmessenger/SESSION_STATUS.md | head -50
echo ""

echo "📋 [3/9] АКТИВНЫЕ ЗАДАЧИ..."
echo "----------------------------------------"
cat /Users/daniilbogdanov/cyphrmessenger/TODO_CURRENT.md | head -50
echo ""

echo "🚨 [4/9] ТЕКУЩИЕ ОШИБКИ..."
echo "----------------------------------------"
cat /Users/daniilbogdanov/cyphrmessenger/CURRENT_ERRORS.md | head -50
echo ""

echo "🏗️ [5/9] АРХИТЕКТУРА ПРОЕКТА..."
echo "----------------------------------------"
cat /Users/daniilbogdanov/cyphrmessenger/PROJECT_ARCHITECTURE.md | head -50
echo ""

echo "📡 [6/9] API ENDPOINTS..."
echo "----------------------------------------"
cat /Users/daniilbogdanov/cyphrmessenger/API_ENDPOINTS.md | head -30
echo ""

echo "🔍 [7/9] ПРОВЕРКА PRODUCTION..."
echo "----------------------------------------"
echo "Checking server status..."
ssh -i /Users/daniilbogdanov/cyphrmessenger/cyphr-messenger-key.pem ubuntu@23.22.159.209 "pm2 status" 2>/dev/null || echo "SSH failed"
echo ""

echo "Checking API health..."
curl -s https://app.cyphrmessenger.app/api/health | jq . 2>/dev/null || echo "API health check failed"
echo ""

echo "Checking login endpoint..."
curl -s -X POST https://app.cyphrmessenger.app/api/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+19075388374"}' | jq . 2>/dev/null || echo "Login endpoint check failed"
echo ""

echo "=========================================="
echo "✅ STARTUP COMPLETE!"
echo "=========================================="
echo ""
echo "🎯 ГЛАВНАЯ ЗАДАЧА:"
grep "#### 1." /Users/daniilbogdanov/cyphrmessenger/TODO_CURRENT.md | head -1
echo ""
echo "⚠️ ГЛАВНАЯ ОШИБКА:"
grep "### 2." /Users/daniilbogdanov/cyphrmessenger/CURRENT_ERRORS.md | head -1
echo ""
echo "📈 PRODUCTION READINESS:"
grep "PRODUCTION READINESS:" /Users/daniilbogdanov/cyphrmessenger/SESSION_STATUS.md | tail -1
echo ""
echo "=========================================="
echo "🚀 ГОТОВ К РАБОТЕ!"
echo "=========================================="