import XCTest
@testable import ClubOS

// MARK: - Mock URLSession

final class MockURLSession: URLSessionProtocol, @unchecked Sendable {
    var responses: [(Data, URLResponse)] = []
    var errors: [Error?] = []
    var requestCount = 0

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        let index = requestCount
        requestCount += 1

        if index < errors.count, let error = errors[index] {
            throw error
        }

        guard index < responses.count else {
            throw URLError(.unknown)
        }

        return responses[index]
    }
}

// MARK: - Test Helpers

private let testBaseURL = URL(string: "https://test.example.com")!

private func httpResponse(statusCode: Int) -> HTTPURLResponse {
    HTTPURLResponse(
        url: testBaseURL,
        statusCode: statusCode,
        httpVersion: nil,
        headerFields: nil
    )!
}

private struct TestPayload: Codable, Equatable {
    let id: Int
    let userName: String
}

// MARK: - Tests

final class APIClientTests: XCTestCase {

    // MARK: - Request Building

    func test_buildRequest_setsMethodAndHeaders() async throws {
        let session = MockURLSession()
        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: .none)

        let request = try await client.buildRequest(path: "/members", method: "GET")

        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
        XCTAssertTrue(request.url!.absoluteString.contains("/api/members"))
    }

    func test_buildRequest_includesQueryParameters() async throws {
        let session = MockURLSession()
        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: .none)

        let request = try await client.buildRequest(
            path: "/members",
            method: "GET",
            query: ["status": "active", "tier": "gold"]
        )

        let url = request.url!
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        let queryItems = components.queryItems ?? []
        let queryDict = Dictionary(uniqueKeysWithValues: queryItems.map { ($0.name, $0.value) })

        XCTAssertEqual(queryDict["status"], "active")
        XCTAssertEqual(queryDict["tier"], "gold")
    }

    func test_buildRequest_encodesBodyAsSnakeCase() async throws {
        let session = MockURLSession()
        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: .none)

        let payload = TestPayload(id: 1, userName: "alice")
        let request = try await client.buildRequest(path: "/members", method: "POST", body: payload)

        let body = request.httpBody!
        let json = try JSONSerialization.jsonObject(with: body) as! [String: Any]

        XCTAssertEqual(json["id"] as? Int, 1)
        XCTAssertEqual(json["user_name"] as? String, "alice")
        XCTAssertNil(json["userName"])
    }

    func test_buildRequest_includesAuthorizationHeader_whenTokenSet() async throws {
        let session = MockURLSession()
        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: .none)

        await client.setToken("test-token-123")
        let request = try await client.buildRequest(path: "/members", method: "GET")

        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer test-token-123")
    }

    func test_buildRequest_omitsAuthorizationHeader_whenNoToken() async throws {
        let session = MockURLSession()
        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: .none)

        let request = try await client.buildRequest(path: "/members", method: "GET")

        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }

    // MARK: - Successful Responses

    func test_get_decodesSnakeCaseResponse() async throws {
        let session = MockURLSession()
        let json = #"{"id": 42, "user_name": "bob"}"#
        session.responses = [(json.data(using: .utf8)!, httpResponse(statusCode: 200))]

        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: .none)
        let result: TestPayload = try await client.get("/members/42")

        XCTAssertEqual(result, TestPayload(id: 42, userName: "bob"))
    }

    func test_post_sendsBodyAndDecodesResponse() async throws {
        let session = MockURLSession()
        let responseJSON = #"{"id": 1, "user_name": "created"}"#
        session.responses = [(responseJSON.data(using: .utf8)!, httpResponse(statusCode: 201))]

        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: .none)
        let input = TestPayload(id: 0, userName: "newUser")
        let result: TestPayload = try await client.post("/members", body: input)

        XCTAssertEqual(result, TestPayload(id: 1, userName: "created"))
        XCTAssertEqual(session.requestCount, 1)
    }

    func test_fireAndForget_post_doesNotRequireResponseBody() async throws {
        let session = MockURLSession()
        session.responses = [(Data(), httpResponse(statusCode: 204))]

        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: .none)
        try await client.post("/members/1/activate")

        XCTAssertEqual(session.requestCount, 1)
    }

    // MARK: - Error Handling

    func test_unauthorized_throwsUnauthorizedError() async throws {
        let session = MockURLSession()
        session.responses = [(Data(), httpResponse(statusCode: 401))]

        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: .none)

        do {
            let _: TestPayload = try await client.get("/members")
            XCTFail("Expected APIError.unauthorized")
        } catch {
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
    }

    func test_forbidden_extractsServerMessage() async throws {
        let session = MockURLSession()
        let body = #"{"error": "Admin access required"}"#
        session.responses = [(body.data(using: .utf8)!, httpResponse(statusCode: 403))]

        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: .none)

        do {
            let _: TestPayload = try await client.get("/admin/settings")
            XCTFail("Expected APIError.forbidden")
        } catch {
            XCTAssertEqual(error as? APIError, .forbidden("Admin access required"))
        }
    }

    func test_notFound_throwsNotFoundError() async throws {
        let session = MockURLSession()
        session.responses = [(Data(), httpResponse(statusCode: 404))]

        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: .none)

        do {
            let _: TestPayload = try await client.get("/members/999")
            XCTFail("Expected APIError.notFound")
        } catch {
            XCTAssertEqual(error as? APIError, .notFound)
        }
    }

    func test_serverError_extractsMessage() async throws {
        let session = MockURLSession()
        let body = #"{"error": "Internal failure"}"#
        session.responses = [(body.data(using: .utf8)!, httpResponse(statusCode: 500))]

        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: .none)

        do {
            let _: TestPayload = try await client.get("/members")
            XCTFail("Expected APIError.httpError")
        } catch {
            XCTAssertEqual(error as? APIError, .httpError(500, "Internal failure"))
        }
    }

    // MARK: - Retry Logic

    func test_retries_on_serverError_thenSucceeds() async throws {
        let session = MockURLSession()
        let errorBody = #"{"error": "temporarily unavailable"}"#
        let successBody = #"{"id": 1, "user_name": "alice"}"#

        session.responses = [
            (errorBody.data(using: .utf8)!, httpResponse(statusCode: 503)),
            (successBody.data(using: .utf8)!, httpResponse(statusCode: 200)),
        ]

        let fastRetry = RetryConfig(maxAttempts: 3, baseDelay: 0.01, maxDelay: 0.01)
        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: fastRetry)
        let result: TestPayload = try await client.get("/members/1")

        XCTAssertEqual(result, TestPayload(id: 1, userName: "alice"))
        XCTAssertEqual(session.requestCount, 2)
    }

    func test_retries_on_rateLimited_thenSucceeds() async throws {
        let session = MockURLSession()
        let successBody = #"{"id": 1, "user_name": "alice"}"#

        session.responses = [
            (Data(), httpResponse(statusCode: 429)),
            (successBody.data(using: .utf8)!, httpResponse(statusCode: 200)),
        ]

        let fastRetry = RetryConfig(maxAttempts: 3, baseDelay: 0.01, maxDelay: 0.01)
        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: fastRetry)
        let result: TestPayload = try await client.get("/members/1")

        XCTAssertEqual(result, TestPayload(id: 1, userName: "alice"))
        XCTAssertEqual(session.requestCount, 2)
    }

    func test_retries_on_networkError_thenSucceeds() async throws {
        let session = MockURLSession()
        let successBody = #"{"id": 1, "user_name": "alice"}"#

        session.errors = [URLError(.timedOut), nil]
        session.responses = [
            (Data(), httpResponse(statusCode: 200)),
            (successBody.data(using: .utf8)!, httpResponse(statusCode: 200)),
        ]

        let fastRetry = RetryConfig(maxAttempts: 3, baseDelay: 0.01, maxDelay: 0.01)
        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: fastRetry)
        let result: TestPayload = try await client.get("/members/1")

        XCTAssertEqual(result, TestPayload(id: 1, userName: "alice"))
        XCTAssertEqual(session.requestCount, 2)
    }

    func test_doesNotRetry_on_clientError() async throws {
        let session = MockURLSession()

        session.responses = [
            (Data(), httpResponse(statusCode: 404)),
        ]

        let fastRetry = RetryConfig(maxAttempts: 3, baseDelay: 0.01, maxDelay: 0.01)
        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: fastRetry)

        do {
            let _: TestPayload = try await client.get("/members/999")
            XCTFail("Expected APIError.notFound")
        } catch {
            XCTAssertEqual(error as? APIError, .notFound)
        }
        XCTAssertEqual(session.requestCount, 1)
    }

    func test_doesNotRetry_on_unauthorized() async throws {
        let session = MockURLSession()

        session.responses = [
            (Data(), httpResponse(statusCode: 401)),
        ]

        let fastRetry = RetryConfig(maxAttempts: 3, baseDelay: 0.01, maxDelay: 0.01)
        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: fastRetry)

        do {
            let _: TestPayload = try await client.get("/members")
            XCTFail("Expected APIError.unauthorized")
        } catch {
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
        XCTAssertEqual(session.requestCount, 1)
    }

    func test_exhaustsRetries_thenThrowsLastError() async throws {
        let session = MockURLSession()
        let errorBody = #"{"error": "overloaded"}"#

        session.responses = [
            (errorBody.data(using: .utf8)!, httpResponse(statusCode: 503)),
            (errorBody.data(using: .utf8)!, httpResponse(statusCode: 503)),
            (errorBody.data(using: .utf8)!, httpResponse(statusCode: 503)),
        ]

        let fastRetry = RetryConfig(maxAttempts: 3, baseDelay: 0.01, maxDelay: 0.01)
        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: fastRetry)

        do {
            let _: TestPayload = try await client.get("/members")
            XCTFail("Expected APIError.httpError")
        } catch {
            XCTAssertEqual(error as? APIError, .httpError(503, "overloaded"))
        }
        XCTAssertEqual(session.requestCount, 3)
    }

    func test_fireAndForget_retries_on_serverError() async throws {
        let session = MockURLSession()

        session.responses = [
            (Data(), httpResponse(statusCode: 502)),
            (Data(), httpResponse(statusCode: 204)),
        ]

        let fastRetry = RetryConfig(maxAttempts: 3, baseDelay: 0.01, maxDelay: 0.01)
        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: fastRetry)
        try await client.post("/members/1/activate")

        XCTAssertEqual(session.requestCount, 2)
    }

    // MARK: - Retry Delay Calculation

    func test_retryDelay_exponentialBackoff() async {
        let config = RetryConfig(maxAttempts: 5, baseDelay: 1.0, maxDelay: 8.0)
        let client = APIClient(baseURL: testBaseURL, session: MockURLSession(), retryConfig: config)

        let d0 = await client.retryDelay(attempt: 0)
        let d1 = await client.retryDelay(attempt: 1)
        let d2 = await client.retryDelay(attempt: 2)
        let d3 = await client.retryDelay(attempt: 3)

        XCTAssertEqual(d0, 1.0, accuracy: 0.001)
        XCTAssertEqual(d1, 2.0, accuracy: 0.001)
        XCTAssertEqual(d2, 4.0, accuracy: 0.001)
        XCTAssertEqual(d3, 8.0, accuracy: 0.001)
    }

    func test_retryDelay_clampsToMaxDelay() async {
        let config = RetryConfig(maxAttempts: 5, baseDelay: 1.0, maxDelay: 5.0)
        let client = APIClient(baseURL: testBaseURL, session: MockURLSession(), retryConfig: config)

        let d3 = await client.retryDelay(attempt: 3)
        XCTAssertEqual(d3, 5.0, accuracy: 0.001)
    }

    // MARK: - isRetryable

    func test_isRetryable_networkErrors() async {
        let client = APIClient(baseURL: testBaseURL, session: MockURLSession())

        let retryable: [URLError.Code] = [
            .timedOut, .networkConnectionLost, .notConnectedToInternet,
            .cannotConnectToHost, .dnsLookupFailed,
        ]
        for code in retryable {
            let result = await client.isRetryable(URLError(code))
            XCTAssertTrue(result, "URLError.\(code) should be retryable")
        }

        let notRetryable: [URLError.Code] = [
            .badURL, .cancelled, .cannotDecodeContentData,
        ]
        for code in notRetryable {
            let result = await client.isRetryable(URLError(code))
            XCTAssertFalse(result, "URLError.\(code) should NOT be retryable")
        }
    }

    func test_isRetryable_apiErrors() async {
        let client = APIClient(baseURL: testBaseURL, session: MockURLSession())

        XCTAssertTrue(await client.isRetryable(APIError.rateLimited))
        XCTAssertTrue(await client.isRetryable(APIError.httpError(500, nil)))
        XCTAssertTrue(await client.isRetryable(APIError.httpError(502, nil)))
        XCTAssertTrue(await client.isRetryable(APIError.httpError(503, nil)))

        XCTAssertFalse(await client.isRetryable(APIError.unauthorized))
        XCTAssertFalse(await client.isRetryable(APIError.notFound))
        XCTAssertFalse(await client.isRetryable(APIError.forbidden(nil)))
        XCTAssertFalse(await client.isRetryable(APIError.httpError(400, nil)))
    }

    // MARK: - Cached Encoder/Decoder

    func test_sharedEncoder_usesSnakeCase() throws {
        let payload = TestPayload(id: 1, userName: "alice")
        let data = try APIClient.jsonEncoder.encode(AnyEncodable(payload))
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]

        XCTAssertEqual(json["user_name"] as? String, "alice")
        XCTAssertNil(json["userName"])
    }

    func test_sharedDecoder_parsesSnakeCase() throws {
        let json = #"{"id": 1, "user_name": "alice"}"#
        let result = try APIClient.jsonDecoder.decode(TestPayload.self, from: json.data(using: .utf8)!)

        XCTAssertEqual(result, TestPayload(id: 1, userName: "alice"))
    }

    // MARK: - Token Management

    func test_setToken_nil_clearsAuthorization() async throws {
        let session = MockURLSession()
        let client = APIClient(baseURL: testBaseURL, session: session, retryConfig: .none)

        await client.setToken("abc")
        var request = try await client.buildRequest(path: "/test", method: "GET")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer abc")

        await client.setToken(nil)
        request = try await client.buildRequest(path: "/test", method: "GET")
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }

    // MARK: - APIError descriptions

    func test_errorDescriptions() {
        XCTAssertEqual(APIError.invalidURL("/bad").errorDescription, "Invalid URL: /bad")
        XCTAssertEqual(APIError.invalidResponse.errorDescription, "Invalid response from server")
        XCTAssertEqual(APIError.unauthorized.errorDescription, "Session expired. Please sign in again.")
        XCTAssertEqual(APIError.forbidden(nil).errorDescription, "You don't have permission to do that.")
        XCTAssertEqual(APIError.forbidden("Custom msg").errorDescription, "Custom msg")
        XCTAssertEqual(APIError.notFound.errorDescription, "Not found.")
        XCTAssertEqual(APIError.rateLimited.errorDescription, "Too many requests. Please wait.")
        XCTAssertEqual(APIError.httpError(500, nil).errorDescription, "Server error (500)")
        XCTAssertEqual(APIError.httpError(500, "DB down").errorDescription, "DB down")
    }
}
