import Foundation
import os

// MARK: - API Client for Next.js Backend

actor APIClient {
    static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSession
    private var accessToken: String?
    private let maxRetries: Int
    private let initialRetryDelay: TimeInterval
    private static let logger = Logger(subsystem: "com.clubos.app", category: "API")

    private init() {
        self.baseURL = AppConfig.apiBaseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: config)
        self.maxRetries = 3
        self.initialRetryDelay = 0.5
    }

    init(baseURL: URL, session: URLSession, maxRetries: Int = 3, initialRetryDelay: TimeInterval = 0.5) {
        self.baseURL = baseURL
        self.session = session
        self.maxRetries = maxRetries
        self.initialRetryDelay = initialRetryDelay
    }

    // MARK: - Token Management

    func setToken(_ token: String?) {
        self.accessToken = token
    }

    // MARK: - HTTP Methods

    func get<T: Decodable>(_ path: String, query: [String: String]? = nil) async throws -> T {
        let request = try buildRequest(path: path, method: "GET", query: query)
        return try await execute(request)
    }

    func post<T: Decodable>(_ path: String, body: Encodable? = nil) async throws -> T {
        let request = try buildRequest(path: path, method: "POST", body: body)
        return try await execute(request)
    }

    func patch<T: Decodable>(_ path: String, query: [String: String]? = nil, body: Encodable? = nil) async throws -> T {
        let request = try buildRequest(path: path, method: "PATCH", query: query, body: body)
        return try await execute(request)
    }

    func put<T: Decodable>(_ path: String, body: Encodable? = nil) async throws -> T {
        let request = try buildRequest(path: path, method: "PUT", body: body)
        return try await execute(request)
    }

    func put(_ path: String, body: Encodable? = nil) async throws {
        let request = try buildRequest(path: path, method: "PUT", body: body)
        let (data, response) = try await performRequest(request)
        try validateResponse(response, data: data)
    }

    func delete<T: Decodable>(_ path: String) async throws -> T {
        let request = try buildRequest(path: path, method: "DELETE")
        return try await execute(request)
    }

    // Fire-and-forget variants (no response body needed)
    func post(_ path: String, body: Encodable? = nil) async throws {
        let request = try buildRequest(path: path, method: "POST", body: body)
        let (data, response) = try await performRequest(request)
        try validateResponse(response, data: data)
    }

    func patch(_ path: String, body: Encodable? = nil) async throws {
        let request = try buildRequest(path: path, method: "PATCH", body: body)
        let (data, response) = try await performRequest(request)
        try validateResponse(response, data: data)
    }

    func delete(_ path: String, body: Encodable? = nil) async throws {
        let request = try buildRequest(path: path, method: "DELETE", body: body)
        let (data, response) = try await performRequest(request)
        try validateResponse(response, data: data)
    }

    // MARK: - Multipart Upload

    func uploadMultipart<T: Decodable>(
        _ path: String,
        fileData: Data,
        fileName: String,
        mimeType: String,
        fieldName: String = "file"
    ) async throws -> T {
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = try buildRequest(path: path, method: "POST")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"\(fieldName)\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        let (data, response) = try await performRequest(request)
        try validateResponse(response, data: data)

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(T.self, from: data)
    }

    // MARK: - Raw data (for non-JSON responses)

    func getData(_ path: String, query: [String: String]? = nil) async throws -> (Data, HTTPURLResponse) {
        let request = try buildRequest(path: path, method: "GET", query: query)
        return try await performRequest(request)
    }

    // MARK: - Request Building

    func buildRequest(
        path: String,
        method: String,
        query: [String: String]? = nil,
        body: Encodable? = nil
    ) throws -> URLRequest {
        var components = URLComponents(url: baseURL.appendingPathComponent("/api\(path)"), resolvingAgainstBaseURL: true)!

        if let query {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }

        guard let url = components.url else {
            throw APIError.invalidURL(path)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        return request
    }

    // MARK: - Retry & Execution

    private func performRequest(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        var lastError: Error?

        for attempt in 0...maxRetries {
            if attempt > 0 {
                let delay = initialRetryDelay * pow(2.0, Double(attempt - 1))
                Self.logger.info("Retry \(attempt)/\(self.maxRetries) — \(request.httpMethod ?? "?") \(request.url?.path ?? "?")")
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }

            do {
                let (data, response) = try await session.data(for: request)
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw APIError.invalidResponse
                }

                if Self.isRetriableStatusCode(httpResponse.statusCode) && attempt < maxRetries {
                    lastError = APIError.httpError(httpResponse.statusCode, extractErrorMessage(from: data))
                    continue
                }

                return (data, httpResponse)
            } catch let urlError as URLError where Self.isRetriableURLError(urlError) && attempt < maxRetries {
                Self.logger.warning("Network error \(urlError.code.rawValue) — \(request.httpMethod ?? "?") \(request.url?.path ?? "?")")
                lastError = urlError
                continue
            }
        }

        throw lastError ?? APIError.invalidResponse
    }

    private func execute<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await performRequest(request)
        try validateResponse(response, data: data)

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(T.self, from: data)
    }

    func extractErrorMessage(from data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return try? JSONDecoder().decode(ErrorBody.self, from: data).error
    }

    func validateResponse(_ response: HTTPURLResponse, data: Data) throws {
        switch response.statusCode {
        case 200...299:
            return
        case 401:
            throw APIError.unauthorized
        case 403:
            let msg = extractErrorMessage(from: data)
            throw APIError.forbidden(msg)
        case 404:
            throw APIError.notFound
        case 429:
            throw APIError.rateLimited
        default:
            let msg = extractErrorMessage(from: data)
            throw APIError.httpError(response.statusCode, msg)
        }
    }

    // MARK: - Retry Helpers

    static func isRetriableStatusCode(_ code: Int) -> Bool {
        code == 429 || (500...504).contains(code)
    }

    static func isRetriableURLError(_ error: URLError) -> Bool {
        switch error.code {
        case .timedOut, .networkConnectionLost, .cannotConnectToHost:
            return true
        default:
            return false
        }
    }
}

// MARK: - API Errors

enum APIError: LocalizedError, Equatable {
    case invalidURL(String)
    case invalidResponse
    case unauthorized
    case forbidden(String?)
    case notFound
    case rateLimited
    case httpError(Int, String?)

    var errorDescription: String? {
        switch self {
        case .invalidURL(let path): return "Invalid URL: \(path)"
        case .invalidResponse: return "Invalid response from server"
        case .unauthorized: return "Session expired. Please sign in again."
        case .forbidden(let msg): return msg ?? "You don't have permission to do that."
        case .notFound: return "Not found."
        case .rateLimited: return "Too many requests. Please wait."
        case .httpError(let code, let msg): return msg ?? "Server error (\(code))"
        }
    }
}

// MARK: - Type Erasure for Encodable

private struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        _encode = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}
