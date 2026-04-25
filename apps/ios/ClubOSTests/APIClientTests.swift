import XCTest
@testable import ClubOS

final class APIClientTests: XCTestCase {

    private var client: APIClient!
    private let testBaseURL = URL(string: "https://test.example.com")!

    override func setUp() {
        super.setUp()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        let session = URLSession(configuration: config)
        client = APIClient(baseURL: testBaseURL, session: session, maxRetries: 2, initialRetryDelay: 0.01)
    }

    override func tearDown() {
        MockURLProtocol.requestHandler = nil
        client = nil
        super.tearDown()
    }

    // MARK: - buildRequest — URL & Method

    func test_buildRequest_setsCorrectURLWithApiPrefix() async throws {
        let request = try await client.buildRequest(path: "/members", method: "GET")
        XCTAssertTrue(request.url!.absoluteString.contains("/api/members"))
    }

    func test_buildRequest_setsHTTPMethod() async throws {
        for method in ["GET", "POST", "PATCH", "PUT", "DELETE"] {
            let request = try await client.buildRequest(path: "/test", method: method)
            XCTAssertEqual(request.httpMethod, method)
        }
    }

    func test_buildRequest_setsContentTypeHeader() async throws {
        let request = try await client.buildRequest(path: "/test", method: "GET")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
    }

    // MARK: - buildRequest — Auth

    func test_buildRequest_noAuthHeaderWithoutToken() async throws {
        let request = try await client.buildRequest(path: "/test", method: "GET")
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }

    func test_buildRequest_setsAuthHeaderWithToken() async throws {
        await client.setToken("test-token-123")
        let request = try await client.buildRequest(path: "/test", method: "GET")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer test-token-123")
    }

    func test_buildRequest_clearsAuthHeaderWhenTokenSetToNil() async throws {
        await client.setToken("some-token")
        await client.setToken(nil)
        let request = try await client.buildRequest(path: "/test", method: "GET")
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }

    // MARK: - buildRequest — Query & Body

    func test_buildRequest_encodesQueryParams() async throws {
        let request = try await client.buildRequest(
            path: "/members",
            method: "GET",
            query: ["status": "active", "role": "admin"]
        )
        let url = request.url!.absoluteString
        XCTAssertTrue(url.contains("status=active"))
        XCTAssertTrue(url.contains("role=admin"))
    }

    func test_buildRequest_encodesBodyAsSnakeCase() async throws {
        struct TestBody: Encodable {
            let firstName: String
            let lastName: String
        }
        let request = try await client.buildRequest(
            path: "/members",
            method: "POST",
            body: TestBody(firstName: "John", lastName: "Doe")
        )
        let bodyString = String(data: request.httpBody!, encoding: .utf8)!
        XCTAssertTrue(bodyString.contains("first_name"))
        XCTAssertTrue(bodyString.contains("last_name"))
        XCTAssertFalse(bodyString.contains("firstName"))
    }

    func test_buildRequest_noBodyForGET() async throws {
        let request = try await client.buildRequest(path: "/test", method: "GET")
        XCTAssertNil(request.httpBody)
    }

    // MARK: - validateResponse

    func test_validateResponse_200_succeeds() async throws {
        let response = HTTPURLResponse(url: testBaseURL, statusCode: 200, httpVersion: nil, headerFields: nil)!
        try await client.validateResponse(response, data: Data())
    }

    func test_validateResponse_201_succeeds() async throws {
        let response = HTTPURLResponse(url: testBaseURL, statusCode: 201, httpVersion: nil, headerFields: nil)!
        try await client.validateResponse(response, data: Data())
    }

    func test_validateResponse_401_throwsUnauthorized() async {
        let response = HTTPURLResponse(url: testBaseURL, statusCode: 401, httpVersion: nil, headerFields: nil)!
        do {
            try await client.validateResponse(response, data: Data())
            XCTFail("Expected unauthorized error")
        } catch let error as APIError {
            XCTAssertEqual(error, .unauthorized)
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    func test_validateResponse_403_throwsForbiddenWithMessage() async {
        let response = HTTPURLResponse(url: testBaseURL, statusCode: 403, httpVersion: nil, headerFields: nil)!
        let body = #"{"error": "Admin only"}"#.data(using: .utf8)!
        do {
            try await client.validateResponse(response, data: body)
            XCTFail("Expected forbidden error")
        } catch let error as APIError {
            XCTAssertEqual(error, .forbidden("Admin only"))
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    func test_validateResponse_403_throwsForbiddenNilWhenNoBody() async {
        let response = HTTPURLResponse(url: testBaseURL, statusCode: 403, httpVersion: nil, headerFields: nil)!
        do {
            try await client.validateResponse(response, data: Data())
            XCTFail("Expected forbidden error")
        } catch let error as APIError {
            XCTAssertEqual(error, .forbidden(nil))
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    func test_validateResponse_404_throwsNotFound() async {
        let response = HTTPURLResponse(url: testBaseURL, statusCode: 404, httpVersion: nil, headerFields: nil)!
        do {
            try await client.validateResponse(response, data: Data())
            XCTFail("Expected not found error")
        } catch let error as APIError {
            XCTAssertEqual(error, .notFound)
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    func test_validateResponse_429_throwsRateLimited() async {
        let response = HTTPURLResponse(url: testBaseURL, statusCode: 429, httpVersion: nil, headerFields: nil)!
        do {
            try await client.validateResponse(response, data: Data())
            XCTFail("Expected rate limited error")
        } catch let error as APIError {
            XCTAssertEqual(error, .rateLimited)
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    func test_validateResponse_500_throwsHTTPErrorWithMessage() async {
        let response = HTTPURLResponse(url: testBaseURL, statusCode: 500, httpVersion: nil, headerFields: nil)!
        let body = #"{"error": "Internal server error"}"#.data(using: .utf8)!
        do {
            try await client.validateResponse(response, data: body)
            XCTFail("Expected HTTP error")
        } catch let error as APIError {
            XCTAssertEqual(error, .httpError(500, "Internal server error"))
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    // MARK: - extractErrorMessage

    func test_extractErrorMessage_validJSON() async {
        let data = #"{"error": "Something went wrong"}"#.data(using: .utf8)!
        let msg = await client.extractErrorMessage(from: data)
        XCTAssertEqual(msg, "Something went wrong")
    }

    func test_extractErrorMessage_invalidJSON() async {
        let data = "not json".data(using: .utf8)!
        let msg = await client.extractErrorMessage(from: data)
        XCTAssertNil(msg)
    }

    func test_extractErrorMessage_missingErrorField() async {
        let data = #"{"message": "wrong field"}"#.data(using: .utf8)!
        let msg = await client.extractErrorMessage(from: data)
        XCTAssertNil(msg)
    }

    func test_extractErrorMessage_emptyData() async {
        let msg = await client.extractErrorMessage(from: Data())
        XCTAssertNil(msg)
    }

    // MARK: - isRetriableStatusCode

    func test_isRetriableStatusCode_retriableCodes() {
        for code in [429, 500, 501, 502, 503, 504] {
            XCTAssertTrue(APIClient.isRetriableStatusCode(code), "\(code) should be retriable")
        }
    }

    func test_isRetriableStatusCode_nonRetriableCodes() {
        for code in [200, 201, 400, 401, 403, 404, 422] {
            XCTAssertFalse(APIClient.isRetriableStatusCode(code), "\(code) should not be retriable")
        }
    }

    // MARK: - isRetriableURLError

    func test_isRetriableURLError_retriableErrors() {
        let retriable: [URLError.Code] = [.timedOut, .networkConnectionLost, .cannotConnectToHost]
        for code in retriable {
            XCTAssertTrue(APIClient.isRetriableURLError(URLError(code)), "\(code) should be retriable")
        }
    }

    func test_isRetriableURLError_nonRetriableErrors() {
        let nonRetriable: [URLError.Code] = [.badURL, .cancelled, .unsupportedURL, .badServerResponse]
        for code in nonRetriable {
            XCTAssertFalse(APIClient.isRetriableURLError(URLError(code)), "\(code) should not be retriable")
        }
    }

    // MARK: - Retry Integration

    func test_get_retriesOn503ThenSucceeds() async throws {
        var attemptCount = 0
        MockURLProtocol.requestHandler = { request in
            attemptCount += 1
            if attemptCount < 2 {
                return (HTTPURLResponse(url: request.url!, statusCode: 503, httpVersion: nil, headerFields: nil)!, Data())
            }
            let body = #"{"name": "test"}"#.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, body)
        }

        struct R: Decodable { let name: String }
        let result: R = try await client.get("/test")
        XCTAssertEqual(result.name, "test")
        XCTAssertEqual(attemptCount, 2)
    }

    func test_get_retriesOn429ThenSucceeds() async throws {
        var attemptCount = 0
        MockURLProtocol.requestHandler = { request in
            attemptCount += 1
            if attemptCount < 2 {
                return (HTTPURLResponse(url: request.url!, statusCode: 429, httpVersion: nil, headerFields: nil)!, Data())
            }
            let body = #"{"value": 42}"#.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, body)
        }

        struct R: Decodable { let value: Int }
        let result: R = try await client.get("/test")
        XCTAssertEqual(result.value, 42)
        XCTAssertEqual(attemptCount, 2)
    }

    func test_get_givesUpAfterMaxRetries() async throws {
        var attemptCount = 0
        MockURLProtocol.requestHandler = { request in
            attemptCount += 1
            let body = #"{"error": "service unavailable"}"#.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 503, httpVersion: nil, headerFields: nil)!, body)
        }

        struct R: Decodable { let name: String }
        do {
            let _: R = try await client.get("/test")
            XCTFail("Expected error after max retries")
        } catch let error as APIError {
            XCTAssertEqual(error, .httpError(503, "service unavailable"))
        }
        XCTAssertEqual(attemptCount, 3) // 1 initial + 2 retries
    }

    func test_get_doesNotRetryOn401() async throws {
        var attemptCount = 0
        MockURLProtocol.requestHandler = { request in
            attemptCount += 1
            return (HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!, Data())
        }

        struct R: Decodable { let name: String }
        do {
            let _: R = try await client.get("/test")
            XCTFail("Expected unauthorized error")
        } catch let error as APIError {
            XCTAssertEqual(error, .unauthorized)
        }
        XCTAssertEqual(attemptCount, 1)
    }

    func test_get_doesNotRetryOn404() async throws {
        var attemptCount = 0
        MockURLProtocol.requestHandler = { request in
            attemptCount += 1
            return (HTTPURLResponse(url: request.url!, statusCode: 404, httpVersion: nil, headerFields: nil)!, Data())
        }

        struct R: Decodable { let name: String }
        do {
            let _: R = try await client.get("/test")
            XCTFail("Expected not found error")
        } catch let error as APIError {
            XCTAssertEqual(error, .notFound)
        }
        XCTAssertEqual(attemptCount, 1)
    }

    func test_post_fireAndForget_retriesOn503() async throws {
        var attemptCount = 0
        MockURLProtocol.requestHandler = { request in
            attemptCount += 1
            if attemptCount < 2 {
                return (HTTPURLResponse(url: request.url!, statusCode: 503, httpVersion: nil, headerFields: nil)!, Data())
            }
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data())
        }

        try await client.post("/test")
        XCTAssertEqual(attemptCount, 2)
    }

    func test_delete_fireAndForget_retriesOn500() async throws {
        var attemptCount = 0
        MockURLProtocol.requestHandler = { request in
            attemptCount += 1
            if attemptCount < 3 {
                return (HTTPURLResponse(url: request.url!, statusCode: 500, httpVersion: nil, headerFields: nil)!, Data())
            }
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data())
        }

        try await client.delete("/test")
        XCTAssertEqual(attemptCount, 3)
    }

    func test_successfulRequestNoRetry() async throws {
        var attemptCount = 0
        MockURLProtocol.requestHandler = { request in
            attemptCount += 1
            let body = #"{"ok": true}"#.data(using: .utf8)!
            return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, body)
        }

        struct R: Decodable { let ok: Bool }
        let result: R = try await client.get("/test")
        XCTAssertTrue(result.ok)
        XCTAssertEqual(attemptCount, 1)
    }

    // MARK: - APIError

    func test_apiError_descriptions() {
        XCTAssertEqual(APIError.invalidURL("/bad").errorDescription, "Invalid URL: /bad")
        XCTAssertEqual(APIError.invalidResponse.errorDescription, "Invalid response from server")
        XCTAssertEqual(APIError.unauthorized.errorDescription, "Session expired. Please sign in again.")
        XCTAssertEqual(APIError.forbidden(nil).errorDescription, "You don't have permission to do that.")
        XCTAssertEqual(APIError.forbidden("Custom").errorDescription, "Custom")
        XCTAssertEqual(APIError.notFound.errorDescription, "Not found.")
        XCTAssertEqual(APIError.rateLimited.errorDescription, "Too many requests. Please wait.")
        XCTAssertEqual(APIError.httpError(500, nil).errorDescription, "Server error (500)")
        XCTAssertEqual(APIError.httpError(500, "Bad").errorDescription, "Bad")
    }

    func test_apiError_equatable() {
        XCTAssertEqual(APIError.unauthorized, APIError.unauthorized)
        XCTAssertNotEqual(APIError.unauthorized, APIError.notFound)
        XCTAssertEqual(APIError.httpError(500, "x"), APIError.httpError(500, "x"))
        XCTAssertNotEqual(APIError.httpError(500, "a"), APIError.httpError(500, "b"))
        XCTAssertNotEqual(APIError.httpError(500, nil), APIError.httpError(503, nil))
    }
}

// MARK: - Mock URL Protocol

final class MockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.requestHandler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}
