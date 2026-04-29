import XCTest
@testable import ClubOS

// MARK: - Mock URLSession

final class MockURLSession: URLSessionProtocol, @unchecked Sendable {
    private let lock = NSLock()
    private var _responses: [(Data, URLResponse)] = []
    private var _errors: [Error?] = []
    private var _requestLog: [URLRequest] = []

    var requestLog: [URLRequest] {
        lock.lock()
        defer { lock.unlock() }
        return _requestLog
    }

    var requestCount: Int { requestLog.count }

    func enqueue(data: Data, statusCode: Int, url: URL = URL(string: "https://test.com")!) {
        lock.lock()
        defer { lock.unlock() }
        let response = HTTPURLResponse(url: url, statusCode: statusCode, httpVersion: nil, headerFields: nil)!
        _responses.append((data, response))
        _errors.append(nil)
    }

    func enqueueError(_ error: Error) {
        lock.lock()
        defer { lock.unlock() }
        _responses.append((Data(), URLResponse()))
        _errors.append(error)
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        lock.lock()
        guard !_responses.isEmpty else {
            lock.unlock()
            fatalError("MockURLSession: no enqueued responses left")
        }
        let response = _responses.removeFirst()
        let error = _errors.removeFirst()
        _requestLog.append(request)
        lock.unlock()

        if let error { throw error }
        return response
    }
}

// MARK: - Test Helpers

private let testBaseURL = URL(string: "https://api.test.club")!

private func makeClient(
    session: MockURLSession = MockURLSession(),
    maxRetries: Int = 0,
    initialBackoff: TimeInterval = 0.01
) -> (APIClient, MockURLSession) {
    let client = APIClient(baseURL: testBaseURL, session: session, maxRetries: maxRetries, initialBackoff: initialBackoff)
    return (client, session)
}

private struct TestPayload: Codable, Equatable {
    let userName: String
    let age: Int
}

private struct SimpleBody: Codable {
    let displayName: String
}

// MARK: - Tests

final class APIClientTests: XCTestCase {

    // MARK: - Request Building

    func test_buildRequest_constructsCorrectURL() async throws {
        let (client, _) = makeClient()
        let request = try await client.buildRequest(path: "/members", method: "GET")
        XCTAssertEqual(request.url?.path, "/api/members")
        XCTAssertTrue(request.url!.absoluteString.hasPrefix("https://api.test.club"))
    }

    func test_buildRequest_appendsQueryParameters() async throws {
        let (client, _) = makeClient()
        let request = try await client.buildRequest(
            path: "/members",
            method: "GET",
            query: ["status": "active", "role": "admin"]
        )
        let components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!
        let queryItems = Set(components.queryItems ?? [])
        XCTAssertTrue(queryItems.contains(URLQueryItem(name: "status", value: "active")))
        XCTAssertTrue(queryItems.contains(URLQueryItem(name: "role", value: "admin")))
    }

    func test_buildRequest_setsHTTPMethod() async throws {
        let (client, _) = makeClient()
        for method in ["GET", "POST", "PATCH", "PUT", "DELETE"] {
            let request = try await client.buildRequest(path: "/test", method: method)
            XCTAssertEqual(request.httpMethod, method)
        }
    }

    func test_buildRequest_setsContentTypeHeader() async throws {
        let (client, _) = makeClient()
        let request = try await client.buildRequest(path: "/test", method: "GET")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
    }

    func test_buildRequest_noAuthHeaderWithoutToken() async throws {
        let (client, _) = makeClient()
        let request = try await client.buildRequest(path: "/test", method: "GET")
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }

    func test_buildRequest_includesAuthHeaderWhenTokenIsSet() async throws {
        let (client, _) = makeClient()
        await client.setToken("test-jwt-token")
        let request = try await client.buildRequest(path: "/test", method: "GET")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer test-jwt-token")
    }

    func test_buildRequest_encodesBodyAsSnakeCase() async throws {
        let (client, _) = makeClient()
        let body = SimpleBody(displayName: "Test User")
        let request = try await client.buildRequest(path: "/test", method: "POST", body: body)

        let jsonObject = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: Any]
        XCTAssertEqual(jsonObject["display_name"] as? String, "Test User")
        XCTAssertNil(jsonObject["displayName"])
    }

    func test_buildRequest_noBodyForGET() async throws {
        let (client, _) = makeClient()
        let request = try await client.buildRequest(path: "/test", method: "GET")
        XCTAssertNil(request.httpBody)
    }

    // MARK: - Token Management

    func test_setToken_updatesToken() async {
        let (client, _) = makeClient()
        let before = await client.getToken()
        XCTAssertNil(before)

        await client.setToken("abc123")
        let after = await client.getToken()
        XCTAssertEqual(after, "abc123")
    }

    func test_setToken_clearToken() async {
        let (client, _) = makeClient()
        await client.setToken("abc123")
        await client.setToken(nil)
        let token = await client.getToken()
        XCTAssertNil(token)
    }

    // MARK: - Response Validation

    func test_validateResponse_successRange() async throws {
        let (client, _) = makeClient()
        for code in [200, 201, 204, 299] {
            let response = HTTPURLResponse(url: testBaseURL, statusCode: code, httpVersion: nil, headerFields: nil)!
            try await client.validateResponse(response, data: Data())
        }
    }

    func test_validateResponse_401ThrowsUnauthorized() async {
        let (client, _) = makeClient()
        let response = HTTPURLResponse(url: testBaseURL, statusCode: 401, httpVersion: nil, headerFields: nil)!
        do {
            try await client.validateResponse(response, data: Data())
            XCTFail("Expected unauthorized error")
        } catch {
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
    }

    func test_validateResponse_403ThrowsForbiddenWithMessage() async {
        let (client, _) = makeClient()
        let response = HTTPURLResponse(url: testBaseURL, statusCode: 403, httpVersion: nil, headerFields: nil)!
        let body = try! JSONEncoder().encode(["error": "Members only"])
        do {
            try await client.validateResponse(response, data: body)
            XCTFail("Expected forbidden error")
        } catch {
            XCTAssertEqual(error as? APIError, .forbidden("Members only"))
        }
    }

    func test_validateResponse_403WithoutMessageUsesDefault() async {
        let (client, _) = makeClient()
        let response = HTTPURLResponse(url: testBaseURL, statusCode: 403, httpVersion: nil, headerFields: nil)!
        do {
            try await client.validateResponse(response, data: Data())
            XCTFail("Expected forbidden error")
        } catch {
            XCTAssertEqual(error as? APIError, .forbidden(nil))
        }
    }

    func test_validateResponse_404ThrowsNotFound() async {
        let (client, _) = makeClient()
        let response = HTTPURLResponse(url: testBaseURL, statusCode: 404, httpVersion: nil, headerFields: nil)!
        do {
            try await client.validateResponse(response, data: Data())
            XCTFail("Expected not found error")
        } catch {
            XCTAssertEqual(error as? APIError, .notFound)
        }
    }

    func test_validateResponse_429ThrowsRateLimited() async {
        let (client, _) = makeClient()
        let response = HTTPURLResponse(url: testBaseURL, statusCode: 429, httpVersion: nil, headerFields: nil)!
        do {
            try await client.validateResponse(response, data: Data())
            XCTFail("Expected rate limited error")
        } catch {
            XCTAssertEqual(error as? APIError, .rateLimited)
        }
    }

    func test_validateResponse_500ThrowsHTTPError() async {
        let (client, _) = makeClient()
        let response = HTTPURLResponse(url: testBaseURL, statusCode: 500, httpVersion: nil, headerFields: nil)!
        let body = try! JSONEncoder().encode(["error": "Internal failure"])
        do {
            try await client.validateResponse(response, data: body)
            XCTFail("Expected http error")
        } catch {
            XCTAssertEqual(error as? APIError, .httpError(500, "Internal failure"))
        }
    }

    func test_validateResponse_nonHTTPResponseThrowsInvalidResponse() async {
        let (client, _) = makeClient()
        let response = URLResponse()
        do {
            try await client.validateResponse(response, data: Data())
            XCTFail("Expected invalid response error")
        } catch {
            XCTAssertEqual(error as? APIError, .invalidResponse)
        }
    }

    // MARK: - GET with Decoding

    func test_get_decodesSnakeCaseResponse() async throws {
        let session = MockURLSession()
        let json = #"{"user_name": "Alice", "age": 30}"#
        session.enqueue(data: json.data(using: .utf8)!, statusCode: 200)

        let (client, _) = makeClient(session: session)
        let result: TestPayload = try await client.get("/members/1")
        XCTAssertEqual(result, TestPayload(userName: "Alice", age: 30))
    }

    func test_get_passesQueryParams() async throws {
        let session = MockURLSession()
        let json = #"{"user_name": "Bob", "age": 25}"#
        session.enqueue(data: json.data(using: .utf8)!, statusCode: 200)

        let (client, _) = makeClient(session: session)
        let _: TestPayload = try await client.get("/members", query: ["status": "active"])

        let sentURL = session.requestLog.first!.url!
        XCTAssertTrue(sentURL.query!.contains("status=active"))
    }

    func test_get_throwsOnHTTPError() async {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 404)
        let (client, _) = makeClient(session: session)

        do {
            let _: TestPayload = try await client.get("/missing")
            XCTFail("Expected error")
        } catch {
            XCTAssertEqual(error as? APIError, .notFound)
        }
    }

    // MARK: - POST

    func test_post_sendsBodyAndDecodesResponse() async throws {
        let session = MockURLSession()
        let json = #"{"user_name": "Created", "age": 1}"#
        session.enqueue(data: json.data(using: .utf8)!, statusCode: 201)

        let (client, _) = makeClient(session: session)
        let body = SimpleBody(displayName: "New Member")
        let result: TestPayload = try await client.post("/members", body: body)

        XCTAssertEqual(result.userName, "Created")
        XCTAssertEqual(session.requestLog.first!.httpMethod, "POST")

        let sentBody = try JSONSerialization.jsonObject(with: session.requestLog.first!.httpBody!) as! [String: Any]
        XCTAssertEqual(sentBody["display_name"] as? String, "New Member")
    }

    func test_post_fireAndForget_succeeds() async throws {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 204)

        let (client, _) = makeClient(session: session)
        try await client.post("/members/1/notify")
        XCTAssertEqual(session.requestCount, 1)
    }

    func test_post_fireAndForget_throwsOnError() async {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 401)
        let (client, _) = makeClient(session: session)

        do {
            try await client.post("/protected")
            XCTFail("Expected unauthorized")
        } catch {
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
    }

    // MARK: - PATCH

    func test_patch_sendsBodyAndDecodesResponse() async throws {
        let session = MockURLSession()
        let json = #"{"user_name": "Updated", "age": 31}"#
        session.enqueue(data: json.data(using: .utf8)!, statusCode: 200)

        let (client, _) = makeClient(session: session)
        let result: TestPayload = try await client.patch("/members/1", body: SimpleBody(displayName: "Updated"))
        XCTAssertEqual(result.userName, "Updated")
        XCTAssertEqual(session.requestLog.first!.httpMethod, "PATCH")
    }

    func test_patch_fireAndForget() async throws {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 200)

        let (client, _) = makeClient(session: session)
        try await client.patch("/members/1", body: SimpleBody(displayName: "Patched"))
        XCTAssertEqual(session.requestLog.first!.httpMethod, "PATCH")
    }

    // MARK: - PUT

    func test_put_decodesResponse() async throws {
        let session = MockURLSession()
        let json = #"{"user_name": "Replaced", "age": 40}"#
        session.enqueue(data: json.data(using: .utf8)!, statusCode: 200)

        let (client, _) = makeClient(session: session)
        let result: TestPayload = try await client.put("/members/1", body: SimpleBody(displayName: "R"))
        XCTAssertEqual(result.userName, "Replaced")
    }

    func test_put_fireAndForget() async throws {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 204)

        let (client, _) = makeClient(session: session)
        try await client.put("/members/1", body: SimpleBody(displayName: "Done"))
        XCTAssertEqual(session.requestLog.first!.httpMethod, "PUT")
    }

    // MARK: - DELETE

    func test_delete_decodesResponse() async throws {
        let session = MockURLSession()
        let json = #"{"user_name": "Deleted", "age": 0}"#
        session.enqueue(data: json.data(using: .utf8)!, statusCode: 200)

        let (client, _) = makeClient(session: session)
        let result: TestPayload = try await client.delete("/members/1")
        XCTAssertEqual(result.userName, "Deleted")
    }

    func test_delete_fireAndForget() async throws {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 204)

        let (client, _) = makeClient(session: session)
        try await client.delete("/members/1")
        XCTAssertEqual(session.requestLog.first!.httpMethod, "DELETE")
    }

    // MARK: - Retry Logic

    func test_retry_retriesOnRateLimited() async throws {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 429)
        session.enqueue(data: Data(), statusCode: 429)
        let json = #"{"user_name": "OK", "age": 1}"#
        session.enqueue(data: json.data(using: .utf8)!, statusCode: 200)

        let (client, _) = makeClient(session: session, maxRetries: 3, initialBackoff: 0.01)
        let result: TestPayload = try await client.get("/members")
        XCTAssertEqual(result.userName, "OK")
        XCTAssertEqual(session.requestCount, 3)
    }

    func test_retry_retriesOnServerError() async throws {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 502)
        let json = #"{"user_name": "Recovered", "age": 2}"#
        session.enqueue(data: json.data(using: .utf8)!, statusCode: 200)

        let (client, _) = makeClient(session: session, maxRetries: 2, initialBackoff: 0.01)
        let result: TestPayload = try await client.get("/members")
        XCTAssertEqual(result.userName, "Recovered")
        XCTAssertEqual(session.requestCount, 2)
    }

    func test_retry_retriesOnNetworkError() async throws {
        let session = MockURLSession()
        session.enqueueError(URLError(.networkConnectionLost))
        let json = #"{"user_name": "Back", "age": 3}"#
        session.enqueue(data: json.data(using: .utf8)!, statusCode: 200)

        let (client, _) = makeClient(session: session, maxRetries: 2, initialBackoff: 0.01)
        let result: TestPayload = try await client.get("/members")
        XCTAssertEqual(result.userName, "Back")
    }

    func test_retry_doesNotRetryOn401() async {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 401)

        let (client, _) = makeClient(session: session, maxRetries: 3, initialBackoff: 0.01)
        do {
            let _: TestPayload = try await client.get("/protected")
            XCTFail("Expected unauthorized")
        } catch {
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
        XCTAssertEqual(session.requestCount, 1)
    }

    func test_retry_doesNotRetryOn403() async {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 403)

        let (client, _) = makeClient(session: session, maxRetries: 3, initialBackoff: 0.01)
        do {
            let _: TestPayload = try await client.get("/admin")
            XCTFail("Expected forbidden")
        } catch {
            XCTAssertEqual(error as? APIError, .forbidden(nil))
        }
        XCTAssertEqual(session.requestCount, 1)
    }

    func test_retry_doesNotRetryOn404() async {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 404)

        let (client, _) = makeClient(session: session, maxRetries: 3, initialBackoff: 0.01)
        do {
            let _: TestPayload = try await client.get("/missing")
            XCTFail("Expected not found")
        } catch {
            XCTAssertEqual(error as? APIError, .notFound)
        }
        XCTAssertEqual(session.requestCount, 1)
    }

    func test_retry_exhaustsRetriesThenThrows() async {
        let session = MockURLSession()
        for _ in 0...2 {
            session.enqueue(data: Data(), statusCode: 503)
        }

        let (client, _) = makeClient(session: session, maxRetries: 2, initialBackoff: 0.01)
        do {
            let _: TestPayload = try await client.get("/flaky")
            XCTFail("Expected error after retries exhausted")
        } catch {
            XCTAssertEqual(error as? APIError, .httpError(503, nil))
        }
        XCTAssertEqual(session.requestCount, 3)
    }

    func test_retry_fireAndForget_retriesOnServerError() async throws {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 500)
        session.enqueue(data: Data(), statusCode: 200)

        let (client, _) = makeClient(session: session, maxRetries: 2, initialBackoff: 0.01)
        try await client.post("/webhook")
        XCTAssertEqual(session.requestCount, 2)
    }

    func test_retry_fireAndForget_doesNotRetryOnClientError() async {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 404)

        let (client, _) = makeClient(session: session, maxRetries: 3, initialBackoff: 0.01)
        do {
            try await client.post("/missing")
            XCTFail("Expected not found")
        } catch {
            XCTAssertEqual(error as? APIError, .notFound)
        }
        XCTAssertEqual(session.requestCount, 1)
    }

    func test_noRetries_failsImmediately() async {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 500)

        let (client, _) = makeClient(session: session, maxRetries: 0, initialBackoff: 0.01)
        do {
            let _: TestPayload = try await client.get("/fail")
            XCTFail("Expected error")
        } catch {
            XCTAssertEqual(error as? APIError, .httpError(500, nil))
        }
        XCTAssertEqual(session.requestCount, 1)
    }

    // MARK: - Retry Classification

    func test_isRetryable_rateLimited() async {
        let (client, _) = makeClient()
        let retryable = await client.isRetryable(APIError.rateLimited)
        XCTAssertTrue(retryable)
    }

    func test_isRetryable_serverErrors() async {
        let (client, _) = makeClient()
        for code in [500, 502, 503, 504] {
            let retryable = await client.isRetryable(APIError.httpError(code, nil))
            XCTAssertTrue(retryable, "Expected \(code) to be retryable")
        }
    }

    func test_isRetryable_clientErrorsAreNot() async {
        let (client, _) = makeClient()
        let nonRetryable: [APIError] = [.unauthorized, .forbidden(nil), .notFound, .invalidResponse, .invalidURL("/x"), .httpError(400, nil), .httpError(422, nil)]
        for err in nonRetryable {
            let retryable = await client.isRetryable(err)
            XCTAssertFalse(retryable, "Expected \(err) to NOT be retryable")
        }
    }

    func test_isRetryable_urlErrorIsRetryable() async {
        let (client, _) = makeClient()
        let retryable = await client.isRetryable(URLError(.timedOut))
        XCTAssertTrue(retryable)
    }

    // MARK: - APIError descriptions

    func test_errorDescriptions() {
        XCTAssertEqual(APIError.invalidURL("/bad").errorDescription, "Invalid URL: /bad")
        XCTAssertEqual(APIError.invalidResponse.errorDescription, "Invalid response from server")
        XCTAssertEqual(APIError.unauthorized.errorDescription, "Session expired. Please sign in again.")
        XCTAssertEqual(APIError.forbidden(nil).errorDescription, "You don't have permission to do that.")
        XCTAssertEqual(APIError.forbidden("Custom").errorDescription, "Custom")
        XCTAssertEqual(APIError.notFound.errorDescription, "Not found.")
        XCTAssertEqual(APIError.rateLimited.errorDescription, "Too many requests. Please wait.")
        XCTAssertEqual(APIError.httpError(500, nil).errorDescription, "Server error (500)")
        XCTAssertEqual(APIError.httpError(500, "DB down").errorDescription, "DB down")
    }

    // MARK: - Auth header propagation through HTTP methods

    func test_get_sendsAuthHeader() async throws {
        let session = MockURLSession()
        let json = #"{"user_name": "A", "age": 1}"#
        session.enqueue(data: json.data(using: .utf8)!, statusCode: 200)

        let (client, _) = makeClient(session: session)
        await client.setToken("my-token")
        let _: TestPayload = try await client.get("/test")

        let auth = session.requestLog.first!.value(forHTTPHeaderField: "Authorization")
        XCTAssertEqual(auth, "Bearer my-token")
    }

    func test_post_sendsAuthHeader() async throws {
        let session = MockURLSession()
        session.enqueue(data: Data(), statusCode: 204)

        let (client, _) = makeClient(session: session)
        await client.setToken("post-token")
        try await client.post("/test")

        let auth = session.requestLog.first!.value(forHTTPHeaderField: "Authorization")
        XCTAssertEqual(auth, "Bearer post-token")
    }

    // MARK: - getData (raw)

    func test_getData_returnsRawDataAndResponse() async throws {
        let session = MockURLSession()
        let raw = "raw-bytes".data(using: .utf8)!
        session.enqueue(data: raw, statusCode: 200)

        let (client, _) = makeClient(session: session)
        let (data, response) = try await client.getData("/export")
        XCTAssertEqual(data, raw)
        XCTAssertEqual(response.statusCode, 200)
    }

    func test_getData_nonHTTPResponseThrows() async {
        let session = MockURLSession()
        session.enqueueError(URLError(.badServerResponse))

        let (client, _) = makeClient(session: session)
        do {
            let _ = try await client.getData("/broken")
            XCTFail("Expected error")
        } catch {
            XCTAssertTrue(error is URLError)
        }
    }
}
