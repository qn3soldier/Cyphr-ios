import Foundation

/// Username validation with offensive content filtering
class UsernameValidator {
    
    // MARK: - Validation Rules
    
    static let minLength = 4
    static let maxLength = 30
    static let allowedCharacters = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_")
    
    // MARK: - Offensive Words Filter
    
    /// Basic offensive words to block (expand as needed)
    private static let offensiveWords: Set<String> = [
        // Add offensive terms here - keeping it minimal for production
        "admin", "root", "system", "cyphr", "official",
        "support", "help", "moderator", "staff", "team",
        // Common inappropriate terms (sanitized list)
        "fuck", "shit", "damn", "hell", "ass",
        "dick", "pussy", "cock", "bitch", "cunt",
        // Hate speech terms
        "nazi", "hitler", "racist", "nigger", "faggot",
        // Scam-related
        "bitcoin", "crypto", "investment", "forex", "trading"
    ]
    
    // MARK: - Validation Methods
    
    /// Validate username with all rules
    static func validate(_ username: String) -> ValidationResult {
        // Remove @ if present
        let cleanUsername = username.replacingOccurrences(of: "@", with: "")
        
        // Check minimum length
        if cleanUsername.count < minLength {
            return .invalid(reason: "Username must be at least \(minLength) characters")
        }
        
        // Check maximum length
        if cleanUsername.count > maxLength {
            return .invalid(reason: "Username must be less than \(maxLength) characters")
        }
        
        // Check allowed characters
        if !cleanUsername.unicodeScalars.allSatisfy({ allowedCharacters.contains($0) }) {
            return .invalid(reason: "Username can only contain letters, numbers, and underscore")
        }
        
        // Check if starts with letter
        if let firstChar = cleanUsername.first, !firstChar.isLetter {
            return .invalid(reason: "Username must start with a letter")
        }
        
        // Check for consecutive underscores
        if cleanUsername.contains("__") {
            return .invalid(reason: "Username cannot contain consecutive underscores")
        }
        
        // Check for offensive content
        if containsOffensiveContent(cleanUsername) {
            return .invalid(reason: "Username contains inappropriate content")
        }
        
        // Check for impersonation attempts
        if isImpersonationAttempt(cleanUsername) {
            return .invalid(reason: "Username appears to impersonate official accounts")
        }
        
        return .valid
    }
    
    /// Check if username contains offensive content
    private static func containsOffensiveContent(_ username: String) -> Bool {
        let lowercased = username.lowercased()
        
        // Direct match
        if offensiveWords.contains(lowercased) {
            return true
        }
        
        // Substring match for longer offensive words
        for word in offensiveWords {
            if lowercased.contains(word) {
                return true
            }
        }
        
        // Check for leetspeak variations
        let deleetspeak = lowercased
            .replacingOccurrences(of: "0", with: "o")
            .replacingOccurrences(of: "1", with: "i")
            .replacingOccurrences(of: "3", with: "e")
            .replacingOccurrences(of: "4", with: "a")
            .replacingOccurrences(of: "5", with: "s")
            .replacingOccurrences(of: "7", with: "t")
            .replacingOccurrences(of: "@", with: "a")
            .replacingOccurrences(of: "$", with: "s")
        
        for word in offensiveWords {
            if deleetspeak.contains(word) {
                return true
            }
        }
        
        return false
    }
    
    /// Check for impersonation attempts
    private static func isImpersonationAttempt(_ username: String) -> Bool {
        let lowercased = username.lowercased()
        
        let officialTerms = [
            "cyphr", "official", "admin", "support",
            "moderator", "staff", "team", "help"
        ]
        
        for term in officialTerms {
            if lowercased.hasPrefix(term) || lowercased.hasSuffix(term) {
                return true
            }
        }
        
        return false
    }
    
    // MARK: - Suggestion Generation
    
    /// Generate randomized username suggestions
    static func generateSuggestions(for baseUsername: String) -> [String] {
        var suggestions: [String] = []
        let cleanBase = baseUsername.replacingOccurrences(of: "@", with: "")
            .prefix(20) // Limit base length
        
        // Adjectives for variety
        let adjectives = [
            "pro", "ace", "max", "plus", "prime",
            "quantum", "crypto", "secure", "private", "stealth",
            "ninja", "elite", "super", "mega", "ultra"
        ]
        
        // Generate 5 unique suggestions
        while suggestions.count < 5 {
            let variant: String
            
            switch Int.random(in: 0...4) {
            case 0:
                // Base + random number
                let number = Int.random(in: 100...9999)
                variant = "\(cleanBase)_\(number)"
                
            case 1:
                // Base + adjective
                let adjective = adjectives.randomElement()!
                variant = "\(cleanBase)_\(adjective)"
                
            case 2:
                // Adjective + base
                let adjective = adjectives.randomElement()!
                variant = "\(adjective)_\(cleanBase)"
                
            case 3:
                // Base + year
                let year = Int.random(in: 2025...2030)
                variant = "\(cleanBase)_\(year)"
                
            default:
                // Base + letter + number
                let letter = ["x", "z", "q", "j", "k"].randomElement()!
                let number = Int.random(in: 1...99)
                variant = "\(cleanBase)_\(letter)\(number)"
            }
            
            // Validate and add if unique
            if validate(variant) == .valid && !suggestions.contains(variant) {
                suggestions.append(variant)
            }
        }
        
        return suggestions
    }
    
    // MARK: - Rate Limiting
    
    private static var checkHistory: [(username: String, timestamp: Date)] = []
    private static let rateLimitWindow: TimeInterval = 60 // 1 minute
    private static let maxChecksPerWindow = 10
    
    /// Check if rate limited
    static func isRateLimited() -> Bool {
        let now = Date()
        
        // Clean old entries
        checkHistory = checkHistory.filter { now.timeIntervalSince($0.timestamp) < rateLimitWindow }
        
        // Check limit
        return checkHistory.count >= maxChecksPerWindow
    }
    
    /// Record username check
    static func recordCheck(_ username: String) {
        checkHistory.append((username: username, timestamp: Date()))
    }
}

// MARK: - Validation Result

enum ValidationResult: Equatable {
    case valid
    case invalid(reason: String)
    
    var isValid: Bool {
        switch self {
        case .valid: return true
        case .invalid: return false
        }
    }
    
    var errorMessage: String? {
        switch self {
        case .valid: return nil
        case .invalid(let reason): return reason
        }
    }
}