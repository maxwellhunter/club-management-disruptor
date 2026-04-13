import XCTest
@testable import ClubOS

final class BillingFormattingTests: XCTestCase {

    // MARK: - Fixtures

    private func makeInvoice(
        amount: Double = 100,
        status: String = "sent",
        description: String = "Membership Dues",
        dueDate: String? = "2026-05-01"
    ) -> BillingInvoice {
        BillingInvoice(
            id: UUID(),
            amount: amount,
            status: status,
            description: description,
            dueDate: dueDate,
            createdAt: nil
        )
    }

    // MARK: - filter

    func test_filter_all_returnsEverything() {
        let invoices = [
            makeInvoice(status: "paid"),
            makeInvoice(status: "sent"),
            makeInvoice(status: "overdue"),
            makeInvoice(status: "draft"),
        ]
        XCTAssertEqual(BillingFormatting.filter(invoices, by: .all).count, 4)
    }

    func test_filter_paid_returnsOnlyPaid() {
        let invoices = [
            makeInvoice(status: "paid"),
            makeInvoice(status: "sent"),
            makeInvoice(status: "PAID"), // case-insensitive
        ]
        let result = BillingFormatting.filter(invoices, by: .paid)
        XCTAssertEqual(result.count, 2)
        XCTAssertTrue(result.allSatisfy { $0.status.lowercased() == "paid" })
    }

    func test_filter_outstanding_includesSentAndOverdueButNotPaidOrDraft() {
        let invoices = [
            makeInvoice(status: "paid"),
            makeInvoice(status: "sent"),
            makeInvoice(status: "overdue"),
            makeInvoice(status: "draft"),
            makeInvoice(status: "void"),
        ]
        let result = BillingFormatting.filter(invoices, by: .outstanding)
        let statuses = Set(result.map { $0.status })
        XCTAssertEqual(statuses, ["sent", "overdue"])
    }

    func test_filter_emptyInput_returnsEmpty() {
        XCTAssertTrue(BillingFormatting.filter([], by: .all).isEmpty)
        XCTAssertTrue(BillingFormatting.filter([], by: .paid).isEmpty)
        XCTAssertTrue(BillingFormatting.filter([], by: .outstanding).isEmpty)
    }

    // MARK: - icon

    func test_icon_diningKeywords() {
        XCTAssertEqual(BillingFormatting.icon(for: "Dining: Main Restaurant"), "fork.knife")
        XCTAssertEqual(BillingFormatting.icon(for: "Grill Room tab"), "fork.knife")
        XCTAssertEqual(BillingFormatting.icon(for: "Bar tab April"), "fork.knife")
    }

    func test_icon_golfKeywords() {
        XCTAssertEqual(BillingFormatting.icon(for: "Pro Shop purchase"), "figure.golf")
        XCTAssertEqual(BillingFormatting.icon(for: "Tee time April 12"), "figure.golf")
        XCTAssertEqual(BillingFormatting.icon(for: "Golf cart rental"), "figure.golf")
    }

    func test_icon_membershipKeywords() {
        XCTAssertEqual(BillingFormatting.icon(for: "Monthly membership dues"), "creditcard")
        XCTAssertEqual(BillingFormatting.icon(for: "Capital assessment Q2"), "creditcard")
    }

    func test_icon_eventKeyword() {
        XCTAssertEqual(BillingFormatting.icon(for: "Event ticket: Spring Gala"), "calendar")
    }

    func test_icon_guestKeyword() {
        XCTAssertEqual(BillingFormatting.icon(for: "Guest fee — John Smith"), "person.2")
    }

    func test_icon_unknownDescription_returnsDefault() {
        XCTAssertEqual(BillingFormatting.icon(for: "Miscellaneous charge"), "doc.text")
    }

    func test_icon_isCaseInsensitive() {
        XCTAssertEqual(BillingFormatting.icon(for: "DINING"), "fork.knife")
        XCTAssertEqual(BillingFormatting.icon(for: "golf"), "figure.golf")
    }

    // MARK: - statusHex

    func test_statusHex_knownStatuses() {
        XCTAssertEqual(BillingFormatting.statusHex("paid"), "16a34a")
        XCTAssertEqual(BillingFormatting.statusHex("overdue"), "dc2626")
        XCTAssertEqual(BillingFormatting.statusHex("sent"), "d97706")
        XCTAssertEqual(BillingFormatting.statusHex("draft"), "6b7280")
    }

    func test_statusHex_isCaseInsensitive() {
        XCTAssertEqual(BillingFormatting.statusHex("PAID"), "16a34a")
        XCTAssertEqual(BillingFormatting.statusHex("Overdue"), "dc2626")
    }

    func test_statusHex_handlesCancelledSpellings() {
        XCTAssertEqual(BillingFormatting.statusHex("cancelled"), "9ca3af")
        XCTAssertEqual(BillingFormatting.statusHex("canceled"), "9ca3af")
        XCTAssertEqual(BillingFormatting.statusHex("void"), "9ca3af")
    }

    func test_statusHex_unknownStatus_fallsBackToGray() {
        XCTAssertEqual(BillingFormatting.statusHex("foobar"), "6b7280")
    }

    // MARK: - statusLabel

    func test_statusLabel_knownStatuses() {
        XCTAssertEqual(BillingFormatting.statusLabel("paid"), "Paid")
        XCTAssertEqual(BillingFormatting.statusLabel("overdue"), "Overdue")
        XCTAssertEqual(BillingFormatting.statusLabel("sent"), "Due")
        XCTAssertEqual(BillingFormatting.statusLabel("draft"), "Draft")
    }

    func test_statusLabel_unknown_capitalizesRaw() {
        XCTAssertEqual(BillingFormatting.statusLabel("partially_paid"), "Partially_Paid")
    }

    // MARK: - currency

    func test_currency_formatsUSDWithGroupingSeparator() {
        let result = BillingFormatting.currency(1234.5)
        XCTAssertEqual(result, "$1,234.50")
    }

    func test_currency_formatsZero() {
        XCTAssertEqual(BillingFormatting.currency(0), "$0.00")
    }

    func test_currency_formatsLargeAmount() {
        XCTAssertEqual(BillingFormatting.currency(1_000_000), "$1,000,000.00")
    }

    func test_currency_roundsToCents() {
        // Rounding behavior of NumberFormatter for currency is half-even.
        XCTAssertEqual(BillingFormatting.currency(99.999), "$100.00")
    }

    // MARK: - formattedDueDate

    func test_formattedDueDate_formatsAPIDate() {
        XCTAssertEqual(BillingFormatting.formattedDueDate("2026-05-01"), "May 1, 2026")
        XCTAssertEqual(BillingFormatting.formattedDueDate("2026-12-31"), "Dec 31, 2026")
    }

    func test_formattedDueDate_handlesISO8601() {
        let result = BillingFormatting.formattedDueDate("2026-05-01T12:00:00Z")
        XCTAssertEqual(result, "May 1, 2026")
    }

    func test_formattedDueDate_nilOrEmpty_returnsEmpty() {
        XCTAssertEqual(BillingFormatting.formattedDueDate(nil), "")
        XCTAssertEqual(BillingFormatting.formattedDueDate(""), "")
    }

    func test_formattedDueDate_unparseable_returnsRaw() {
        XCTAssertEqual(BillingFormatting.formattedDueDate("not a date"), "not a date")
    }

    // MARK: - daysUntilDue

    func test_daysUntilDue_futureDate_returnsPositive() {
        let now = makeUTCDate("2026-04-13")
        XCTAssertEqual(BillingFormatting.daysUntilDue("2026-04-20", now: now), 7)
    }

    func test_daysUntilDue_pastDate_returnsNegative() {
        let now = makeUTCDate("2026-04-13")
        XCTAssertEqual(BillingFormatting.daysUntilDue("2026-04-10", now: now), -3)
    }

    func test_daysUntilDue_sameDay_returnsZero() {
        let now = makeUTCDate("2026-04-13")
        XCTAssertEqual(BillingFormatting.daysUntilDue("2026-04-13", now: now), 0)
    }

    func test_daysUntilDue_nilOrInvalid_returnsNil() {
        XCTAssertNil(BillingFormatting.daysUntilDue(nil))
        XCTAssertNil(BillingFormatting.daysUntilDue("garbage"))
    }

    // MARK: - isOverdue

    func test_isOverdue_paidInvoice_isNeverOverdue() {
        let inv = makeInvoice(status: "paid", dueDate: "2020-01-01")
        XCTAssertFalse(BillingFormatting.isOverdue(inv))
    }

    func test_isOverdue_serverSaysOverdue_isOverdue() {
        let inv = makeInvoice(status: "overdue", dueDate: "2099-01-01")
        XCTAssertTrue(BillingFormatting.isOverdue(inv))
    }

    func test_isOverdue_sentAndPastDue_isOverdue() {
        let now = makeUTCDate("2026-04-13")
        let inv = makeInvoice(status: "sent", dueDate: "2026-04-01")
        XCTAssertTrue(BillingFormatting.isOverdue(inv, now: now))
    }

    func test_isOverdue_sentAndFutureDue_isNotOverdue() {
        let now = makeUTCDate("2026-04-13")
        let inv = makeInvoice(status: "sent", dueDate: "2026-05-01")
        XCTAssertFalse(BillingFormatting.isOverdue(inv, now: now))
    }

    func test_isOverdue_missingDueDate_isNotOverdue() {
        let inv = makeInvoice(status: "sent", dueDate: nil)
        XCTAssertFalse(BillingFormatting.isOverdue(inv))
    }

    // MARK: - outstandingBalance

    func test_outstandingBalance_sumsSentAndOverdueOnly() {
        let invoices = [
            makeInvoice(amount: 100, status: "paid"),
            makeInvoice(amount: 250, status: "sent"),
            makeInvoice(amount: 75.5, status: "overdue"),
            makeInvoice(amount: 999, status: "draft"),
        ]
        XCTAssertEqual(BillingFormatting.outstandingBalance(invoices), 325.5, accuracy: 0.0001)
    }

    func test_outstandingBalance_emptyList_isZero() {
        XCTAssertEqual(BillingFormatting.outstandingBalance([]), 0)
    }

    func test_outstandingBalance_allPaid_isZero() {
        let invoices = [makeInvoice(status: "paid"), makeInvoice(status: "paid")]
        XCTAssertEqual(BillingFormatting.outstandingBalance(invoices), 0)
    }

    // MARK: - Decoding

    func test_billingInvoice_decodesFromAPIShape() throws {
        let json = """
        {
          "id": "11111111-2222-3333-4444-555555555555",
          "amount": 250.5,
          "status": "sent",
          "description": "Monthly Dues",
          "due_date": "2026-05-01",
          "created_at": "2026-04-01T00:00:00Z"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let invoice = try decoder.decode(BillingInvoice.self, from: json)

        XCTAssertEqual(invoice.amount, 250.5)
        XCTAssertEqual(invoice.status, "sent")
        XCTAssertEqual(invoice.description, "Monthly Dues")
        XCTAssertEqual(invoice.dueDate, "2026-05-01")
    }

    // MARK: - Helpers

    private func makeUTCDate(_ ymd: String) -> Date {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(secondsFromGMT: 0)
        return f.date(from: ymd)!
    }
}
