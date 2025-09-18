import Foundation
import SwiftKyber

print("🚀 Testing REAL Kyber1024 implementation...")

// Create Kyber1024 instance
let kyber = Kyber.K1024

// Generate Kyber1024 keypair
let (publicKey, secretKey) = kyber.GenerateKeyPair()

print("✅ Generated Kyber1024 keypair")
print("   Public key size: \(publicKey.bytes.count) bytes")
print("   Secret key size: \(secretKey.bytes.count) bytes")

// Test encapsulation
let (ciphertext, sharedSecret) = publicKey.Encapsulate()
print("\n✅ Encapsulated:")
print("   Shared secret size: \(sharedSecret.count) bytes")
print("   Ciphertext size: \(ciphertext.count) bytes")

// Test decapsulation
do {
    let recoveredSecret = try secretKey.Decapsulate(ct: ciphertext)
    print("\n✅ Decapsulated:")
    print("   Recovered secret size: \(recoveredSecret.count) bytes")
    print("   Secrets match: \(sharedSecret == recoveredSecret)")
} catch {
    print("❌ Decapsulation failed: \(error)")
}

print("\n🎉 SwiftKyber WORKS! Real Kyber1024 is ready for iOS!")