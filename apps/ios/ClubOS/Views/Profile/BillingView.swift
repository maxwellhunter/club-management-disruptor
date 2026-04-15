import SwiftUI

// MARK: - Billing View (stub — full implementation in Phase 2)

struct BillingView: View {
    @State private var invoices: [BillingInvoice] = []
    @State private var filter: InvoiceFilter = .all
    @State private var isLoading = true

    enum InvoiceFilter: String, CaseIterable {
        case all = "All"
        case paid = "Paid"
        case outstanding = "Outstanding"
    }

    var body: some View {
        VStack(spacing: 0) {
            // Filter tabs
            HStack(spacing: 0) {
                ForEach(InvoiceFilter.allCases, id: \.self) { tab in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) { filter = tab }
                    } label: {
                        Text(tab.rawValue)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(filter == tab ? Color.club.primaryForeground : Color.club.onSurfaceVariant)
                            .padding(.vertical, 8)
                            .padding(.horizontal, 16)
                            .background(filter == tab ? Color.club.primaryContainer : Color.clear, in: Capsule())
                    }
                }
            }
            .padding(4)
            .background(Color.club.surfaceContainerHigh, in: Capsule())
            .padding(.horizontal, 24)
            .padding(.vertical, 16)

            if isLoading {
                Spacer()
                ProgressView().tint(Color.club.primary)
                Spacer()
            } else if filteredInvoices.isEmpty {
                Spacer()
                VStack(spacing: 12) {
                    Image(systemName: "doc.text")
                        .font(.system(size: 40))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                    Text("No invoices")
                        .font(.clubCaption)
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(filteredInvoices) { invoice in
                            invoiceRow(invoice)
                        }
                    }
                    .padding(.horizontal, 24)
                }
            }
        }
        .background(Color.club.background)
        .navigationTitle("Billing")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadInvoices() }
    }

    private var filteredInvoices: [BillingInvoice] {
        switch filter {
        case .all: return invoices
        case .paid: return invoices.filter { $0.status == "paid" }
        case .outstanding: return invoices.filter { $0.status == "sent" || $0.status == "overdue" }
        }
    }

    private func invoiceRow(_ invoice: BillingInvoice) -> some View {
        HStack(spacing: 12) {
            Image(systemName: iconFor(invoice.description))
                .font(.system(size: 18))
                .foregroundStyle(Color.club.primary)
                .frame(width: 40, height: 40)
                .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 2) {
                Text(invoice.description)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                    .lineLimit(1)
                Text(invoice.dueDate ?? "")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(Formatters.currency(invoice.amount))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                Text(invoice.status.capitalized)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(statusColor(invoice.status))
            }
        }
        .padding(14)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
    }

    private func loadInvoices() async {
        isLoading = true
        defer { isLoading = false }

        struct Response: Decodable { let invoices: [BillingInvoice] }
        do {
            let response: Response = try await APIClient.shared.get("/billing/invoices")
            invoices = response.invoices
        } catch {
            invoices = []
        }
    }

    private func iconFor(_ description: String) -> String {
        let lower = description.lowercased()
        if lower.contains("dining") || lower.contains("restaurant") { return "fork.knife" }
        if lower.contains("golf") || lower.contains("pro shop") { return "figure.golf" }
        if lower.contains("membership") || lower.contains("dues") { return "creditcard" }
        return "doc.text"
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "paid": return Color(hex: "16a34a")
        case "overdue": return Color(hex: "dc2626")
        case "sent": return Color(hex: "d97706")
        default: return Color(hex: "6b7280")
        }
    }
}

private struct BillingInvoice: Decodable, Identifiable {
    let id: UUID
    let amount: Double
    let status: String
    let description: String
    let dueDate: String?
    let createdAt: String?
}
