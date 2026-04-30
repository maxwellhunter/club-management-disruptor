import Foundation

// MARK: - URLSession Protocol (for testability)

protocol URLSessionProtocol: Sendable {
    func data(for request: URLRequest) async throws -> (Data, URLResponse)
}

extension URLSession: URLSessionProtocol {}

// MARK: - Retry Configuration

struct RetryConfig: Sendable {
    let maxAttempts: Int
    let baseDelay: TimeInterval
    let maxDelay: TimeInterval

    static let `default` = RetryConfig(maxAttempts: 3, baseDelay: 1.0, maxDelay: 8.0)
    static let none = RetryConfig(maxAttempts: 1, baseDelay: 0, maxDelay: 0)
}

// MARK: - API Client for Next.js Backend

actor APIClient {
    static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSessionProtocol
    private var accessToken: String?
    private let retryConfig: RetryConfig

    static let jsonEncoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return encoder
    }()

    static let jsonDecoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }()

    private init() {
        self.baseURL = AppConfig.apiBaseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: config)
        self.retryConfig = .default
    }

    init(baseURL: URL, session: URLSessionProtocol, retryConfig: RetryConfig = .default) {
        self.baseURL = baseURL
        self.session = session
        self.retryConfig = retryConfig
    }

    // MARK: - Token Management

    func setToken(_ token: String?) {
        self.accessToken = token
    }

    // MARK: - HTTP Methods

    func get<T: Decodable>(_ path: String, query: [String: String]? = nil) async throws -> T {
        let request = try buildRequest(path: path, method: "GET", query: query)
        return try await executeWithRetry(request)
    }

    func post<T: Decodable>(_ path: String, body: Encodable? = nil) async throws -> T {
        let request = try buildRequest(path: path, method: "POST", body: body)
        return try await executeWithRetry(request)
    }

    func patch<T: Decodable>(_ path: String, query: [String: String]? = nil, body: Encodable? = nil) async throws -> T {
        let request = try buildRequest(path: path, method: "PATCH", query: query, body: body)
        return try await executeWithRetry(request)
    }

    func put<T: Decodable>(_ path: String, body: Encodable? = nil) async throws -> T {
        let request = try buildRequest(path: path, method: "PUT", body: body)
        return try await executeWithRetry(request)
    }

    // Fire-and-forget PUT (no response body needed).
    func put(_ path: String, body: Encodable? = nil) async throws {
        let request = try buildRequest(path: path, method: "PUT", body: body)
        try await executeVoidWithRetry(request)
    }

    func delete<T: Decodable>(_ path: String) async throws -> T {
        let request = try buildRequest(path: path, method: "DELETE")
        return try await executeWithRetry(request)
    }

    // Fire-and-forget variants (no response body needed)
    func post(_ path: String, body: Encodable? = nil) async throws {
        let request = try buildRequest(path: path, method: "POST", body: body)
        try await executeVoidWithRetry(request)
    }

    func patch(_ path: String, body: Encodable? = nil) async throws {
        let request = try buildRequest(path: path, method: "PATCH", body: body)
        try await executeVoidWithRetry(request)
    }

    func delete(_ path: String, body: Encodable? = nil) async throws {
        let request = try buildRequest(path: path, method: "DELETE", body: body)
        try await executeVoidWithRetry(request)
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

        return try await executeWithRetry(request)
    }

    // MARK: - Raw data (for non-JSON responses)

    func getData(_ path: String, query: [String: String]? = nil) async throws -> (Data, HTTPURLResponse) {
        let request = try buildRequest(path: path, method: "GET", query: query)
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        return (data, httpResponse)
    }

    // MARK: - Private Helpers

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
            request.httpBody = try Self.jsonEncoder.encode(AnyEncodable(body))
        }

        return request
    }

    private func executeWithRetry<T: Decodable>(_ request: URLRequest) async throws -> T {
        var lastError: Error?

        for attempt in 0..<retryConfig.maxAttempts {
            do {
                let (data, response) = try await session.data(for: request)
                try validateResponse(response, data: data)
                return try Self.jsonDecoder.decode(T.self, from: data)
            } catch {
                lastError = error
                guard attempt < retryConfig.maxAttempts - 1, isRetryable(error) else { break }
                let delay = retryDelay(attempt: attempt)
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }
        }

        throw lastError!
    }

    private func executeVoidWithRetry(_ request: URLRequest) async throws {
        var lastError: Error?

        for attempt in 0..<retryConfig.maxAttempts {
            do {
                let (data, response) = try await session.data(for: request)
                try validateResponse(response, data: data)
                return
            } catch {
                lastError = error
                guard attempt < retryConfig.maxAttempts - 1, isRetryable(error) else { break }
                let delay = retryDelay(attempt: attempt)
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }
        }

        throw lastError!
    }

    func isRetryable(_ error: Error) -> Bool {
        if let urlError = error as? URLError {
            switch urlError.code {
            case .timedOut, .networkConnectionLost, .notConnectedToInternet,
                 .cannotConnectToHost, .dnsLookupFailed:
                return true
            default:
                return false
            }
        }
        if case APIError.rateLimited = error { return true }
        if case APIError.httpError(let code, _) = error, (500...599).contains(code) { return true }
        return false
    }

    func retryDelay(attempt: Int) -> TimeInterval {
        min(retryConfig.baseDelay * pow(2.0, Double(attempt)), retryConfig.maxDelay)
    }

    private func extractErrorMessage(from data: Data) -> String? {
        struct ErrorBody: Decodable { let error: String }
        return try? JSONDecoder().decode(ErrorBody.self, from: data).error
    }

    private func validateResponse(_ response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        switch httpResponse.statusCode {
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
            throw APIError.httpError(httpResponse.statusCode, msg)
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

struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        _encode = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}
