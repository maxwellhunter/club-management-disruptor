import SwiftUI

// MARK: - Billing View
//
// Lists the signed-in member's invoices with filter chips and a running
// "outstanding balance" summary. All non-UI logic lives in
// `BillingFormatting` so it can be unit-tested without spinning up SwiftUI.

struct BillingView: View {
    @State private var invoices: [BillingInvoice] = []
    @State private var filter: BillingInvoiceFilter = .all
    @State private var isLoading = true

    var body: some View {
        VStack(spacing: 0) {
            // Outstanding balance summary
            if !isLoading && outstanding > 0 {
                outstandingHeader
            }

            // Filter tabs
            HStack(spacing: 0) {
                ForEach(BillingInvoiceFilter.allCases, id: \.self) { tab in
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
                    .padding(.bottom, 24)
                }
            }
        }
        .background(Color.club.background)
        .navigationTitle("Billing")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadInvoices() }
    }

    // MARK: - Computed

    private var filteredInvoices: [BillingInvoice] {
        BillingFormatting.filter(invoices, by: filter)
    }

    private var outstanding: Double {
        BillingFormatting.outstandingBalance(invoices)
    }

    // MARK: - Subviews

    private var outstandingHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Outstanding balance")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.club.onSurfaceVariant)
            Text(BillingFormatting.currency(outstanding))
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Color.club.foreground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 24)
        .padding(.top, 16)
    }

    private func invoiceRow(_ invoice: BillingInvoice) -> some View {
        let overdue = BillingFormatting.isOverdue(invoice)
        return HStack(spacing: 12) {
            Image(systemName: BillingFormatting.icon(for: invoice.description))
                .font(.system(size: 18))
                .foregroundStyle(Color.club.primary)
                .frame(width: 40, height: 40)
                .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 2) {
                Text(invoice.description)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                    .lineLimit(1)
                Text(BillingFormatting.formattedDueDate(invoice.dueDate))
                    .font(.system(size: 11))
                    .foregroundStyle(overdue ? Color(hex: "dc2626") : Color.club.onSurfaceVariant)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(BillingFormatting.currency(invoice.amount))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                Text(BillingFormatting.statusLabel(invoice.status))
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color(hex: BillingFormatting.statusHex(invoice.status)))
            }
        }
        .padding(14)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Networking

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
}
