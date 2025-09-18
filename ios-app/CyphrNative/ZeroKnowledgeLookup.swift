import Foundation
import CryptoKit
import Combine

/// Zero-Knowledge User Lookup Service - портирован из zeroKnowledgeUserLookup.js
/// Following Signal's Private Contact Discovery model
public class ZeroKnowledgeLookup: ObservableObject {
    
    // MARK: - Properties
    static let shared = ZeroKnowledgeLookup()
    private let network = NetworkService.shared
    
    private var discoveryCache: [String: DiscoveredUser] = [:]
    private var hashCache: [String: String] = [:]
    
    private init() {
        print("🔍 Zero-Knowledge User Lookup Service initialized")
    }
    
    // MARK: - Cyphr ID Hashing (Zero-Knowledge)
    
    /// Hash Cyphr ID using quantum-safe SHA-256
    public func hashCyphrId(_ cyphrId: String) async throws -> String {
        // Normalize Cyphr ID
        let normalized = cyphrId.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Check cache first
        if let cached = hashCache[normalized] {
            return cached
        }
        
        // Use quantum-safe hashing (SHA-256)
        let hash = SHA256.hash(data: normalized.data(using: .utf8)!)
            .compactMap { String(format: "%02x", $0) }.joined()
        
        // Cache the result locally
        hashCache[normalized] = hash
        
        return hash
    }
    
    // MARK: - Zero-Knowledge Cyphr ID Discovery
    
    /// ZERO-KNOWLEDGE CYPHR ID DISCOVERY
    /// Hash Cyphr IDs locally, send hashes to server for matching
    public func discoverCyphrIds(_ cyphrIds: [String]) async throws -> [CyphrIdDiscoveryResult] {
        print("🔍 Starting private Cyphr ID discovery for \(cyphrIds.count) IDs")
        
        // Step 1: Hash all Cyphr IDs locally
        var hashedIds: [(original: String, normalized: String, hash: String)] = []
        
        for id in cyphrIds {
            let normalized = id.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
            let hash = try await hashCyphrId(id)
            hashedIds.append((original: id, normalized: normalized, hash: hash))
        }
        
        // Step 2: Send only hashes to server (Zero-knowledge)
        let hashes = hashedIds.map { $0.hash }
        
        // Step 3: Query server with hashes only
        let discoveredUsers = try await queryHashedUsers(hashes)
        
        // Step 4: Map results back to original IDs
        let results = hashedIds.map { idData -> CyphrIdDiscoveryResult in
            let user = discoveredUsers.first(where: { $0.cyphrIdHash == idData.hash })
            return CyphrIdDiscoveryResult(
                cyphrId: idData.original,
                normalized: idData.normalized,
                user: user,
                found: user != nil
            )
        }
        
        print("✅ Cyphr ID discovery complete: \(results.filter { $0.found }.count) found")
        return results
    }
    
    /// Query server with Cyphr ID hashes only
    /// Server never sees plaintext Cyphr IDs
    private func queryHashedUsers(_ cyphrIdHashes: [String]) async throws -> [DiscoveredUser] {
        // Query users with hashed Cyphr IDs
        return try await network.queryHashedUsers(cyphrIdHashes: cyphrIdHashes)
    }
    
    // MARK: - Telegram-Style Username Search (из zeroKnowledgeUserLookup.js)
    
    /// Search by username
    public func searchByUsername(_ username: String) async throws -> [DiscoveredUser] {
        print("🔍 Searching for username: @\(username)")
        
        // Check cache
        if let cached = discoveryCache[username] {
            return [cached]
        }
        
        // Query server
        let users = try await network.searchUsername(username)
        
        // Cache results
        users.forEach { user in
            discoveryCache[user.username ?? ""] = user
        }
        
        return users
    }
    
    /// Search by Cyphr ID
    public func searchByCyphrId(_ cyphrId: String) async throws -> DiscoveredUser? {
        // Ensure cyphrId starts with @
        let normalizedId = cyphrId.hasPrefix("@") ? cyphrId : "@\(cyphrId)"
        
        print("🔍 Searching for Cyphr ID: \(normalizedId)")
        
        // Query server
        let response = try await network.lookupCyphrId(cyphrId: String(normalizedId.dropFirst()))
        
        if response.exists, let userId = response.userId {
            return DiscoveredUser(
                id: userId,
                cyphrIdHash: nil,
                fullName: nil,
                avatarUrl: nil,
                bio: nil,
                uniqueId: String(normalizedId.dropFirst()),
                username: String(normalizedId.dropFirst()),
                status: "active",
                publicKey: nil,
                lastSeen: Date(),
                createdAt: Date()
            )
        }
        
        return nil
    }
    
    // MARK: - Privacy Controls (из zeroKnowledgeUserLookup.js строки 200-250)
    
    /// Update user's discoverability settings
    public func updateDiscoverability(allowCyphrIdDiscovery: Bool, allowPublicKeyDiscovery: Bool) async throws -> Bool {
        print("🔐 Updating discoverability: cyphrId=\(allowCyphrIdDiscovery), publicKey=\(allowPublicKeyDiscovery)")
        
        let response = try await network.updateDiscoverability(
            allowCyphrId: allowCyphrIdDiscovery,
            allowPublicKey: allowPublicKeyDiscovery
        )
        
        return response
    }
    
    /// Bloom Filter implementation for private set intersection
    public func createBloomFilter(cyphrIds: [String]) async throws -> BloomFilter {
        let hashes = try await withThrowingTaskGroup(of: String.self) { group in
            for id in cyphrIds {
                group.addTask {
                    try await self.hashCyphrId(id)
                }
            }
            
            var results: [String] = []
            for try await hash in group {
                results.append(hash)
            }
            return results
        }
        
        return BloomFilter(hashes: hashes)
    }
    
    /// Check if user exists without revealing identity
    public func checkUserExists(cyphrId: String) async throws -> Bool {
        let hash = try await hashCyphrId(cyphrId)
        
        return try await network.checkUserExists(cyphrIdHash: hash)
    }
    
    // MARK: - Group Discovery (Telegram-style)
    
    /// Discover groups by invite link or name
    public func discoverGroups(query: String) async throws -> [DiscoveredGroup] {
        print("🔍 Discovering groups with query: \(query)")
        
        let groups = try await network.discoverGroups(query: query)
        return groups.map { groupInfo in
            DiscoveredGroup(
                id: groupInfo.id,
                name: groupInfo.name,
                description: groupInfo.description,
                memberCount: groupInfo.memberCount,
                isPublic: groupInfo.isPublic,
                inviteLink: nil
            )
        }
    }
    
    /// Join group by invite link
    public func joinGroup(inviteLink: String) async throws -> Bool {
        print("🔗 Joining group via invite: \(inviteLink)")
        
        let response = try await network.joinGroup(inviteLink: inviteLink)
        return response
    }
}

// MARK: - Models

public struct CyphrIdDiscoveryResult {
    let cyphrId: String
    let normalized: String
    let user: DiscoveredUser?
    let found: Bool
}

public struct DiscoveredUser: Identifiable, Codable {
    public let id: String
    let cyphrIdHash: String?
    let fullName: String?
    let avatarUrl: String?
    let bio: String?
    let uniqueId: String?
    let username: String?
    let status: String
    let publicKey: String?
    let lastSeen: Date?
    let createdAt: Date
    
    // Computed properties for compatibility
    var cyphrId: String? { uniqueId }
    var displayName: String { fullName ?? username ?? "User" }
    var isOnline: Bool { status == "active" }
}

public struct DiscoveredGroup: Codable {
    let id: String
    let name: String
    let description: String?
    let memberCount: Int
    let isPublic: Bool
    let inviteLink: String?
}

/// Bloom Filter for private set intersection
public struct BloomFilter {
    private var bitArray: [Bool]
    private let size = 10000
    
    init(hashes: [String]) {
        self.bitArray = Array(repeating: false, count: size)
        
        for hash in hashes {
            let indices = Self.hashIndices(hash, size: size)
            for index in indices {
                bitArray[index] = true
            }
        }
    }
    
    func contains(_ hash: String) -> Bool {
        let indices = Self.hashIndices(hash, size: size)
        return indices.allSatisfy { bitArray[$0] }
    }
    
    private static func hashIndices(_ value: String, size: Int) -> [Int] {
        let data = value.data(using: .utf8)!
        let hash1 = SHA256.hash(data: data)
        _ = SHA256.hash(data: Data(hash1))
        
        var indices: [Int] = []
        for i in 0..<3 {
            let hashValue = hash1.withUnsafeBytes { bytes in
                bytes.load(fromByteOffset: i * 4, as: UInt32.self)
            }
            indices.append(Int(hashValue) % size)
        }
        return indices
    }
}