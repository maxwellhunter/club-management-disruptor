import XCTest
@testable import ClubOS

final class RetryPolicyTests: XCTestCase {

    // MARK: - Default Configuration

    func test_default_maxAttempts() {
        XCTAssertEqual(RetryPolicy.default.maxAttempts, 3)
    }

    func test_default_baseDelay() {
        XCTAssertEqual(RetryPolicy.default.baseDelay, 1.0)
    }

    func test_default_maxDelay() {
        XCTAssertEqual(RetryPolicy.default.maxDelay, 10.0)
    }

    func test_none_singleAttempt() {
        XCTAssertEqual(RetryPolicy.none.maxAttempts, 1)
    }

    // MARK: - Delay Calculation

    func test_delay_firstAttempt_isZero() {
        let delay = RetryPolicy.default.delay(forAttempt: 0)
        XCTAssertEqual(delay, 0)
    }

    func test_delay_secondAttempt_isBaseDelay() {
        let policy = RetryPolicy(maxAttempts: 5, baseDelay: 1.0, maxDelay: 30.0)
        XCTAssertEqual(policy.delay(forAttempt: 1), 1.0)
    }

    func test_delay_thirdAttempt_isDoubled() {
        let policy = RetryPolicy(maxAttempts: 5, baseDelay: 1.0, maxDelay: 30.0)
        XCTAssertEqual(policy.delay(forAttempt: 2), 2.0)
    }

    func test_delay_fourthAttempt_isQuadrupled() {
        let policy = RetryPolicy(maxAttempts: 5, baseDelay: 1.0, maxDelay: 30.0)
        XCTAssertEqual(policy.delay(forAttempt: 3), 4.0)
    }

    func test_delay_cappedAtMaxDelay() {
        let policy = RetryPolicy(maxAttempts: 10, baseDelay: 2.0, maxDelay: 10.0)
        // attempt 4: 2 * 2^3 = 16 → capped to 10
        XCTAssertEqual(policy.delay(forAttempt: 4), 10.0)
    }

    func test_delay_customBaseDelay() {
        let policy = RetryPolicy(maxAttempts: 3, baseDelay: 0.5, maxDelay: 5.0)
        XCTAssertEqual(policy.delay(forAttempt: 1), 0.5)
        XCTAssertEqual(policy.delay(forAttempt: 2), 1.0)
    }

    // MARK: - shouldRetry

    func test_shouldRetry_withinMaxAttempts_retryableError() {
        let policy = RetryPolicy.default
        let error = APIError.rateLimited
        XCTAssertTrue(policy.shouldRetry(attempt: 1, error: error))
        XCTAssertTrue(policy.shouldRetry(attempt: 2, error: error))
    }

    func test_shouldRetry_atMaxAttempts_returnsFalse() {
        let policy = RetryPolicy.default // maxAttempts = 3
        XCTAssertFalse(policy.shouldRetry(attempt: 3, error: APIError.rateLimited))
    }

    func test_shouldRetry_beyondMaxAttempts_returnsFalse() {
        let policy = RetryPolicy.default
        XCTAssertFalse(policy.shouldRetry(attempt: 5, error: APIError.rateLimited))
    }

    func test_shouldRetry_nonRetryableError_returnsFalse() {
        let policy = RetryPolicy.default
        XCTAssertFalse(policy.shouldRetry(attempt: 1, error: APIError.unauthorized))
    }

    func test_shouldRetry_nonePolicy_alwaysFalse() {
        let policy = RetryPolicy.none
        XCTAssertFalse(policy.shouldRetry(attempt: 0, error: APIError.rateLimited))
    }

    // MARK: - isRetryable — APIError

    func test_isRetryable_rateLimited() {
        XCTAssertTrue(RetryPolicy.isRetryable(APIError.rateLimited))
    }

    func test_isRetryable_serverError500() {
        XCTAssertTrue(RetryPolicy.isRetryable(APIError.httpError(500, nil)))
    }

    func test_isRetryable_serverError502() {
        XCTAssertTrue(RetryPolicy.isRetryable(APIError.httpError(502, "Bad Gateway")))
    }

    func test_isRetryable_serverError503() {
        XCTAssertTrue(RetryPolicy.isRetryable(APIError.httpError(503, nil)))
    }

    func test_isRetryable_serverError599() {
        XCTAssertTrue(RetryPolicy.isRetryable(APIError.httpError(599, nil)))
    }

    func test_isRetryable_clientError400_notRetryable() {
        XCTAssertFalse(RetryPolicy.isRetryable(APIError.httpError(400, nil)))
    }

    func test_isRetryable_clientError422_notRetryable() {
        XCTAssertFalse(RetryPolicy.isRetryable(APIError.httpError(422, nil)))
    }

    func test_isRetryable_unauthorized_notRetryable() {
        XCTAssertFalse(RetryPolicy.isRetryable(APIError.unauthorized))
    }

    func test_isRetryable_forbidden_notRetryable() {
        XCTAssertFalse(RetryPolicy.isRetryable(APIError.forbidden("no")))
    }

    func test_isRetryable_notFound_notRetryable() {
        XCTAssertFalse(RetryPolicy.isRetryable(APIError.notFound))
    }

    func test_isRetryable_invalidURL_notRetryable() {
        XCTAssertFalse(RetryPolicy.isRetryable(APIError.invalidURL("/bad")))
    }

    func test_isRetryable_invalidResponse_notRetryable() {
        XCTAssertFalse(RetryPolicy.isRetryable(APIError.invalidResponse))
    }

    // MARK: - isRetryable — URLError

    func test_isRetryable_urlError_timedOut() {
        XCTAssertTrue(RetryPolicy.isRetryable(URLError(.timedOut)))
    }

    func test_isRetryable_urlError_networkConnectionLost() {
        XCTAssertTrue(RetryPolicy.isRetryable(URLError(.networkConnectionLost)))
    }

    func test_isRetryable_urlError_notConnectedToInternet() {
        XCTAssertTrue(RetryPolicy.isRetryable(URLError(.notConnectedToInternet)))
    }

    func test_isRetryable_urlError_dnsLookupFailed() {
        XCTAssertTrue(RetryPolicy.isRetryable(URLError(.dnsLookupFailed)))
    }

    func test_isRetryable_urlError_cannotConnectToHost() {
        XCTAssertTrue(RetryPolicy.isRetryable(URLError(.cannotConnectToHost)))
    }

    func test_isRetryable_urlError_cannotFindHost() {
        XCTAssertTrue(RetryPolicy.isRetryable(URLError(.cannotFindHost)))
    }

    func test_isRetryable_urlError_cancelled_notRetryable() {
        XCTAssertFalse(RetryPolicy.isRetryable(URLError(.cancelled)))
    }

    func test_isRetryable_urlError_badURL_notRetryable() {
        XCTAssertFalse(RetryPolicy.isRetryable(URLError(.badURL)))
    }

    func test_isRetryable_urlError_badServerResponse_notRetryable() {
        XCTAssertFalse(RetryPolicy.isRetryable(URLError(.badServerResponse)))
    }

    // MARK: - isRetryable — Unknown Errors

    func test_isRetryable_unknownError_notRetryable() {
        struct CustomError: Error {}
        XCTAssertFalse(RetryPolicy.isRetryable(CustomError()))
    }
}
