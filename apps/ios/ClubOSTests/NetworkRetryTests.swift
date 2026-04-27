import XCTest
@testable import ClubOS

final class NetworkRetryTests: XCTestCase {

    private let fastPolicy = NetworkRetry.Policy(
        maxAttempts: 3, baseDelay: 0.01, maxDelay: 0.1, jitterFraction: 0
    )

    // MARK: - isRetryable

    func test_isRetryable_rateLimited() {
        XCTAssertTrue(NetworkRetry.isRetryable(APIError.rateLimited))
    }

    func test_isRetryable_serverErrors() {
        XCTAssertTrue(NetworkRetry.isRetryable(APIError.httpError(500, nil)))
        XCTAssertTrue(NetworkRetry.isRetryable(APIError.httpError(502, nil)))
        XCTAssertTrue(NetworkRetry.isRetryable(APIError.httpError(503, nil)))
        XCTAssertTrue(NetworkRetry.isRetryable(APIError.httpError(504, nil)))
    }

    func test_isRetryable_clientErrors_false() {
        XCTAssertFalse(NetworkRetry.isRetryable(APIError.unauthorized))
        XCTAssertFalse(NetworkRetry.isRetryable(APIError.notFound))
        XCTAssertFalse(NetworkRetry.isRetryable(APIError.forbidden(nil)))
        XCTAssertFalse(NetworkRetry.isRetryable(APIError.forbidden("nope")))
        XCTAssertFalse(NetworkRetry.isRetryable(APIError.invalidResponse))
        XCTAssertFalse(NetworkRetry.isRetryable(APIError.invalidURL("/foo")))
        XCTAssertFalse(NetworkRetry.isRetryable(APIError.httpError(400, nil)))
        XCTAssertFalse(NetworkRetry.isRetryable(APIError.httpError(404, nil)))
        XCTAssertFalse(NetworkRetry.isRetryable(APIError.httpError(422, nil)))
    }

    func test_isRetryable_transientNetworkErrors() {
        XCTAssertTrue(NetworkRetry.isRetryable(URLError(.timedOut)))
        XCTAssertTrue(NetworkRetry.isRetryable(URLError(.networkConnectionLost)))
        XCTAssertTrue(NetworkRetry.isRetryable(URLError(.notConnectedToInternet)))
        XCTAssertTrue(NetworkRetry.isRetryable(URLError(.cannotConnectToHost)))
        XCTAssertTrue(NetworkRetry.isRetryable(URLError(.cannotFindHost)))
        XCTAssertTrue(NetworkRetry.isRetryable(URLError(.dnsLookupFailed)))
    }

    func test_isRetryable_permanentURLErrors_false() {
        XCTAssertFalse(NetworkRetry.isRetryable(URLError(.badURL)))
        XCTAssertFalse(NetworkRetry.isRetryable(URLError(.unsupportedURL)))
        XCTAssertFalse(NetworkRetry.isRetryable(URLError(.cancelled)))
        XCTAssertFalse(NetworkRetry.isRetryable(URLError(.badServerResponse)))
        XCTAssertFalse(NetworkRetry.isRetryable(URLError(.userAuthenticationRequired)))
    }

    func test_isRetryable_unknownError_false() {
        struct SomeError: Error {}
        XCTAssertFalse(NetworkRetry.isRetryable(SomeError()))
    }

    // MARK: - execute — success paths

    func test_succeeds_on_first_attempt() async throws {
        var callCount = 0
        let result: String = try await NetworkRetry.execute(policy: fastPolicy) {
            callCount += 1
            return "ok"
        }
        XCTAssertEqual(result, "ok")
        XCTAssertEqual(callCount, 1)
    }

    func test_retries_transient_error_then_succeeds() async throws {
        var callCount = 0
        let result: String = try await NetworkRetry.execute(policy: fastPolicy) {
            callCount += 1
            if callCount < 3 {
                throw URLError(.timedOut)
            }
            return "recovered"
        }
        XCTAssertEqual(result, "recovered")
        XCTAssertEqual(callCount, 3)
    }

    func test_retries_rate_limited_then_succeeds() async throws {
        var callCount = 0
        let result: Int = try await NetworkRetry.execute(policy: fastPolicy) {
            callCount += 1
            if callCount == 1 {
                throw APIError.rateLimited
            }
            return 42
        }
        XCTAssertEqual(result, 42)
        XCTAssertEqual(callCount, 2)
    }

    func test_retries_server_error_then_succeeds() async throws {
        var callCount = 0
        let result: String = try await NetworkRetry.execute(policy: fastPolicy) {
            callCount += 1
            if callCount == 1 {
                throw APIError.httpError(503, "Service Unavailable")
            }
            return "back up"
        }
        XCTAssertEqual(result, "back up")
        XCTAssertEqual(callCount, 2)
    }

    // MARK: - execute — failure paths

    func test_does_not_retry_unauthorized() async throws {
        var callCount = 0
        do {
            let _: String = try await NetworkRetry.execute(policy: fastPolicy) {
                callCount += 1
                throw APIError.unauthorized
            }
            XCTFail("Should have thrown")
        } catch let error as APIError {
            XCTAssertEqual(callCount, 1)
            if case .unauthorized = error {} else {
                XCTFail("Expected unauthorized, got \(error)")
            }
        }
    }

    func test_does_not_retry_not_found() async throws {
        var callCount = 0
        do {
            let _: String = try await NetworkRetry.execute(policy: fastPolicy) {
                callCount += 1
                throw APIError.notFound
            }
            XCTFail("Should have thrown")
        } catch {
            XCTAssertEqual(callCount, 1)
        }
    }

    func test_does_not_retry_forbidden() async throws {
        var callCount = 0
        do {
            let _: String = try await NetworkRetry.execute(policy: fastPolicy) {
                callCount += 1
                throw APIError.forbidden("Admin only")
            }
            XCTFail("Should have thrown")
        } catch {
            XCTAssertEqual(callCount, 1)
        }
    }

    func test_does_not_retry_client_http_error() async throws {
        var callCount = 0
        do {
            let _: String = try await NetworkRetry.execute(policy: fastPolicy) {
                callCount += 1
                throw APIError.httpError(422, "Validation failed")
            }
            XCTFail("Should have thrown")
        } catch {
            XCTAssertEqual(callCount, 1)
        }
    }

    func test_exhausts_max_attempts_then_throws_last_error() async throws {
        var callCount = 0
        do {
            let _: String = try await NetworkRetry.execute(policy: fastPolicy) {
                callCount += 1
                throw URLError(.timedOut)
            }
            XCTFail("Should have thrown")
        } catch let error as URLError {
            XCTAssertEqual(callCount, 3)
            XCTAssertEqual(error.code, .timedOut)
        }
    }

    func test_single_attempt_policy_never_retries() async throws {
        let noRetry = NetworkRetry.Policy(maxAttempts: 1, baseDelay: 0, maxDelay: 0, jitterFraction: 0)
        var callCount = 0
        do {
            let _: String = try await NetworkRetry.execute(policy: noRetry) {
                callCount += 1
                throw URLError(.timedOut)
            }
            XCTFail("Should have thrown")
        } catch {
            XCTAssertEqual(callCount, 1)
        }
    }

    // MARK: - Custom retryable check

    func test_custom_retryable_overrides_default() async throws {
        var callCount = 0
        do {
            let _: String = try await NetworkRetry.execute(
                policy: fastPolicy,
                isRetryable: { _ in true }
            ) {
                callCount += 1
                throw APIError.notFound
            }
            XCTFail("Should have thrown")
        } catch {
            XCTAssertEqual(callCount, 3)
        }
    }

    func test_custom_retryable_can_prevent_all_retries() async throws {
        var callCount = 0
        do {
            let _: String = try await NetworkRetry.execute(
                policy: fastPolicy,
                isRetryable: { _ in false }
            ) {
                callCount += 1
                throw URLError(.timedOut)
            }
            XCTFail("Should have thrown")
        } catch {
            XCTAssertEqual(callCount, 1)
        }
    }

    // MARK: - Void return type

    func test_void_operation_succeeds() async throws {
        var callCount = 0
        try await NetworkRetry.execute(policy: fastPolicy) {
            callCount += 1
        }
        XCTAssertEqual(callCount, 1)
    }

    func test_void_operation_retries_on_transient_error() async throws {
        var callCount = 0
        try await NetworkRetry.execute(policy: fastPolicy) {
            callCount += 1
            if callCount < 2 {
                throw APIError.httpError(500, nil)
            }
        }
        XCTAssertEqual(callCount, 2)
    }

    // MARK: - Exponential backoff timing

    func test_exponential_backoff_delays_increase() async throws {
        let timedPolicy = NetworkRetry.Policy(
            maxAttempts: 4, baseDelay: 0.05, maxDelay: 1.0, jitterFraction: 0
        )
        var timestamps: [Date] = []
        var callCount = 0
        do {
            let _: String = try await NetworkRetry.execute(policy: timedPolicy) {
                timestamps.append(Date())
                callCount += 1
                throw URLError(.timedOut)
            }
        } catch {
            XCTAssertEqual(callCount, 4)
            XCTAssertEqual(timestamps.count, 4)

            let delay1 = timestamps[1].timeIntervalSince(timestamps[0])
            let delay2 = timestamps[2].timeIntervalSince(timestamps[1])
            let delay3 = timestamps[3].timeIntervalSince(timestamps[2])

            XCTAssertGreaterThan(delay1, 0.03)
            XCTAssertGreaterThan(delay2, delay1 * 0.9)
            XCTAssertGreaterThan(delay3, delay2 * 0.9)
        }
    }

    func test_delay_capped_at_maxDelay() async throws {
        let cappedPolicy = NetworkRetry.Policy(
            maxAttempts: 5, baseDelay: 0.05, maxDelay: 0.06, jitterFraction: 0
        )
        var timestamps: [Date] = []
        var callCount = 0
        do {
            let _: String = try await NetworkRetry.execute(policy: cappedPolicy) {
                timestamps.append(Date())
                callCount += 1
                throw URLError(.timedOut)
            }
        } catch {
            XCTAssertEqual(callCount, 5)
            for i in 1..<timestamps.count {
                let delay = timestamps[i].timeIntervalSince(timestamps[i - 1])
                XCTAssertLessThan(delay, 0.15, "Delay \(i) exceeded maxDelay cap")
            }
        }
    }

    // MARK: - delayForAttempt

    func test_delayForAttempt_without_jitter() {
        let policy = NetworkRetry.Policy(maxAttempts: 5, baseDelay: 1.0, maxDelay: 10.0, jitterFraction: 0)
        XCTAssertEqual(NetworkRetry.delayForAttempt(0, policy: policy), 1.0, accuracy: 0.001)
        XCTAssertEqual(NetworkRetry.delayForAttempt(1, policy: policy), 2.0, accuracy: 0.001)
        XCTAssertEqual(NetworkRetry.delayForAttempt(2, policy: policy), 4.0, accuracy: 0.001)
        XCTAssertEqual(NetworkRetry.delayForAttempt(3, policy: policy), 8.0, accuracy: 0.001)
        XCTAssertEqual(NetworkRetry.delayForAttempt(4, policy: policy), 10.0, accuracy: 0.001)
    }

    func test_delayForAttempt_capped_at_maxDelay() {
        let policy = NetworkRetry.Policy(maxAttempts: 10, baseDelay: 1.0, maxDelay: 5.0, jitterFraction: 0)
        XCTAssertEqual(NetworkRetry.delayForAttempt(0, policy: policy), 1.0, accuracy: 0.001)
        XCTAssertEqual(NetworkRetry.delayForAttempt(5, policy: policy), 5.0, accuracy: 0.001)
        XCTAssertEqual(NetworkRetry.delayForAttempt(10, policy: policy), 5.0, accuracy: 0.001)
    }

    func test_delayForAttempt_with_jitter_stays_in_bounds() {
        let policy = NetworkRetry.Policy(maxAttempts: 3, baseDelay: 1.0, maxDelay: 10.0, jitterFraction: 0.25)
        for attempt in 0..<3 {
            let base = min(1.0 * pow(2.0, Double(attempt)), 10.0)
            for _ in 0..<50 {
                let delay = NetworkRetry.delayForAttempt(attempt, policy: policy)
                let maxJitter = base * 0.25
                XCTAssertGreaterThanOrEqual(delay, 0)
                XCTAssertLessThanOrEqual(delay, base + maxJitter)
            }
        }
    }

    // MARK: - Policy.none

    func test_policy_none_has_single_attempt() {
        XCTAssertEqual(NetworkRetry.Policy.none.maxAttempts, 1)
    }

    // MARK: - Mixed error sequences

    func test_recovers_from_different_transient_errors() async throws {
        var callCount = 0
        let result: String = try await NetworkRetry.execute(policy: fastPolicy) {
            callCount += 1
            switch callCount {
            case 1: throw URLError(.networkConnectionLost)
            case 2: throw APIError.httpError(502, "Bad Gateway")
            default: return "ok"
            }
        }
        XCTAssertEqual(result, "ok")
        XCTAssertEqual(callCount, 3)
    }

    func test_stops_retry_when_transient_followed_by_permanent() async throws {
        var callCount = 0
        do {
            let _: String = try await NetworkRetry.execute(policy: fastPolicy) {
                callCount += 1
                if callCount == 1 {
                    throw URLError(.timedOut)
                }
                throw APIError.unauthorized
            }
            XCTFail("Should have thrown")
        } catch let error as APIError {
            XCTAssertEqual(callCount, 2)
            if case .unauthorized = error {} else {
                XCTFail("Expected unauthorized")
            }
        }
    }
}
