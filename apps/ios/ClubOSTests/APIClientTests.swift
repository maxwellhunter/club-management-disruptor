import XCTest
@testable import ClubOS

final class APIClientTests: XCTestCase {

    // MARK: - isRetryable status codes

    func test_retryable_429() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let result = await client.isRetryable(statusCode: 429)
        XCTAssertTrue(result)
    }

    func test_retryable_502() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let result = await client.isRetryable(statusCode: 502)
        XCTAssertTrue(result)
    }

    func test_retryable_503() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let result = await client.isRetryable(statusCode: 503)
        XCTAssertTrue(result)
    }

    func test_retryable_504() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let result = await client.isRetryable(statusCode: 504)
        XCTAssertTrue(result)
    }

    func test_notRetryable_200() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let result = await client.isRetryable(statusCode: 200)
        XCTAssertFalse(result)
    }

    func test_notRetryable_400() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let result = await client.isRetryable(statusCode: 400)
        XCTAssertFalse(result)
    }

    func test_notRetryable_401() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let result = await client.isRetryable(statusCode: 401)
        XCTAssertFalse(result)
    }

    func test_notRetryable_404() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let result = await client.isRetryable(statusCode: 404)
        XCTAssertFalse(result)
    }

    func test_notRetryable_500() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let result = await client.isRetryable(statusCode: 500)
        XCTAssertFalse(result)
    }

    // MARK: - isRetryableURLError

    func test_retryableURLError_timedOut() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let error = URLError(.timedOut)
        let result = await client.isRetryableURLError(error)
        XCTAssertTrue(result)
    }

    func test_retryableURLError_networkConnectionLost() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let error = URLError(.networkConnectionLost)
        let result = await client.isRetryableURLError(error)
        XCTAssertTrue(result)
    }

    func test_retryableURLError_notConnected() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let error = URLError(.notConnectedToInternet)
        let result = await client.isRetryableURLError(error)
        XCTAssertTrue(result)
    }

    func test_retryableURLError_cannotConnect() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let error = URLError(.cannotConnectToHost)
        let result = await client.isRetryableURLError(error)
        XCTAssertTrue(result)
    }

    func test_notRetryableURLError_cancelled() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let error = URLError(.cancelled)
        let result = await client.isRetryableURLError(error)
        XCTAssertFalse(result)
    }

    func test_notRetryableURLError_badURL() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let error = URLError(.badURL)
        let result = await client.isRetryableURLError(error)
        XCTAssertFalse(result)
    }

    func test_notRetryableURLError_badResponse() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let error = URLError(.badServerResponse)
        let result = await client.isRetryableURLError(error)
        XCTAssertFalse(result)
    }

    // MARK: - buildRequest

    func test_buildRequest_setsMethodAndPath() async throws {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let request = try await client.buildRequest(path: "/members", method: "GET")
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertTrue(request.url!.absoluteString.contains("/api/members"))
    }

    func test_buildRequest_setsContentType() async throws {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let request = try await client.buildRequest(path: "/test", method: "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
    }

    func test_buildRequest_appendsQueryParams() async throws {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let request = try await client.buildRequest(
            path: "/members",
            method: "GET",
            query: ["status": "active", "role": "admin"]
        )
        let url = request.url!.absoluteString
        XCTAssertTrue(url.contains("status=active"))
        XCTAssertTrue(url.contains("role=admin"))
    }

    func test_buildRequest_noTokenByDefault() async throws {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let request = try await client.buildRequest(path: "/test", method: "GET")
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }

    func test_buildRequest_includesTokenWhenSet() async throws {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        await client.setToken("test-jwt-token")
        let request = try await client.buildRequest(path: "/test", method: "GET")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer test-jwt-token")
    }

    func test_buildRequest_encodesBody() async throws {
        struct TestBody: Encodable {
            let firstName: String
            let lastName: String
        }

        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let request = try await client.buildRequest(
            path: "/members",
            method: "POST",
            body: TestBody(firstName: "John", lastName: "Doe")
        )
        XCTAssertNotNil(request.httpBody)
        let json = try JSONSerialization.jsonObject(with: request.httpBody!) as! [String: String]
        XCTAssertEqual(json["first_name"], "John")
        XCTAssertEqual(json["last_name"], "Doe")
    }

    // MARK: - APIError descriptions

    func test_apiError_invalidURL_description() {
        let error = APIError.invalidURL("/bad")
        XCTAssertEqual(error.errorDescription, "Invalid URL: /bad")
    }

    func test_apiError_invalidResponse_description() {
        let error = APIError.invalidResponse
        XCTAssertEqual(error.errorDescription, "Invalid response from server")
    }

    func test_apiError_unauthorized_description() {
        let error = APIError.unauthorized
        XCTAssertEqual(error.errorDescription, "Session expired. Please sign in again.")
    }

    func test_apiError_forbidden_withMessage() {
        let error = APIError.forbidden("Admin only")
        XCTAssertEqual(error.errorDescription, "Admin only")
    }

    func test_apiError_forbidden_withoutMessage() {
        let error = APIError.forbidden(nil)
        XCTAssertEqual(error.errorDescription, "You don't have permission to do that.")
    }

    func test_apiError_notFound_description() {
        let error = APIError.notFound
        XCTAssertEqual(error.errorDescription, "Not found.")
    }

    func test_apiError_rateLimited_description() {
        let error = APIError.rateLimited
        XCTAssertEqual(error.errorDescription, "Too many requests. Please wait.")
    }

    func test_apiError_httpError_withMessage() {
        let error = APIError.httpError(422, "Invalid data")
        XCTAssertEqual(error.errorDescription, "Invalid data")
    }

    func test_apiError_httpError_withoutMessage() {
        let error = APIError.httpError(500, nil)
        XCTAssertEqual(error.errorDescription, "Server error (500)")
    }

    // MARK: - Retry configuration

    func test_defaultRetryConfig() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared
        )
        let maxRetries = await client.maxRetries
        let baseDelay = await client.retryBaseDelay
        XCTAssertEqual(maxRetries, 3)
        XCTAssertEqual(baseDelay, 1.0)
    }

    func test_customRetryConfig() async {
        let client = APIClient(
            baseURL: URL(string: "https://example.com")!,
            session: .shared,
            maxRetries: 5,
            retryBaseDelay: 0.5
        )
        let maxRetries = await client.maxRetries
        let baseDelay = await client.retryBaseDelay
        XCTAssertEqual(maxRetries, 5)
        XCTAssertEqual(baseDelay, 0.5)
    }
}
