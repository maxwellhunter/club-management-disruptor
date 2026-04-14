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
    @State private var isLoading = true
    // Tracks whether we've completed at least one fetch. Pull-to-refresh
    // sets `isLoading = true` again, but we don't want to ghost the screen
    // a second time — `.refreshable` already shows its own system spinner,
    // and replacing real content with skeletons mid-refresh feels jarring.
    // Skeletons should only appear on the very first load.
    @State private var hasLoadedOnce = false

    // Avatar — read cached URL so it's instant (no flash)
    private var avatarUrl: String? {
        UserDefaults.standard.string(forKey: "clubos_cache_avatar_url")
    }

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
                                default:
                                    homeInitialsCircle
                                }
                            }
                        } else {
                            homeInitialsCircle
                        }
                    }
                }

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

                        ForEach(upcomingItems.prefix(6)) { item in
                            upcomingRowLink(item)
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

                // MARK: - Concierge Services
                VStack(alignment: .leading, spacing: 12) {
                    Text("Concierge Services")
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

        let (announcementsResult, eventsResult, bookingsResult) = await (announcementsTask, eventsTask, bookingsTask)

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
            NavigationLink { EventsView() } label: { upcomingRow(item) }
                .buttonStyle(.plain)
        }
    }

    private func upcomingRow(_ item: UpcomingItem) -> some View {
        HStack(spacing: 14) {
            // Image thumbnail or icon fallback
            if let urlStr = item.imageUrl, let url = URL(string: urlStr) {
                CachedAsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 52, height: 52)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    default:
                        upcomingIconFallback(item)
                    }
                }
            } else {
                upcomingIconFallback(item)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                    .lineLimit(1)
                Text(item.subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                Text(item.dateLabel)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                Text(item.timeLabel)
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }

            Image(systemName: "chevron.right")
                .font(.system(size: 12))
                .foregroundStyle(Color.club.outlineVariant)
        }
        .padding(14)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
    }

    private func upcomingIconFallback(_ item: UpcomingItem) -> some View {
        Image(systemName: item.icon)
            .font(.system(size: 20))
            .foregroundStyle(.white)
            .frame(width: 52, height: 52)
            .background(item.iconColor, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Date Parsing Helpers

    private func parseBookingDate(_ dateStr: String, time: String) -> Date? {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd HH:mm"
        return df.date(from: "\(dateStr) \(time)")
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
