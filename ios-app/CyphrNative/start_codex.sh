#!/bin/bash
# Quick start script for GPT Codex Agent

cd /Users/daniilbogdanov/cyphrmessenger/ios-app/CyphrNative

echo "🤖 INITIALIZING CYPHR CODEX AGENT..."
echo ""
echo "GitHub: https://github.com/qn3soldier/Cyphr-ios"
echo "Branch: main"
echo "Path: ios-app/CyphrNative"
echo ""

# Run bootstrap to check current status
./codex_bootstrap.sh

echo ""
echo "════════════════════════════════════════════════════════════"
echo "📋 CODEX AGENT INSTRUCTIONS:"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "1. READ: .autopilot/codex.autopilot.yml (configuration)"
echo "2. READ: CODEX_README.md (quick guide)"
echo "3. CHECK: CODEX_STATUS.json (5 critical blockers)"
echo "4. READ: main files/CLAUDE_recovered.md (real status: 62%)"
echo "5. FIX: Each blocker using patch-only approach"
echo "6. TEST: Run 'xcodebuild test' after each fix"
echo "7. VERIFY: E2E flow works (SignUp → Chats)"
echo ""
echo "⚠️  REMEMBER:"
echo "• Zero-Knowledge: NO decrypt on server"
echo "• Recovery: ALWAYS 12 words (not 24!)"
echo "• iOS Target: >= 15.0"
echo "• Approach: patch-only (no file overwrites)"
echo ""
echo "🚀 START FIXING BLOCKERS NOW!"