import Foundation

struct RetryPolicy: Sendable {
    let maxAttempts: Int
    let baseDelay: TimeInterval
    let maxDelay: TimeInterval

    static let `default` = RetryPolicy(maxAttempts: 3, baseDelay: 1.0, maxDelay: 10.0)
    static let none = RetryPolicy(maxAttempts: 1, baseDelay: 0, maxDelay: 0)

    func delay(forAttempt attempt: Int) -> TimeInterval {
        guard attempt > 0 else { return 0 }
        let exponential = baseDelay * pow(2.0, Double(attempt - 1))
        return min(exponential, maxDelay)
    }

    func shouldRetry(attempt: Int, error: Error) -> Bool {
        guard attempt < maxAttempts else { return false }
        return Self.isRetryable(error)
    }

    static func isRetryable(_ error: Error) -> Bool {
        if let apiError = error as? APIError {
            switch apiError {
            case .rateLimited:
                return true
            case .httpError(let code, _):
                return code >= 500 && code < 600
            default:
                return false
            }
        }

        if let urlError = error as? URLError {
            switch urlError.code {
            case .timedOut,
                 .networkConnectionLost,
                 .notConnectedToInternet,
                 .dnsLookupFailed,
                 .cannotConnectToHost,
                 .cannotFindHost:
                return true
            default:
                return false
            }
        }

        return false
    }
}
