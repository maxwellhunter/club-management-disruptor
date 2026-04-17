import SwiftUI

// MARK: - Unified Upcoming Item

private enum UpcomingItemKind {
    case teeTime, dining, event
}

private struct UpcomingItem: Identifiable {
    let id: String
    let kind: UpcomingItemKind
    let title: String
    let subtitle: String
    let date: Date          // used for sorting
    let dateLabel: String
    let timeLabel: String
    let icon: String
    let iconColor: Color
    let imageUrl: String?
    let eventRef: ClubEvent?  // for sheet presentation
}

// MARK: - Home Booking Model

private struct HomeBooking: Decodable {
    let id: String
    let date: String
    let startTime: String
    let endTime: String?
    let partySize: Int
    let status: String
    let facilityName: String?
    let facilityType: String?
    let facilityImageUrl: String?
}

private struct HomeBookingsResponse: Decodable {
    let bookings: [HomeBooking]
}

// MARK: - Home Invoice Model (for balance-due status strip)
//
// We only need a couple of fields to sum outstanding balance from the
// shared `/billing/invoices` endpoint — the full BillingInvoice shape
// lives in BillingView and is file-private there, so we use a minimal
// local shape here.
private struct HomeInvoice: Decodable {
    let amount: Double
    let status: String
    let dueDate: String?
}

private struct HomeInvoicesResponse: Decodable {
    let invoices: [HomeInvoice]
}

// MARK: - Home Notification Models

struct HomeNotification: Decodable, Identifiable {
    let id: String
    let category: String
    let title: String
    let body: String?
    let readAt: String?
    let createdAt: String?
}

private struct HomeNotificationsResponse: Decodable {
    let notifications: [HomeNotification]
    let unreadCount: Int
}

// MARK: - Home Spending Tracker Models

struct HomeSpendingTracker: Decodable, Identifiable {
    let minimumId: String
    let name: String
    let category: String
    let period: String
    let periodEnd: String
    let amountSpent: Double
    let amountRequired: Double
    let shortfall: Double

    var id: String { minimumId }
    var progress: Double {
        guard amountRequired > 0 else { return 1 }
        return min(1.0, amountSpent / amountRequired)
    }
}

private struct HomeSpendingResponse: Decodable {
    let trackers: [HomeSpendingTracker]
}

struct HomeView: View {
    // Bound from ContentView so the Concierge Services cards can switch to
    // the right tab. Home-owned destinations (e.g. Billing, which doesn't
    // have its own tab) are pushed via the NavigationStack that wraps this
    // view instead of switching tabs.
    @Binding var selectedTab: Int
    @State private var showBilling = false

    @Environment(AuthViewModel.self) private var auth
    @State private var announcements: [Announcement] = []
    @State private var events: [ClubEvent] = []
    @State private var upcomingItems: [UpcomingItem] = []
    @State private var outstandingBalance: Double = 0
    @State private var nextDueDate: Date? = nil
    @State private var spendingTrackers: [HomeSpendingTracker] = []
    @State private var notifications: [HomeNotification] = []
    @State private var unreadCount: Int = 0
    @State private var showNotifications = false
    @State private var isLoading = true
    // Tracks whether we've completed at least one fetch. Pull-to-refresh
    // sets `isLoading = true` again, but we don't want to ghost the screen
    // a second time — `.refreshable` already shows its own system spinner,
    // and replacing real content with skeletons mid-refresh feels jarring.
    // Skeletons should only appear on the very first load.
    @State private var hasLoadedOnce = false

    // Avatar — seed synchronously from the UserDefaults cache so there's
    // no flash on launch. Also refreshed from `/members` on every load
    // (see `fetchAvatar`) so first-time users who haven't opened Profile
    // yet still see their avatar here.
    @State private var avatarUrl: String? = UserDefaults.standard.string(forKey: "clubos_cache_avatar_url")

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 0..<12: return "Good Morning"
        case 12..<17: return "Good Afternoon"
        default: return "Good Evening"
        }
    }

    private var userName: String {
        auth.user?.userMetadata["full_name"]?.stringValue ?? "Member"
    }

    private var initials: String {
        userName.split(separator: " ")
            .prefix(2)
            .compactMap { $0.first.map { String($0).uppercased() } }
            .joined()
    }

    private var homeInitialsCircle: some View {
        Circle()
            .fill(Color.club.surfaceContainerHigh)
            .frame(width: 40, height: 40)
            .overlay {
                Text(initials)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }
            .overlay(Circle().stroke(Color.club.outlineVariant.opacity(0.5), lineWidth: 1.5))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {

                // MARK: - Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 8) {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.club.primary)
                                .frame(width: 32, height: 32)
                                .overlay {
                                    Image(systemName: "diamond.fill")
                                        .font(.system(size: 12))
                                        .foregroundStyle(.white)
                                }
                            Text("CLUB OS")
                                .font(.system(size: 11, weight: .semibold))
                                .tracking(3)
                                .foregroundStyle(Color.club.onSurfaceVariant)
                        }
                        Text("\(greeting), \(userName.components(separatedBy: " ").first ?? "Member")")
                            .font(.clubTitle2)
                            .foregroundStyle(Color.club.foreground)
                    }
                    Spacer()

                    // Notifications bell — badge shows unread count.
                    // Tap opens the in-app notifications inbox sheet
                    // which marks everything read on dismiss.
                    Button { showNotifications = true } label: {
                        ZStack(alignment: .topTrailing) {
                            Circle()
                                .fill(Color.club.surfaceContainerHigh)
                                .frame(width: 40, height: 40)
                                .overlay {
                                    Image(systemName: "bell.fill")
                                        .font(.system(size: 15))
                                        .foregroundStyle(Color.club.onSurfaceVariant)
                                }
                                .overlay(Circle().stroke(Color.club.outlineVariant.opacity(0.5), lineWidth: 1.5))

                            if unreadCount > 0 {
                                Text(unreadCount > 9 ? "9+" : "\(unreadCount)")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 5)
                                    .frame(minWidth: 16, minHeight: 16)
                                    .background(Color(hex: "dc2626"), in: Capsule())
                                    .overlay(Capsule().stroke(Color.club.background, lineWidth: 2))
                                    .offset(x: 4, y: -4)
                            }
                        }
                    }
                    .buttonStyle(.plain)

                    NavigationLink {
                        ProfileView()
                    } label: {
                        if let url = avatarUrl, let imageUrl = URL(string: url) {
                            CachedAsyncImage(url: imageUrl) { phase in
                                switch phase {
                                case .success(let image):
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                        .frame(width: 40, height: 40)
                                        .clipShape(Circle())
                                        .contentShape(Circle())
                                default:
                                    homeInitialsCircle
                                }
                            }
                        } else {
                            homeInitialsCircle
                        }
                    }
                }
                .padding(.trailing, 0)

                // MARK: - Status Strip
                //
                // Conditionally-shown strip for account-affecting info:
                // outstanding balance and active spending-minimum
                // progress. Surface matters because the #1 complaint
                // against legacy club software is surprise charges.
                if outstandingBalance > 0 || !spendingTrackers.isEmpty {
                    VStack(spacing: 8) {
                        if outstandingBalance > 0 {
                            balanceDueStrip
                        }
                        ForEach(spendingTrackers) { tracker in
                            spendingProgressRow(tracker)
                        }
                    }
                }

                // MARK: - Membership Card quick-access
                //
                // Highest-frequency physical touchpoint at the club
                // (front desk, pro shop, gate). Entry point into the
                // full MembershipCardView with Apple/Google Wallet +
                // barcode.
                membershipCardQuickAccess

                // MARK: - Upcoming
                //
                // While loading, render skeleton rows that have the same
                // shape as the real `upcomingRowLink`. SwiftUI's
                // `.redacted(reason: .placeholder)` ghosts the text + icon
                // content into the system's native shimmer-style placeholder
                // — the same effect Apple uses in Stocks/Health/Fitness.
                // The real layout structure stays intact so when the data
                // arrives there's no jarring pop-in.
                if isLoading && !hasLoadedOnce {
                    skeletonSection(title: "Upcoming", rowCount: 3)
                } else if !upcomingItems.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Upcoming")
                            .font(.clubTitle2)
                            .foregroundStyle(Color.club.foreground)

                        VStack(spacing: 8) {
                            ForEach(upcomingItems.prefix(6)) { item in
                                upcomingRowLink(item)
                            }
                        }
                    }
                }

                // MARK: - Concierge Services (quick actions)
                VStack(alignment: .leading, spacing: 12) {
                    Text("Quick Actions")
                        .font(.clubTitle2)
                        .foregroundStyle(Color.club.foreground)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            // The four tab-destined cards just mutate the
                            // shared selectedTab binding. The Billing card
                            // has no tab of its own, so it pushes onto the
                            // Home NavigationStack via navigationDestination
                            // below.
                            ServiceCard(icon: "message.fill", title: "AI Concierge", color: Color.club.primaryContainer) {
                                selectedTab = 4
                            }
                            ServiceCard(icon: "figure.golf", title: "Tee Times", color: Color(hex: "1b4332")) {
                                selectedTab = 1
                            }
                            ServiceCard(icon: "fork.knife", title: "Dining", color: Color(hex: "342300")) {
                                selectedTab = 2
                            }
                            ServiceCard(icon: "calendar", title: "Events", color: Color.club.secondary) {
                                selectedTab = 3
                            }
                            ServiceCard(icon: "creditcard", title: "Billing", color: Color(hex: "4f3800")) {
                                showBilling = true
                            }
                        }
                    }
                }

                // MARK: - Announcements
                if isLoading && !hasLoadedOnce {
                    skeletonSection(title: "Announcements", rowCount: 2)
                } else if !announcements.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Announcements")
                                .font(.clubTitle2)
                                .foregroundStyle(Color.club.foreground)
                            Spacer()
                            NavigationLink {
                                AnnouncementsView()
                            } label: {
                                Text("VIEW ALL")
                                    .font(.system(size: 11, weight: .semibold))
                                    .tracking(0.5)
                                    .foregroundStyle(Color.club.onSurfaceVariant)
                            }
                        }

                        ForEach(announcements.prefix(3)) { announcement in
                            NavigationLink {
                                AnnouncementsView()
                            } label: {
                                AnnouncementRow(announcement: announcement)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                // MARK: - Club News & Events (non-upcoming / past context)
                let nonUpcomingEvents = events.prefix(3).filter { event in
                    !upcomingItems.contains(where: { $0.id == "event-\(event.id)" })
                }
                if (hasLoadedOnce || !isLoading), !nonUpcomingEvents.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Club News & Events")
                            .font(.clubTitle2)
                            .foregroundStyle(Color.club.foreground)

                        ForEach(nonUpcomingEvents) { event in
                            EventRow(event: event)
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
        .background(Color.club.background)
        .refreshable { await loadData() }
        .task { await loadData() }
        // Smooth crossfade between skeleton and real rows so the redacted
        // placeholders melt into real content rather than popping in.
        .animation(.easeInOut(duration: 0.25), value: isLoading)
        .navigationDestination(isPresented: $showBilling) {
            BillingView()
        }
        .sheet(isPresented: $showNotifications, onDismiss: {
            // Mark everything read on dismiss — reflects the standard
            // iOS inbox pattern (Mail, Messages). Do it optimistically
            // so the badge clears immediately.
            Task { await markAllNotificationsRead() }
        }) {
            NotificationsInboxSheet(notifications: notifications)
        }
    }

    // Skeleton loader using SwiftUI's native `.redacted(reason: .placeholder)`.
    //
    // We render a section header + N rows whose visual structure mirrors the
    // real `upcomingRowLink` / `AnnouncementRow` (icon tile + 2 text lines),
    // then ghost the whole thing with `.redacted(.placeholder)`. The system
    // applies its built-in shimmer-style placeholder treatment — same as
    // Apple's first-party apps.
    //
    // `.allowsHitTesting(false)` prevents accidental taps on the ghosted UI
    // before real data arrives.
    private func skeletonSection(title: String, rowCount: Int) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.clubTitle2)
                .foregroundStyle(Color.club.foreground)

            ForEach(0..<rowCount, id: \.self) { _ in
                HStack(spacing: 12) {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.club.surfaceContainerHigh)
                        .frame(width: 48, height: 48)

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Placeholder headline text")
                            .font(.system(size: 14, weight: .semibold))
                        Text("Subtitle line for placeholder row")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                    Spacer()
                }
            }
        }
        .redacted(reason: .placeholder)
        .allowsHitTesting(false)
    }

    private func loadData() async {
        isLoading = true
        defer {
            isLoading = false
            hasLoadedOnce = true
        }

        async let announcementsTask: AnnouncementsResponse? = try? await APIClient.shared.get("/announcements")
        async let eventsTask: EventsResponse? = try? await APIClient.shared.get("/events")
        async let bookingsTask: HomeBookingsResponse? = try? await APIClient.shared.get("/bookings/my")
        async let invoicesTask: HomeInvoicesResponse? = try? await APIClient.shared.get("/billing/invoices")
        async let notificationsTask: HomeNotificationsResponse? = try? await APIClient.shared.get("/notifications/mine")
        async let spendingTask: HomeSpendingResponse? = try? await APIClient.shared.get("/billing/spending/mine")
        // Fetched in parallel alongside the feed data. Non-critical —
        // failures just leave the existing avatar (cached or initials)
        // in place.
        async let avatarTask: Void = fetchAvatar()

        let (announcementsResult, eventsResult, bookingsResult, invoicesResult, notificationsResult, spendingResult, _) =
            await (announcementsTask, eventsTask, bookingsTask, invoicesTask, notificationsTask, spendingTask, avatarTask)

        if let n = notificationsResult {
            notifications = n.notifications
            unreadCount = n.unreadCount
        }

        if let s = spendingResult {
            spendingTrackers = s.trackers
        }

        // Compute outstanding balance from unpaid invoices.
        if let invoices = invoicesResult?.invoices {
            let unpaid = invoices.filter { $0.status == "sent" || $0.status == "overdue" }
            outstandingBalance = unpaid.reduce(0) { $0 + $1.amount }
            nextDueDate = unpaid
                .compactMap { parseDueDate($0.dueDate) }
                .min()
        }

        // Only overwrite state on success — `try?` returns nil when a
        // request fails (expired token, network blip, etc.), and falling
        // back to `?? []` would wipe the screen on a transient refresh
        // failure. Keeping cached data on failure is the standard iOS
        // refresh pattern (Mail, Twitter, etc. behave the same way).
        if let r = announcementsResult { announcements = r.announcements }
        if let r = eventsResult { events = r.events }

        // Only rebuild `upcomingItems` if we have at least one successful
        // source (bookings or events). If both fail, preserve the existing
        // list rather than blanking the section.
        guard bookingsResult != nil || eventsResult != nil else { return }

        // Build unified upcoming list
        var items: [UpcomingItem] = []

        // Bookings → tee times + dining reservations
        for b in bookingsResult?.bookings ?? [] {
            let isGolf = b.facilityType == "golf"
            let kind: UpcomingItemKind = isGolf ? .teeTime : .dining
            let icon = isGolf ? "figure.golf" : "fork.knife"
            let iconColor = isGolf ? Color(hex: "16a34a") : Color(hex: "ea580c")

            if let date = parseBookingDate(b.date, time: b.startTime) {
                items.append(UpcomingItem(
                    id: "booking-\(b.id)",
                    kind: kind,
                    title: b.facilityName ?? (isGolf ? "Tee Time" : "Dining"),
                    subtitle: "Party of \(b.partySize)",
                    date: date,
                    dateLabel: formatUpcomingDate(date),
                    timeLabel: formatTime(b.startTime),
                    icon: icon,
                    iconColor: iconColor,
                    imageUrl: b.facilityImageUrl,
                    eventRef: nil
                ))
            }
        }

        // Events
        for e in events {
            if let date = parseEventDate(e.startDate) {
                // Only include future events
                guard date > Date().addingTimeInterval(-3600) else { continue }
                items.append(UpcomingItem(
                    id: "event-\(e.id)",
                    kind: .event,
                    title: e.title,
                    subtitle: e.location ?? "TBD",
                    date: date,
                    dateLabel: formatUpcomingDate(date),
                    timeLabel: formatEventTime(e.startDate),
                    icon: "calendar",
                    iconColor: Color(hex: "7c3aed"),
                    imageUrl: e.imageUrl,
                    eventRef: e
                ))
            }
        }

        upcomingItems = items.sorted { $0.date < $1.date }
    }

    // MARK: - Avatar fetch
    //
    // Mirrors ProfileView.fetchAvatar — queries `/members`, finds the
    // current user by email, caches the URL to UserDefaults. Runs on
    // every `loadData` (first launch + pull-to-refresh) so the Home
    // screen avatar stays in sync whether or not the user has visited
    // Profile in this session.
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
            guard let userEmail = auth.user?.email,
                  let me = response.members.first(where: { $0.email == userEmail }),
                  let url = me.avatarUrl
            else { return }

            await MainActor.run {
                avatarUrl = url
                UserDefaults.standard.set(url, forKey: "clubos_cache_avatar_url")
            }
        } catch {
            // Non-critical — keep whatever avatar (cached or initials) we
            // were showing before.
        }
    }

    // MARK: - Balance Due Strip

    private var balanceDueStrip: some View {
        Button { showBilling = true } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color(hex: "fef3c7"))
                        .frame(width: 40, height: 40)
                    Image(systemName: "creditcard.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(Color(hex: "b45309"))
                }

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text("Balance Due")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                        Text(formatCurrency(outstandingBalance))
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Color.club.foreground)
                    }
                    if let due = nextDueDate {
                        Text("Due \(formatDueDate(due))")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                }

                Spacer(minLength: 8)

                Text("View")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.club.primary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.outlineVariant)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.club.surfaceContainerLowest)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color(hex: "f59e0b").opacity(0.25), lineWidth: 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Spending Progress Row

    private func spendingProgressRow(_ tracker: HomeSpendingTracker) -> some View {
        let pct = tracker.progress
        let onTrack = pct >= 1.0
        let accent: Color = onTrack ? Color(hex: "16a34a") : Color(hex: "2563eb")

        return Button { showBilling = true } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(accent.opacity(0.12))
                        .frame(width: 40, height: 40)
                    Image(systemName: iconForSpendingCategory(tracker.category))
                        .font(.system(size: 16))
                        .foregroundStyle(accent)
                }

                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Text(tracker.name)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.club.foreground)
                        Spacer(minLength: 4)
                        Text("\(formatCurrency(tracker.amountSpent)) / \(formatCurrency(tracker.amountRequired))")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }

                    // Progress bar
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color.club.surfaceContainerHigh)
                                .frame(height: 6)
                            RoundedRectangle(cornerRadius: 3)
                                .fill(accent)
                                .frame(width: geo.size.width * pct, height: 6)
                        }
                    }
                    .frame(height: 6)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.club.surfaceContainerLowest)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .contentShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
    }

    private func iconForSpendingCategory(_ category: String) -> String {
        switch category.lowercased() {
        case "dining", "food", "f&b", "fnb": return "fork.knife"
        case "pro_shop", "proshop", "golf": return "figure.golf"
        case "bar", "beverage": return "wineglass.fill"
        default: return "chart.bar.fill"
        }
    }

    // MARK: - Notifications helpers

    private func markAllNotificationsRead() async {
        guard unreadCount > 0 else { return }
        let previousUnread = unreadCount
        unreadCount = 0
        // Mark optimistically locally too so the sheet shows read state
        // if re-opened quickly.
        notifications = notifications.map { n in
            HomeNotification(
                id: n.id,
                category: n.category,
                title: n.title,
                body: n.body,
                readAt: n.readAt ?? ISO8601DateFormatter().string(from: Date()),
                createdAt: n.createdAt
            )
        }
        do {
            try await APIClient.shared.post("/notifications/mine", body: [String: String]())
        } catch {
            // Revert on failure so the badge stays accurate.
            unreadCount = previousUnread
        }
    }

    // MARK: - Membership Card Quick Access

    private var membershipCardQuickAccess: some View {
        NavigationLink {
            MembershipCardView()
        } label: {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(
                            LinearGradient(
                                colors: [Color.club.primary, Color(hex: "14532d")],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 56, height: 56)
                    Image(systemName: "creditcard.and.123")
                        .font(.system(size: 22))
                        .foregroundStyle(.white)
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text("Membership Card")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)
                    Text("Tap to check in at the club")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }

                Spacer(minLength: 8)

                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.club.outlineVariant)
            }
            .padding(14)
            .background(Color.club.surfaceContainerLowest)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Formatting Helpers

    private func formatCurrency(_ amount: Double) -> String {
        let nf = NumberFormatter()
        nf.numberStyle = .currency
        nf.currencyCode = "USD"
        nf.maximumFractionDigits = amount.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 2
        return nf.string(from: NSNumber(value: amount)) ?? "$\(amount)"
    }

    private func formatDueDate(_ date: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(date) { return "today" }
        if cal.isDateInTomorrow(date) { return "tomorrow" }
        let df = DateFormatter()
        df.dateFormat = "MMM d"
        return df.string(from: date)
    }

    // MARK: - Upcoming Row

    @ViewBuilder
    private func upcomingRowLink(_ item: UpcomingItem) -> some View {
        switch item.kind {
        case .teeTime:
            // GolfBookingView now requires a path binding (its NavigationStack
            // lives in BookView, not internally), so we switch tabs rather
            // than push it as a destination inside HomeView's stack.
            Button { selectedTab = 1 } label: { upcomingRow(item) }
                .buttonStyle(.plain)
        case .dining:
            NavigationLink { DiningView() } label: { upcomingRow(item) }
                .buttonStyle(.plain)
        case .event:
            NavigationLink {
                EventsView(initialEvent: item.eventRef)
            } label: { upcomingRow(item) }
                .buttonStyle(.plain)
        }
    }

    private func upcomingRow(_ item: UpcomingItem) -> some View {
        HStack(spacing: 0) {
            upcomingLeadingMedia(item)
                .frame(width: 92)
                .frame(maxHeight: .infinity)
                .clipped()
                .contentShape(Rectangle())

            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(item.subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .lineLimit(1)

                    // Compact date/time pill — "Today · 3:00 PM" — lives
                    // under the subtitle so the narrow right column can
                    // breathe and just holds the chevron.
                    HStack(spacing: 4) {
                        Text(item.dateLabel)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.club.foreground)
                        Text("·")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                        Text(item.timeLabel)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                    .lineLimit(1)
                    .padding(.top, 2)
                }
                .layoutPriority(1)

                Spacer(minLength: 8)

                Image(systemName: "chevron.right")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.club.outlineVariant)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(minHeight: 72)
        .background(Color.club.surfaceContainerLowest)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        // `.clipShape` only clips visuals — SwiftUI's hit-test region still
        // follows the un-clipped rectangle, which can leak taps into the
        // gap between cards (iOS 26 pitfall documented in CLAUDE.md).
        .contentShape(RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder
    private func upcomingLeadingMedia(_ item: UpcomingItem) -> some View {
        if let urlStr = item.imageUrl, let url = URL(string: urlStr) {
            CachedAsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                default:
                    upcomingIconFallback(item)
                }
            }
        } else {
            upcomingIconFallback(item)
        }
    }

    private func upcomingIconFallback(_ item: UpcomingItem) -> some View {
        ZStack {
            item.iconColor
            Image(systemName: item.icon)
                .font(.system(size: 22))
                .foregroundStyle(.white)
        }
    }

    // MARK: - Date Parsing Helpers

    private func parseBookingDate(_ dateStr: String, time: String) -> Date? {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd HH:mm"
        return df.date(from: "\(dateStr) \(time)")
    }

    private func parseDueDate(_ dateStr: String?) -> Date? {
        guard let dateStr else { return nil }
        // Due dates come back as either yyyy-MM-dd or full ISO — try both.
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        if let d = df.date(from: dateStr) { return d }
        return DateUtilities.parseISODate(dateStr)
    }

    private func parseEventDate(_ iso: String) -> Date? {
        DateUtilities.parseISODate(iso)
    }

    private func formatUpcomingDate(_ date: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(date) { return "Today" }
        if cal.isDateInTomorrow(date) { return "Tomorrow" }
        let df = DateFormatter()
        df.dateFormat = "EEE, MMM d"
        return df.string(from: date)
    }

    private func formatTime(_ time: String) -> String {
        let parts = time.split(separator: ":")
        guard parts.count >= 2, let hour = Int(parts[0]), let min = Int(parts[1]) else { return time }
        let period = hour >= 12 ? "PM" : "AM"
        let h = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour)
        return min == 0 ? "\(h) \(period)" : "\(h):\(String(format: "%02d", min)) \(period)"
    }

    private func formatEventTime(_ iso: String) -> String {
        guard let date = parseEventDate(iso) else { return "" }
        let df = DateFormatter()
        df.dateFormat = "h:mm a"
        return df.string(from: date)
    }
}

// MARK: - Response Types

private struct AnnouncementsResponse: Decodable {
    let announcements: [Announcement]
}

private struct EventsResponse: Decodable {
    let events: [ClubEvent]
}

// MARK: - Subviews

private struct AnnouncementRow: View {
    let announcement: Announcement

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(priorityColor)
                .frame(width: 8, height: 8)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: 4) {
                Text(announcement.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                Text(announcement.content)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                    .lineLimit(2)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
    }

    private var priorityColor: Color {
        switch announcement.priority {
        case "urgent": return Color.club.destructive
        case "high": return Color(hex: "f59e0b")
        default: return Color.club.primary
        }
    }
}

private struct ServiceCard: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        // Plain Button with explicit contentShape — same first-principles
        // pattern as the Golf CTAs — so the whole 80pt tile is the hit
        // region rather than just the label.
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 22))
                    .foregroundStyle(.white)
                    .frame(width: 48, height: 48)
                    .background(color, in: RoundedRectangle(cornerRadius: 14))
                Text(title)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }
            .frame(width: 80)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

private struct EventRow: View {
    let event: ClubEvent

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.club.primaryContainer)
                .frame(width: 48, height: 48)
                .overlay {
                    Image(systemName: "calendar")
                        .foregroundStyle(.white)
                }

            VStack(alignment: .leading, spacing: 2) {
                Text(event.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                Text(event.location ?? "TBD")
                    .font(.clubCaption)
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }
            Spacer()
        }
        .padding(14)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Notifications Inbox Sheet
//
// Simple list of the member's 50 most recent notifications. Standard
// iOS inbox pattern — the parent view marks everything read on
// dismiss, so there's no per-row swipe UI here.
struct NotificationsInboxSheet: View {
    let notifications: [HomeNotification]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if notifications.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "bell.slash")
                            .font(.system(size: 36))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                        Text("No notifications yet")
                            .font(.clubCaption)
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 8) {
                            ForEach(notifications) { n in
                                notificationRow(n)
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                    }
                }
            }
            .background(Color.club.background)
            .navigationTitle("Notifications")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Color.club.primary)
                }
            }
        }
    }

    private func notificationRow(_ n: HomeNotification) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle()
                    .fill(categoryColor(n.category).opacity(0.15))
                    .frame(width: 36, height: 36)
                Image(systemName: iconForCategory(n.category))
                    .font(.system(size: 14))
                    .foregroundStyle(categoryColor(n.category))
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .top, spacing: 6) {
                    Text(n.title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)
                    if n.readAt == nil {
                        Circle()
                            .fill(Color.club.primary)
                            .frame(width: 7, height: 7)
                            .padding(.top, 5)
                    }
                    Spacer(minLength: 8)
                    Text(relativeTime(n.createdAt))
                        .font(.system(size: 11))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }
                if let body = n.body, !body.isEmpty {
                    Text(body)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .lineLimit(3)
                }
            }
        }
        .padding(14)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))
    }

    private func iconForCategory(_ category: String) -> String {
        switch category.lowercased() {
        case "booking", "tee_time": return "calendar"
        case "event", "rsvp": return "star.fill"
        case "billing", "invoice", "payment": return "creditcard.fill"
        case "announcement", "news": return "megaphone.fill"
        case "dining": return "fork.knife"
        case "chat", "message": return "message.fill"
        default: return "bell.fill"
        }
    }

    private func categoryColor(_ category: String) -> Color {
        switch category.lowercased() {
        case "billing", "invoice", "payment": return Color(hex: "b45309")
        case "event", "rsvp": return Color(hex: "7c3aed")
        case "booking", "tee_time": return Color(hex: "16a34a")
        case "announcement", "news": return Color(hex: "2563eb")
        default: return Color.club.onSurfaceVariant
        }
    }

    private func relativeTime(_ iso: String?) -> String {
        guard let iso, let date = DateUtilities.parseISODate(iso) else { return "" }
        let rf = RelativeDateTimeFormatter()
        rf.unitsStyle = .abbreviated
        return rf.localizedString(for: date, relativeTo: Date())
    }
}
