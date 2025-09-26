#!/bin/bash
set -euo pipefail

BASE_DIR="/Users/daniilbogdanov/cyphrmessenger"
APP_DIR="$BASE_DIR/ios-app/CyphrNative"

cd "$APP_DIR"

DOCS=(
  "main files/CLAUDE_recovered.md"
  "main files/CODEX_instructions.md"
  "main files/CYPHR_COMPLETE_UX_ARCHITECTURE.md"
  "main files/CYPHR_ID_ARCHITECTURE.md"
  "main files/CYPHR_PRODUCTION_ROADMAP.md"
  "main files/DATABASE_ARCHITECTURE.md"
  "main files/ENCRYPTION_ARCHITECTURE.md"
  "main files/REAL_PROJECT_STATUS_13_SEP_2025.md"
  "main files/SERVER_ARCHITECTURE.md"
  "$BASE_DIR/CODEX_SERVER_GUIDE.md"
  "$BASE_DIR/WEBRTC_SIGNALING_GUIDE.md"
  "NEXT_SESSION_TODO.md"
)

echo "📚 LOADING KEY DOCUMENTS..."
for doc in "${DOCS[@]}"; do
  echo "================================================================"
  echo "📄 $doc"
  echo "================================================================"
  if [ -f "$doc" ]; then
    cat "$doc"
  else
    echo "⚠️ File not found: $doc"
  fi
  echo ""; echo ""
  sleep 0.1
 done

echo "🔍 CHECKING SERVER STATUS..."
if command -v jq >/dev/null 2>&1; then
  curl -s https://app.cyphrmessenger.app/api/health | jq '.'
else
  curl -s https://app.cyphrmessenger.app/api/health
fi

cd "$APP_DIR"
echo "🚀 LAUNCHING CODEX AUTOPILOT"
./start_codex.sh
