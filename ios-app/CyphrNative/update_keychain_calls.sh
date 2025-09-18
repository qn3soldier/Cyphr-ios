#!/bin/bash

# Script to update keychain calls to use async version

echo "Updating CyphrIdentity to use async keychain calls..."

# First, let's update the storePIN method to use the new API
cat > update_store_pin.patch << 'EOF'
--- a/CyphrIdentity.swift
+++ b/CyphrIdentity.swift
@@ -1,5 +1,5 @@
     /// Store PIN (hashed with salt)
-    public func storePIN(_ pin: String) throws {
+    public func storePIN(_ pin: String) async throws {
         guard pin.count == 6, pin.allSatisfy({ $0.isNumber }) else {
             throw CyphrError.invalidPIN
         }
@@ -14,7 +14,7 @@
         let hash = SHA256.hash(data: combined.data(using: .utf8)!)

         // Store hash and salt
-        try keychain.store(
+        try keychain.storePIN(pin)

         print("✅ PIN stored with device binding")
     }
EOF

echo "Patch created. This requires manual updates due to the async nature of the new API."
echo ""
echo "Key changes needed:"
echo "1. Update all keychain.retrieve() calls to use 'await'"
echo "2. Make containing functions async"
echo "3. Update error handling for the new error types"
echo "4. Use the new storePIN method directly"
echo ""
echo "Example transformations:"
echo "  OLD: let data = try? keychain.retrieve(key: 'cyphr_pin_hash')"
echo "  NEW: let data = try? await keychain.retrieve(key: 'cyphr_pin_hash', reason: 'Verify PIN')"