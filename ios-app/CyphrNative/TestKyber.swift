import Foundation
import SwiftKyber

// Test file to understand SwiftKyber API
func testKyber() {
    print("Testing SwiftKyber integration...")
    
    // Generate Kyber1024 keypair
    let (encapKey, decapKey) = Kyber.GenerateKeyPair(kind: .K1024)
    
    print("✅ Generated Kyber1024 keypair")
    print("   Encapsulation key size: \(encapKey.keyBytes.count) bytes")
    print("   Decapsulation key size: \(decapKey.keyBytes.count) bytes")
    
    // Test encapsulation
    let (sharedSecret, ciphertext) = encapKey.Encapsulate()
    print("✅ Encapsulated:")
    print("   Shared secret size: \(sharedSecret.count) bytes")
    print("   Ciphertext size: \(ciphertext.count) bytes")
    
    // Test decapsulation
    do {
        let recoveredSecret = try decapKey.Decapsulate(ct: ciphertext)
        print("✅ Decapsulated:")
        print("   Recovered secret size: \(recoveredSecret.count) bytes")
        print("   Secrets match: \(sharedSecret == recoveredSecret)")
    } catch {
        print("❌ Decapsulation failed: \(error)")
    }
    
    // Test key serialization
    let publicKeyBytes = encapKey.keyBytes
    let privateKeyBytes = decapKey.keyBytes
    
    // Test key reconstruction
    do {
        let reconstructedEncap = try EncapsulationKey(keyBytes: publicKeyBytes)
        let reconstructedDecap = try DecapsulationKey(keyBytes: privateKeyBytes)
        
        print("✅ Keys reconstructed from bytes")
        
        // Test with reconstructed keys
        let (newSecret, newCiphertext) = reconstructedEncap.Encapsulate()
        let recoveredNewSecret = try reconstructedDecap.Decapsulate(ct: newCiphertext)
        
        print("✅ Reconstructed keys work:")
        print("   New secrets match: \(newSecret == recoveredNewSecret)")
    } catch {
        print("❌ Key reconstruction failed: \(error)")
    }
}