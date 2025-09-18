/**
 * NETWORK SERVICE - AWS BACKEND INTEGRATION
 * EXACT same endpoints as web version
 * app.cyphrmessenger.app backend
 */

import Foundation

class NetworkService: ObservableObject {
    private let baseURL = "https://app.cyphrmessenger.app/api"
    
    // Same API request structure as web
    func post(endpoint: String, body: [String: Any]) async throws -> [String: Any] {
        guard let url = URL(string: baseURL + endpoint) else {
            throw NetworkError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add auth headers (same as web)
        if let token = getAuthToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        if let userId = getUserId() {
            request.setValue(userId, forHTTPHeaderField: "x-user-id")
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              200...299 ~= httpResponse.statusCode else {
            throw NetworkError.serverError
        }
        
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }
    
    private func getAuthToken() -> String? {
        return Keychain().get("accessToken")
    }
    
    private func getUserId() -> String? {
        return Keychain().get("userId")
    }
}

enum NetworkError: Error {
    case invalidURL
    case serverError
    case noData
}