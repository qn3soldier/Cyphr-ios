import Foundation
import CryptoKit

/// Centralised loader for the canonical BIP39 English word list used throughout the app.
/// The primary path reads the bundled `bip39-english.txt` file and validates its integrity
/// via SHA-256. When the bundle resource is missing or corrupted, the loader returns an
/// empty array so that the surrounding flows can surface a configuration problem without
/// crashing the UI.
struct BIP39WordList {
    private static let expectedSHA256 = "2360eaf4d2c7b4a4850ed77178d4876d41c750ed51bab274c0ae5ecbf3120e38"
    private static var cachedWords: [String]?

    static var englishWords: [String] {
        if let cached = cachedWords {
            return cached
        }

        if let words = loadBundledWordList() {
            cachedWords = words
            return words
        }

        // Configuration issue – return empty array to avoid crashes while signalling the problem.
        print("⚠️ BIP39 loader: returning empty fallback list (bundle missing or invalid)")
        cachedWords = []
        return []
    }

    private static func loadBundledWordList() -> [String]? {
        guard let url = Bundle.main.url(forResource: "bip39-english", withExtension: "txt") else {
            print("⚠️ BIP39 loader: bundled word list not found")
            return nil
        }

        do {
            let data = try Data(contentsOf: url)
            let actualHash = sha256Hex(for: data)

            guard actualHash == expectedSHA256 else {
                print("⚠️ BIP39 loader: hash mismatch. Expected: \(expectedSHA256), got: \(actualHash)")
                return nil
            }

            guard let words = decodeWords(from: data) else {
                print("⚠️ BIP39 loader: invalid word count (expected 2048)")
                return nil
            }

            print("✅ BIP39 word list loaded from bundle (2048 words, SHA-256 verified)")
            return words
        } catch {
            print("❌ BIP39 loader: failed to read bundle resource: \(error.localizedDescription)")
            return nil
        }
    }

    private static func decodeWords(from data: Data) -> [String]? {
        guard let content = String(data: data, encoding: .utf8) else { return nil }

        let words = content
            .split(whereSeparator: \.isNewline)
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        return words.count == 2048 ? words : nil
    }

    private static func sha256Hex(for data: Data) -> String {
        SHA256.hash(data: data)
            .map { String(format: "%02x", $0) }
            .joined()
    }
}
