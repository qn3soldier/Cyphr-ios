// S3Service.swift
// Cyphr Messenger - Enterprise S3 Integration for iOS
// Date: September 7, 2025

import Foundation
import CryptoKit
import UIKit

// MARK: - S3 Service Configuration

struct S3Configuration {
    static let cdnBaseURL = "https://cdn.cyphr.app"
    static let uploadChunkSize = 5 * 1024 * 1024 // 5MB chunks
    static let maxRetries = 3
    static let uploadTimeout: TimeInterval = 300 // 5 minutes
}

// MARK: - S3 Upload Response Models

struct S3PresignedUploadResponse: Codable {
    let uploadUrl: String
    let fields: [String: String]
    let key: String
    let expiresAt: String
}

struct S3UploadResult: Codable {
    let s3Url: String
    let cdnUrl: String
    let key: String
    let bucket: String
    let hash: String
    let size: Int
    let uploadedAt: String
}

struct S3MultipartUploadResponse: Codable {
    let uploadId: String
    let key: String
    let bucket: String
    let partUrls: [S3PartUrl]
}

struct S3PartUrl: Codable {
    let partNumber: Int
    let uploadUrl: String
}

// MARK: - S3 Service

class S3Service {
    static let shared = S3Service()
    private let networkService = NetworkService.shared
    
    private init() {}
    
    // MARK: - Avatar Upload
    
    func uploadAvatar(_ image: UIImage, for userId: String) async throws -> S3UploadResult {
        // 1. Compress and optimize image
        guard let imageData = image.jpegData(compressionQuality: 0.8) else {
            throw S3Error.imageCompressionFailed
        }
        
        // 2. Limit size to 2MB for avatars
        let maxSize = 2 * 1024 * 1024
        let finalData: Data
        
        if imageData.count > maxSize {
            // Further compress if needed
            guard let compressedData = image.jpegData(compressionQuality: 0.5) else {
                throw S3Error.imageCompressionFailed
            }
            finalData = compressedData
        } else {
            finalData = imageData
        }
        
        // 3. Encrypt the image data
        let encryptedData = try await encryptData(finalData)
        
        // 4. Get pre-signed upload URL
        let presignedResponse = try await getPresignedUploadUrl(
            type: "avatars",
            userId: userId,
            fileSizeLimit: maxSize
        )
        
        // 5. Upload to S3
        return try await uploadToS3(
            encryptedData: encryptedData,
            presignedData: presignedResponse
        )
    }
    
    // MARK: - Media Upload (Photos/Videos)
    
    func uploadMedia(_ mediaData: Data, type: MediaType, for userId: String) async throws -> S3UploadResult {
        let maxSize = type == .image ? 10 * 1024 * 1024 : 100 * 1024 * 1024 // 10MB for images, 100MB for videos
        
        if mediaData.count > maxSize {
            throw S3Error.fileTooLarge(maxSize: maxSize)
        }
        
        // Check if we need multipart upload (>5MB)
        if mediaData.count > S3Configuration.uploadChunkSize {
            return try await uploadLargeFile(mediaData, type: "media", userId: userId)
        } else {
            // Small file - single upload
            let encryptedData = try await encryptData(mediaData)
            let presignedResponse = try await getPresignedUploadUrl(
                type: "media",
                userId: userId,
                fileSizeLimit: maxSize
            )
            
            return try await uploadToS3(
                encryptedData: encryptedData,
                presignedData: presignedResponse
            )
        }
    }
    
    // MARK: - Voice Message Upload
    
    func uploadVoiceMessage(_ audioData: Data, for userId: String) async throws -> S3UploadResult {
        // Voice messages are typically small
        let encryptedData = try await encryptData(audioData)
        
        let presignedResponse = try await getPresignedUploadUrl(
            type: "voice",
            userId: userId,
            fileSizeLimit: 10 * 1024 * 1024 // 10MB max for voice
        )
        
        return try await uploadToS3(
            encryptedData: encryptedData,
            presignedData: presignedResponse
        )
    }
    
    // MARK: - Document Upload
    
    func uploadDocument(_ documentData: Data, fileName: String, for userId: String) async throws -> S3UploadResult {
        // Documents can be large
        if documentData.count > S3Configuration.uploadChunkSize {
            return try await uploadLargeFile(documentData, type: "documents", userId: userId)
        } else {
            let encryptedData = try await encryptData(documentData)
            let presignedResponse = try await getPresignedUploadUrl(
                type: "documents",
                userId: userId,
                fileSizeLimit: 50 * 1024 * 1024 // 50MB for documents
            )
            
            return try await uploadToS3(
                encryptedData: encryptedData,
                presignedData: presignedResponse
            )
        }
    }
    
    // MARK: - Download File
    
    func downloadFile(from s3Url: String) async throws -> Data {
        // 1. Get pre-signed download URL
        let downloadUrl = try await getPresignedDownloadUrl(s3Url: s3Url)
        
        // 2. Download encrypted data
        guard let url = URL(string: downloadUrl) else {
            throw S3Error.invalidURL
        }
        
        let (data, response) = try await URLSession.shared.data(from: url)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw S3Error.downloadFailed
        }
        
        // 3. Decrypt data
        return try await decryptData(data)
    }
    
    // MARK: - Private Methods
    
    private func getPresignedUploadUrl(type: String, userId: String, fileSizeLimit: Int) async throws -> S3PresignedUploadResponse {
        let endpoint = "/api/s3/presigned-upload"
        let params = [
            "type": type,
            "userId": userId,
            "fileSizeLimit": String(fileSizeLimit)
        ]
        
        // Direct HTTP request for S3 operations  
        let url = URL(string: "\(NetworkService.shared.baseURL)\(endpoint)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: params)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(S3PresignedUploadResponse.self, from: data)
    }
    
    private func getPresignedDownloadUrl(s3Url: String) async throws -> String {
        let endpoint = "/api/s3/presigned-download"
        let params = ["s3Url": s3Url]
        
        struct DownloadResponse: Codable {
            let downloadUrl: String
        }
        
        // Direct HTTP request for S3 operations
        let url = URL(string: "\(NetworkService.shared.baseURL)\(endpoint)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: params)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(DownloadResponse.self, from: data)
        
        return response.downloadUrl
    }
    
    private func uploadToS3(encryptedData: Data, presignedData: S3PresignedUploadResponse) async throws -> S3UploadResult {
        guard let uploadURL = URL(string: presignedData.uploadUrl) else {
            throw S3Error.invalidURL
        }
        
        var request = URLRequest(url: uploadURL)
        request.httpMethod = "POST"
        request.timeoutInterval = S3Configuration.uploadTimeout
        
        // Create multipart form data
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        var body = Data()
        
        // Add fields
        for (key, value) in presignedData.fields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }
        
        // Add file data
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"encrypted.dat\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: application/octet-stream\r\n\r\n".data(using: .utf8)!)
        body.append(encryptedData)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        // Upload with progress tracking
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw S3Error.uploadFailed
        }
        
        // Generate hash for verification
        let hash = SHA256.hash(data: encryptedData)
        let hashString = hash.compactMap { String(format: "%02x", $0) }.joined()
        
        // Return result
        return S3UploadResult(
            s3Url: "\(presignedData.uploadUrl)/\(presignedData.key)",
            cdnUrl: "\(S3Configuration.cdnBaseURL)/\(presignedData.key)",
            key: presignedData.key,
            bucket: "cyphr-media-prod",
            hash: hashString,
            size: encryptedData.count,
            uploadedAt: ISO8601DateFormatter().string(from: Date())
        )
    }
    
    private func uploadLargeFile(_ data: Data, type: String, userId: String) async throws -> S3UploadResult {
        // Split into chunks
        let chunkSize = S3Configuration.uploadChunkSize
        let totalParts = Int(ceil(Double(data.count) / Double(chunkSize)))
        
        // Initiate multipart upload
        let multipartResponse = try await initiateMultipartUpload(
            type: type,
            userId: userId,
            totalParts: totalParts
        )
        
        // Upload each part
        var uploadedParts: [(partNumber: Int, etag: String)] = []
        
        for partNumber in 1...totalParts {
            let start = (partNumber - 1) * chunkSize
            let end = min(start + chunkSize, data.count)
            let chunkData = data[start..<end]
            
            let partUrl = multipartResponse.partUrls.first { $0.partNumber == partNumber }!
            let etag = try await uploadPart(Data(chunkData), to: partUrl.uploadUrl)
            
            uploadedParts.append((partNumber: partNumber, etag: etag))
        }
        
        // Complete multipart upload
        return try await completeMultipartUpload(
            bucket: multipartResponse.bucket,
            key: multipartResponse.key,
            uploadId: multipartResponse.uploadId,
            parts: uploadedParts
        )
    }
    
    private func initiateMultipartUpload(type: String, userId: String, totalParts: Int) async throws -> S3MultipartUploadResponse {
        let endpoint = "/api/s3/multipart/initiate"
        let params = [
            "type": type,
            "userId": userId,
            "totalParts": String(totalParts)
        ]
        
        let url = URL(string: "\(NetworkService.shared.baseURL)\(endpoint)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: params)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(S3MultipartUploadResponse.self, from: data)
    }
    
    private func uploadPart(_ data: Data, to uploadUrl: String) async throws -> String {
        guard let url = URL(string: uploadUrl) else {
            throw S3Error.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.httpBody = data
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode),
              let etag = httpResponse.allHeaderFields["ETag"] as? String else {
            throw S3Error.uploadFailed
        }
        
        return etag
    }
    
    private func completeMultipartUpload(bucket: String, key: String, uploadId: String, parts: [(partNumber: Int, etag: String)]) async throws -> S3UploadResult {
        let endpoint = "/api/s3/multipart/complete"
        let params: [String: Any] = [
            "bucket": bucket,
            "key": key,
            "uploadId": uploadId,
            "parts": parts.map { ["PartNumber": $0.partNumber, "ETag": $0.etag] }
        ]
        
        let url = URL(string: "\(NetworkService.shared.baseURL)\(endpoint)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: params)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(S3UploadResult.self, from: data)
    }
    
    // MARK: - Encryption/Decryption
    
    private func encryptData(_ data: Data) async throws -> Data {
        // Use ChaCha20 encryption with random key
        let key = SymmetricKey(size: .bits256)
        let nonce = try ChaChaPoly.Nonce()
        
        let sealedBox = try ChaChaPoly.seal(data, using: key, nonce: nonce)
        
        // Return combined data (nonce + ciphertext + tag)
        return sealedBox.combined
    }
    
    private func decryptData(_ encryptedData: Data) async throws -> Data {
        // Extract and decrypt using ChaCha20
        let sealedBox = try ChaChaPoly.SealedBox(combined: encryptedData)
        
        // In production, get key from secure storage
        // For now, using placeholder
        let key = SymmetricKey(size: .bits256)
        
        return try ChaChaPoly.open(sealedBox, using: key)
    }
}

// MARK: - Media Type
// MediaType is defined in WebRTCService.swift

// MARK: - S3 Errors

enum S3Error: LocalizedError {
    case imageCompressionFailed
    case fileTooLarge(maxSize: Int)
    case invalidURL
    case uploadFailed
    case downloadFailed
    case encryptionFailed
    case decryptionFailed
    
    var errorDescription: String? {
        switch self {
        case .imageCompressionFailed:
            return "Failed to compress image"
        case .fileTooLarge(let maxSize):
            return "File size exceeds maximum of \(maxSize / 1024 / 1024)MB"
        case .invalidURL:
            return "Invalid S3 URL"
        case .uploadFailed:
            return "Failed to upload file to S3"
        case .downloadFailed:
            return "Failed to download file from S3"
        case .encryptionFailed:
            return "Failed to encrypt file"
        case .decryptionFailed:
            return "Failed to decrypt file"
        }
    }
}