import XCTest
@testable import ClubOS

final class APIClientTests: XCTestCase {

    // MARK: - buildRequest

    func test_buildRequest_setsAuthorizationHeader() async throws {
        let client = APIClient.shared
        await client.setToken("test-token-123")

        let request = try await client.buildRequest(path: "/members", method: "GET")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer test-token-123")
        XCTAssertEqual(request.httpMethod, "GET")

        await client.setToken(nil)
    }

    func test_buildRequest_noTokenOmitsHeader() async throws {
        let client = APIClient.shared
        await client.setToken(nil)

        let request = try await client.buildRequest(path: "/members", method: "GET")
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }

    func test_buildRequest_setsContentTypeJSON() async throws {
        let client = APIClient.shared
        let request = try await client.buildRequest(path: "/test", method: "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
    }

    func test_buildRequest_includesQueryParameters() async throws {
        let client = APIClient.shared
        let request = try await client.buildRequest(
            path: "/members",
            method: "GET",
            query: ["role": "admin", "status": "active"]
        )
        let url = request.url!.absoluteString
        XCTAssertTrue(url.contains("role=admin"))
        XCTAssertTrue(url.contains("status=active"))
    }

    func test_buildRequest_encodesBody() async throws {
        struct TestBody: Encodable {
            let firstName: String
            let lastName: String
        }
        let client = APIClient.shared
        let request = try await client.buildRequest(
            path: "/members",
            method: "POST",
            body: TestBody(firstName: "John", lastName: "Doe")
        )
        let bodyData = request.httpBody!
        let bodyString = String(data: bodyData, encoding: .utf8)!
        XCTAssertTrue(bodyString.contains("first_name"))
        XCTAssertTrue(bodyString.contains("last_name"))
    }

    func test_buildRequest_encodesEnumStatusInBody() async throws {
        struct RsvpRequest: Encodable {
            let eventId: String
            let status: RsvpStatus
        }
        let client = APIClient.shared
        let request = try await client.buildRequest(
            path: "/events/rsvp",
            method: "POST",
            body: RsvpRequest(eventId: "evt-1", status: .attending)
        )
        let bodyString = String(data: request.httpBody!, encoding: .utf8)!
        XCTAssertTrue(bodyString.contains("attending"))
    }

    func test_buildRequest_encodesBookingStatusNoShow() async throws {
        struct StatusBody: Encodable {
            let status: BookingStatus
        }
        let client = APIClient.shared
        let request = try await client.buildRequest(
            path: "/bookings/1",
            method: "PATCH",
            body: StatusBody(status: .noShow)
        )
        let bodyString = String(data: request.httpBody!, encoding: .utf8)!
        XCTAssertTrue(bodyString.contains("no_show"))
    }

    // MARK: - APIError descriptions

    func test_apiError_unauthorized_message() {
        let error = APIError.unauthorized
        XCTAssertEqual(error.errorDescription, "Session expired. Please sign in again.")
    }

    func test_apiError_forbidden_customMessage() {
        let error = APIError.forbidden("Not an admin")
        XCTAssertEqual(error.errorDescription, "Not an admin")
    }

    func test_apiError_forbidden_defaultMessage() {
        let error = APIError.forbidden(nil)
        XCTAssertEqual(error.errorDescription, "You don't have permission to do that.")
    }

    func test_apiError_rateLimited_message() {
        let error = APIError.rateLimited
        XCTAssertEqual(error.errorDescription, "Too many requests. Please wait.")
    }

    func test_apiError_httpError_customMessage() {
        let error = APIError.httpError(500, "Internal server error")
        XCTAssertEqual(error.errorDescription, "Internal server error")
    }

    func test_apiError_httpError_fallbackMessage() {
        let error = APIError.httpError(503, nil)
        XCTAssertEqual(error.errorDescription, "Server error (503)")
    }

    func test_apiError_notFound_message() {
        let error = APIError.notFound
        XCTAssertEqual(error.errorDescription, "Not found.")
    }

    func test_apiError_invalidURL_includesPath() {
        let error = APIError.invalidURL("/bad/path")
        XCTAssertTrue(error.errorDescription!.contains("/bad/path"))
    }
}
