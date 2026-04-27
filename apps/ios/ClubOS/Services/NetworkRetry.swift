import Foundation

enum NetworkRetry {

    struct Policy: Sendable {
        let maxAttempts: Int
        let baseDelay: TimeInterval
        let maxDelay: TimeInterval
        let jitterFraction: Double

        static let `default` = Policy(maxAttempts: 3, baseDelay: 1.0, maxDelay: 8.0, jitterFraction: 0.25)
        static let none = Policy(maxAttempts: 1, baseDelay: 0, maxDelay: 0, jitterFraction: 0)
    }

    static func execute<T: Sendable>(
        policy: Policy = .default,
        isRetryable: @Sendable @escaping (Error) -> Bool = Self.isRetryable,
        operation: @Sendable () async throws -> T
    ) async throws -> T {
        var lastError: Error?
        for attempt in 0..<policy.maxAttempts {
            do {
                return try await operation()
            } catch {
                lastError = error
                let isLastAttempt = attempt == policy.maxAttempts - 1
                if isLastAttempt || !isRetryable(error) {
                    throw error
                }
                let base = min(policy.baseDelay * pow(2.0, Double(attempt)), policy.maxDelay)
                let jitter = base * policy.jitterFraction * Double.random(in: -1...1)
                let delay = max(0, base + jitter)
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }
        }
        throw lastError!
    }

    static func isRetryable(_ error: Error) -> Bool {
        if let apiError = error as? APIError {
            switch apiError {
            case .rateLimited:
                return true
            case .httpError(let code, _):
                return code >= 500
            default:
                return false
            }
        }
        if let urlError = error as? URLError {
            switch urlError.code {
            case .timedOut,
                 .networkConnectionLost,
                 .notConnectedToInternet,
                 .cannotConnectToHost,
                 .cannotFindHost,
                 .dnsLookupFailed:
                return true
            default:
                return false
            }
        }
        return false
    }

    static func delayForAttempt(_ attempt: Int, policy: Policy) -> TimeInterval {
        let base = min(policy.baseDelay * pow(2.0, Double(attempt)), policy.maxDelay)
        let jitter = base * policy.jitterFraction * Double.random(in: -1...1)
        return max(0, base + jitter)
    }
}
