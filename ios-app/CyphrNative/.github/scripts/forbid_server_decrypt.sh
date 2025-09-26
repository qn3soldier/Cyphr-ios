#!/usr/bin/env bash
# fail on: decrypt primitives, Kyber, ChaCha20/Poly1305, WASM crypto, decapsulate, createDecipher
set -euo pipefail

SRCDIR="${1:-server}"
if [ ! -d "$SRCDIR" ]; then
  echo "::warning::No server directory '$SRCDIR' — skipping."
  exit 0
fi

echo "🔒 ZK guard scanning $SRCDIR …"
# паттерны — только на сервере запрещены
PATTERNS=(
  "createDecipher"
  "createDecipheriv"
  "decrypt\\("
  "Decapsulate\\("
  "decapsulat"            # на всякий случай
  "ChaCha20"
  "Poly1305"
  "Kyber"                 # любые Kyber-артефакты
  "pqc"
  "wasm"
  "libsodium"
  "tweetnacl"
)

FOUND=0
for p in "${PATTERNS[@]}"; do
  if grep -R -n -E "$p" "$SRCDIR" --include="*.{js,ts,cjs,mjs,jsx,tsx}" >/tmp/zk_hits.txt 2>/dev/null; then
    echo "::error::Forbidden crypto/decrypt pattern on server: $p"
    sed -e 's/^/  /' /tmp/zk_hits.txt
    FOUND=1
  fi
done

if [ "$FOUND" -ne 0 ]; then
  echo "❌ Server must not contain decryption/PQC libs. See ENCRYPTION/SERVER architecture."
  exit 1
fi

echo "✅ ZK guard passed (no server-side decrypts or PQC libs)."