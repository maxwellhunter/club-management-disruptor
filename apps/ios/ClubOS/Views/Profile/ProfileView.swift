import SwiftUI
import PhotosUI

// MARK: - Response Types

private struct BillingStatusResponse: Decodable {
    let role: String?
    let tierName: String?
    let hasStripeCustomer: Bool?
    let subscription: SubscriptionInfo?
}

private struct SubscriptionInfo: Decodable {
    let status: String?
    let currentPeriodEnd: String?
    let cancelAtPeriodEnd: Bool?
    let amount: Double?
    let tierName: String?
}

private struct InvoicesResponse: Decodable {
    let invoices: [InvoiceItem]
}

private struct InvoiceItem: Decodable, Identifiable {
    let id: UUID
    let amount: Double
    let status: String
    let description: String
    let dueDate: String?
    let createdAt: String?
}

// MARK: - Transaction (display model)

private struct Transaction: Identifiable {
    let id: String
    let icon: String
    let title: String
    let date: String
    let amount: String
    let type: TransactionType
    let status: String?

    enum TransactionType {
        case charge, payment, credit
    }
}

// MARK: - Profile View

struct ProfileView: View {
    @Environment(AuthViewModel.self) private var auth
    @State private var billing: BillingStatusResponse?
    @State private var transactions: [Transaction] = Transaction.mockActivity
    @State private var isLoading = true
    @State private var showSignOutAlert = false
    @State private var actionLoading = false

    // Avatar — URL persisted in UserDefaults via AppCacheService so it's instant on re-nav
    @State private var avatarUrl: String? = {
        // Synchronous read from cache — no flash
        let defaults = UserDefaults.standard
        return defaults.string(forKey: "clubos_cache_avatar_url")
    }()
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var uploadingAvatar = false

    private var fullName: String {
        auth.user?.userMetadata["full_name"]?.stringValue ?? "Member"
    }

    private var initials: String {
        fullName.split(separator: " ")
            .prefix(2)
            .compactMap { $0.first.map { String($0).uppercased() } }
            .joined()
    }

    private var tierName: String {
        billing?.tierName ?? billing?.subscription?.tierName ?? "Member"
    }

    private var sub: SubscriptionInfo? { billing?.subscription }

    private var isAdmin: Bool {
        (billing?.role ?? "").lowercased() == "admin"
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 0) {
                profileHeader
                balanceCard
                if sub != nil { accountDetails }
                membershipCardLink
                if isAdmin { adminToolsSection }
                recentActivity
                accountSettings
                signOutButton
                Spacer(minLength: 32)
            }
        }
        .background(Color.club.background)
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await loadData() }
        .task { await loadData() }
        .alert("Sign Out", isPresented: $showSignOutAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Sign Out", role: .destructive) {
                Task { await auth.signOut() }
            }
        } message: {
            Text("Are you sure you want to sign out?")
        }
    }

    // MARK: - Profile Header

    private var profileHeader: some View {
        VStack(spacing: 0) {
            // Avatar with photo picker
            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                ZStack(alignment: .bottomTrailing) {
                    if uploadingAvatar {
                        Circle()
                            .fill(Color.club.surfaceContainerHigh)
                            .frame(width: 80, height: 80)
                            .overlay { ProgressView().tint(Color.club.primary) }
                    } else if let url = avatarUrl, let imageUrl = URL(string: url) {
                        CachedAsyncImage(url: imageUrl) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: 80, height: 80)
                                    .clipShape(Circle())
                                    .contentShape(Circle())
                            default:
                                avatarInitials
                            }
                        }
                    } else {
                        avatarInitials
                    }

                    // Camera badge
                    Image(systemName: "camera.fill")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 24, height: 24)
                        .background(Color.club.primary, in: Circle())
                        .overlay(Circle().stroke(Color.club.background, lineWidth: 2))
                }
            }
            .onChange(of: selectedPhoto) { _, item in
                guard let item else { return }
                Task { await uploadAvatar(item) }
            }
            .padding(.bottom, 14)

            Text(fullName)
                .font(.custom("Georgia", size: 22).weight(.bold))
                .foregroundStyle(Color.club.foreground)
                .padding(.bottom, 6)

            Text("\(tierName.uppercased()) MEMBER")
                .font(.system(size: 10, weight: .bold))
                .tracking(1)
                .foregroundStyle(Color.club.primaryForeground)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(Color.club.primaryContainer, in: RoundedRectangle(cornerRadius: 8))
        }
        .padding(.top, 20)
        .padding(.bottom, 24)
    }

    // MARK: - Balance Card

    private var balanceCard: some View {
        VStack(spacing: 0) {
            Text("CURRENT STATEMENT BALANCE")
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.5)
                .foregroundStyle(Color.club.accent)
                .padding(.bottom, 6)

            if isLoading {
                ProgressView()
                    .tint(.white)
                    .padding(.vertical, 12)
            } else {
                Text("$\(String(format: "%.2f", sub?.amount ?? 0))")
                    .font(.custom("Georgia", size: 36).weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.bottom, 20)
            }

            HStack(spacing: 10) {
                Button {
                    Task { await handleBillingAction() }
                } label: {
                    Text(sub != nil ? "Pay Statement" : "Set Up Billing")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.club.primary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(.white, in: RoundedRectangle(cornerRadius: 12))
                }
                .disabled(actionLoading)

                NavigationLink {
                    BillingView()
                } label: {
                    Text("Details")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.club.accent.opacity(0.4), lineWidth: 1)
                        )
                }
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 20))
        .shadow(color: Color.club.primary.opacity(0.2), radius: 24, y: 12)
        .padding(.horizontal, 24)
        .padding(.bottom, 20)
    }

    // MARK: - Account Details

    private var accountDetails: some View {
        VStack(spacing: 0) {
            HStack {
                Text("UNBILLED CHARGES")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1)
                    .foregroundStyle(Color.club.outline)
                Spacer()
                HStack(spacing: 4) {
                    Text("$\(String(format: "%.2f", sub?.amount ?? 0))")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)
                    Image(systemName: "info.circle")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }
            }

            Rectangle()
                .fill(Color.club.surfaceContainerLow)
                .frame(height: 1)
                .padding(.vertical, 12)

            HStack {
                Text("NEXT BILLING")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1)
                    .foregroundStyle(Color.club.outline)
                Spacer()
                Text(formatDate(sub?.currentPeriodEnd))
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
            }

            if sub?.cancelAtPeriodEnd == true {
                Rectangle()
                    .fill(Color.club.surfaceContainerLow)
                    .frame(height: 1)
                    .padding(.vertical, 12)

                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 12))
                    Text("Cancels at end of billing period")
                        .font(.system(size: 12, weight: .medium))
                }
                .foregroundStyle(Color(hex: "92400e"))
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(hex: "fffbeb"), in: RoundedRectangle(cornerRadius: 10))
                .padding(.top, 4)
            }
        }
        .padding(18)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.club.foreground.opacity(0.03), radius: 12, y: 4)
        .padding(.horizontal, 24)
        .padding(.bottom, 20)
    }

    // MARK: - Admin Tools

    private var adminToolsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("STAFF TOOLS")
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.2)
                .foregroundStyle(Color.club.onSurfaceVariant)
                .padding(.horizontal, 28)
                .padding(.top, 4)

            NavigationLink {
                AdminHubView()
            } label: {
                HStack(spacing: 14) {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(hex: "1b4332"))
                        .frame(width: 40, height: 40)
                        .overlay {
                            Image(systemName: "qrcode.viewfinder")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(.white)
                        }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Staff Tools")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.club.foreground)
                        Text("Scan a member card, verify guests, more")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }
                .padding(16)
                .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
                .shadow(color: Color.club.foreground.opacity(0.04), radius: 12, y: 4)
                .contentShape(RoundedRectangle(cornerRadius: 16))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 24)
        }
        .padding(.bottom, 24)
    }

    // MARK: - Membership Card Link

    private var membershipCardLink: some View {
        NavigationLink {
            MembershipCardView()
        } label: {
            HStack(spacing: 14) {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.club.primaryContainer)
                    .frame(width: 40, height: 40)
                    .overlay {
                        Image(systemName: "diamond.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(.white)
                    }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Membership Card")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)
                    Text("View your digital member ID & QR code")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }
            .padding(16)
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: Color.club.foreground.opacity(0.04), radius: 12, y: 4)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 24)
    }

    // MARK: - Recent Activity

    private var recentActivity: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Activity")
                    .font(.custom("Georgia", size: 18).weight(.bold))
                    .foregroundStyle(Color.club.foreground)
                Spacer()
                NavigationLink {
                    BillingView()
                } label: {
                    Text("VIEW ALL")
                        .font(.system(size: 11, weight: .semibold))
                        .tracking(0.5)
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }
            }
            .padding(.horizontal, 24)

            VStack(spacing: 0) {
                ForEach(Array(transactions.enumerated()), id: \.element.id) { index, tx in
                    if index > 0 {
                        Rectangle()
                            .fill(Color.club.surfaceContainerLow)
                            .frame(height: 1)
                            .padding(.vertical, 10)
                    }
                    transactionRow(tx)
                }
            }
            .padding(16)
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: Color.club.foreground.opacity(0.03), radius: 12, y: 4)
            .padding(.horizontal, 24)
        }
        .padding(.bottom, 24)
    }

    private func transactionRow(_ tx: Transaction) -> some View {
        HStack(spacing: 12) {
            Image(systemName: tx.icon)
                .font(.system(size: 18))
                .foregroundStyle(Color.club.primary)
                .frame(width: 40, height: 40)
                .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 2) {
                Text(tx.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                    .lineLimit(1)

                HStack(spacing: 8) {
                    Text(tx.date)
                        .font(.system(size: 11))
                        .foregroundStyle(Color.club.onSurfaceVariant)

                    if let status = tx.status {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(statusColor(status))
                                .frame(width: 6, height: 6)
                            Text(status.capitalized)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(statusColor(status))
                        }
                    }
                }
            }

            Spacer()

            Text(tx.amount)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(
                    tx.type == .payment ? Color(hex: "16a34a") :
                    tx.type == .credit ? Color(hex: "6b7280") :
                    Color.club.foreground
                )
        }
    }

    // MARK: - Account Settings

    private var accountSettings: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Account Settings")
                .font(.custom("Georgia", size: 18).weight(.bold))
                .foregroundStyle(Color.club.foreground)
                .padding(.horizontal, 24)

            VStack(spacing: 0) {
                NavigationLink(destination: MembersView()) {
                    HStack(spacing: 14) {
                        Image(systemName: "person.2")
                            .font(.system(size: 18))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                            .frame(width: 36, height: 36)
                            .background(Color.club.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 10))

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Members Directory")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color.club.foreground)
                            Text("Search and browse club members")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.club.onSurfaceVariant)
                        }

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.club.outlineVariant)
                    }
                    .padding(14)
                }
                settingsDivider
                NavigationLink(destination: PersonalInfoView()) {
                    settingsRow(icon: "person", title: "Personal Information", subtitle: "Name, email, phone number")
                }
                settingsDivider
                NavigationLink(destination: NotificationsView()) {
                    settingsRow(icon: "bell", title: "Notification Preferences", subtitle: "Push notifications, emails and alerts")
                }
                settingsDivider
                NavigationLink(destination: SecurityView()) {
                    settingsRow(icon: "checkmark.shield", title: "Security & Privacy", subtitle: "Password, 2FA, data preferences")
                }
            }
            .padding(4)
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: Color.club.foreground.opacity(0.03), radius: 12, y: 4)
            .padding(.horizontal, 24)
        }
        .padding(.bottom, 24)
    }

    private func settingsRow(icon: String, title: String, subtitle: String) -> some View {
        // TODO: Wire NavigationLinks to settings screens
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .frame(width: 36, height: 36)
                .background(Color.club.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 14))
                .foregroundStyle(Color.club.outlineVariant)
        }
        .padding(14)
    }

    private var settingsDivider: some View {
        Rectangle()
            .fill(Color.club.surfaceContainerLow)
            .frame(height: 1)
            .padding(.horizontal, 14)
    }

    // MARK: - Sign Out

    private var signOutButton: some View {
        Button {
            showSignOutAlert = true
        } label: {
            Text("Sign Out of ClubOS")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.club.destructive)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.club.destructive.opacity(0.25), lineWidth: 1)
                )
        }
        .padding(.horizontal, 24)
    }

    // MARK: - Avatar Initials

    private var avatarInitials: some View {
        Circle()
            .fill(Color.club.primaryContainer)
            .frame(width: 80, height: 80)
            .overlay {
                Text(initials)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(.white)
            }
    }

    // MARK: - Avatar Upload

    private func uploadAvatar(_ item: PhotosPickerItem) async {
        uploadingAvatar = true
        defer { uploadingAvatar = false }

        do {
            guard let data = try await item.loadTransferable(type: Data.self),
                  let original = UIImage(data: data) else { return }

            // Resize to 800×800 max and compress to JPEG on-device
            // (keeps upload under Vercel's 4.5MB limit; server further crops to 400×400)
            let maxDim: CGFloat = 800
            let scale = min(maxDim / original.size.width, maxDim / original.size.height, 1.0)
            let newSize = CGSize(width: original.size.width * scale, height: original.size.height * scale)

            let resized = UIGraphicsImageRenderer(size: newSize).image { _ in
                original.draw(in: CGRect(origin: .zero, size: newSize))
            }

            guard let jpegData = resized.jpegData(compressionQuality: 0.8) else { return }

            struct AvatarResponse: Decodable {
                let url: String
                let size: Int
                let originalSize: Int
            }

            let response: AvatarResponse = try await APIClient.shared.uploadMultipart(
                "/upload/avatar",
                fileData: jpegData,
                fileName: "avatar.jpg",
                mimeType: "image/jpeg"
            )

            await MainActor.run {
                avatarUrl = response.url
                UserDefaults.standard.set(response.url, forKey: "clubos_cache_avatar_url")
            }
        } catch {
            print("Avatar upload failed: \(error)")
        }
    }

    // MARK: - Data Loading

    private func loadData() async {
        isLoading = true
        defer { isLoading = false }

        async let billingTask: BillingStatusResponse? = try? await APIClient.shared.get("/billing/status")
        async let invoicesTask: InvoicesResponse? = try? await APIClient.shared.get("/billing/invoices")
        async let avatarTask: Void = fetchAvatar()

        let (billingResult, invoicesResult, _) = await (billingTask, invoicesTask, avatarTask)
        billing = billingResult

        if let invoices = invoicesResult?.invoices, !invoices.isEmpty {
            transactions = invoices.prefix(10).map { invoice in
                Transaction(
                    id: invoice.id.uuidString,
                    icon: iconForDescription(invoice.description),
                    title: invoice.description,
                    date: formatDate(invoice.dueDate ?? invoice.createdAt),
                    amount: "-$\(String(format: "%.2f", invoice.amount))",
                    type: invoice.status == "paid" ? .payment : invoice.status == "void" ? .credit : .charge,
                    status: invoice.status
                )
            }
        }
    }

    private func fetchAvatar() async {
        struct MemberItem: Decodable {
            let id: String
            let email: String?
            let avatarUrl: String?
        }
        struct MembersResponse: Decodable {
            let members: [MemberItem]
        }

        do {
            let response: MembersResponse = try await APIClient.shared.get("/members")
            let userEmail = auth.user?.email
            if let me = response.members.first(where: { $0.email == userEmail }) {
                await MainActor.run {
                    if let url = me.avatarUrl {
                        avatarUrl = url
                        UserDefaults.standard.set(url, forKey: "clubos_cache_avatar_url")
                    }
                }
            }
        } catch {
            // Non-critical — avatar just won't show
        }
    }

    private func handleBillingAction() async {
        actionLoading = true
        defer { actionLoading = false }

        let endpoint = sub != nil ? "/billing/portal" : "/billing/setup"
        let key = sub != nil ? "portalUrl" : "checkoutUrl"

        do {
            let (data, response) = try await APIClient.shared.getData(endpoint)
            guard response.statusCode == 200,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let urlString = json[key] as? String,
                  let url = URL(string: urlString) else { return }
            await UIApplication.shared.open(url)
        } catch {
            // Billing portal/setup not available
        }
    }

    // MARK: - Helpers

    private func iconForDescription(_ description: String) -> String {
        let lower = description.lowercased()
        if lower.contains("dining") || lower.contains("restaurant") || lower.contains("food") { return "fork.knife" }
        if lower.contains("golf") || lower.contains("pro shop") { return "figure.golf" }
        if lower.contains("membership") || lower.contains("dues") { return "creditcard" }
        return "doc.text"
    }

    private func formatDate(_ dateStr: String?) -> String {
        DateUtilities.longDateString(dateStr)
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "paid": return Color(hex: "16a34a")
        case "overdue": return Color(hex: "dc2626")
        case "sent": return Color(hex: "d97706")
        case "draft": return Color(hex: "6b7280")
        case "void": return Color(hex: "9ca3af")
        default: return Color(hex: "6b7280")
        }
    }
}

// MARK: - Mock Data

private extension Transaction {
    static let mockActivity: [Transaction] = [
        Transaction(id: "1", icon: "fork.knife", title: "The Conservatory Dining", date: "Mar 15, 2026 • 7:30 PM", amount: "-$362.50", type: .charge, status: nil),
        Transaction(id: "2", icon: "figure.golf", title: "Golf Pro Shop Purchase", date: "Mar 12, 2026 • 11:15 AM", amount: "-$1,280.00", type: .charge, status: nil),
        Transaction(id: "3", icon: "creditcard", title: "Annual Membership Fee", date: "Mar 1, 2026", amount: "-$2,500.00", type: .charge, status: nil),
    ]
}
