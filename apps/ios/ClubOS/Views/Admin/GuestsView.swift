import SwiftUI

// MARK: - Guest Management Models

struct Guest: Decodable, Identifiable, Hashable {
    let id: String
    let firstName: String
    let lastName: String
    let email: String?
    let phone: String?
    let notes: String?
    let isBlocked: Bool
    let blockReason: String?
    let totalVisits: Int
    let lastVisitDate: String?

    var fullName: String { "\(firstName) \(lastName)" }
}

struct GuestVisit: Decodable, Identifiable, Hashable {
    let id: String
    let guestId: String
    let hostMemberId: String
    let visitDate: String
    let facilityType: String?
    let checkInTime: String?
    let checkOutTime: String?
    let guestFee: Double
    let feeInvoiced: Bool
    let status: String
    let notes: String?
    let guestFirstName: String?
    let guestLastName: String?
    let hostFirstName: String?
    let hostLastName: String?

    var guestName: String {
        "\(guestFirstName ?? "Unknown") \(guestLastName ?? "")".trimmingCharacters(in: .whitespaces)
    }

    var hostName: String {
        "\(hostFirstName ?? "Unknown") \(hostLastName ?? "")".trimmingCharacters(in: .whitespaces)
    }
}

struct GuestPolicy: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let facilityType: String?
    let maxGuestsPerVisit: Int
    let maxGuestVisitsPerMonth: Int?
    let maxSameGuestPerMonth: Int
    let guestFee: Double
    let requireMemberPresent: Bool
    let blackoutDays: [Int]
    let advanceRegistrationRequired: Bool
    let notes: String?
    let isActive: Bool
}

struct GuestFeeSchedule: Decodable, Identifiable, Hashable {
    let id: String
    let facilityType: String
    let tierId: String?
    let tierName: String?
    let guestFee: Double
    let weekendSurcharge: Double
    let isActive: Bool
}

struct GuestStats: Decodable, Hashable {
    let totalGuests: Int
    let visitsThisMonth: Int
    let guestFeesThisMonth: Double
    let blockedGuests: Int
    let upcomingVisits: Int
}

struct GuestManagementSummary: Decodable {
    let policies: [GuestPolicy]
    let guests: [Guest]
    let recentVisits: [GuestVisit]
    let feeSchedules: [GuestFeeSchedule]
    let stats: GuestStats
    let role: String?
}

enum GuestFacilityType: String, CaseIterable, Identifiable {
    case golf, tennis, dining, pool, fitness, other
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

// MARK: - Guests View

struct GuestsView: View {
    @State private var summary: GuestManagementSummary?
    @State private var isLoading = true
    @State private var selectedTab: Tab = .visits

    @State private var searchText = ""
    @State private var showRegisterSheet = false
    @State private var selectedGuest: Guest?
    @State private var selectedVisit: GuestVisit?

    private enum Tab: String, CaseIterable, Identifiable {
        case visits, guests, policies
        var id: String { rawValue }
        var label: String { rawValue.capitalized }
    }

    private var isAdmin: Bool { summary?.role == "admin" }

    var body: some View {
        VStack(spacing: 0) {
            // Segmented tabs
            Picker("", selection: $selectedTab) {
                ForEach(Tab.allCases) { t in
                    Text(t.label).tag(t)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 10)

            Group {
                if isLoading && summary == nil {
                    Spacer()
                    ProgressView().tint(Color.club.primary)
                    Spacer()
                } else {
                    switch selectedTab {
                    case .visits: visitsTab
                    case .guests: guestsTab
                    case .policies: policiesTab
                    }
                }
            }
        }
        .background(Color.club.background)
        .navigationTitle("Guests")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showRegisterSheet = true
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 16, weight: .semibold))
                }
                .accessibilityLabel("Register guest visit")
            }
        }
        .task { await fetchSummary() }
        .refreshable { await fetchSummary() }
        .sheet(isPresented: $showRegisterSheet) {
            RegisterGuestVisitSheet(existingGuests: summary?.guests ?? []) {
                Task { await fetchSummary() }
            }
        }
        .sheet(item: $selectedGuest) { guest in
            GuestDetailSheet(guest: guest, visits: visits(for: guest)) {
                Task { await fetchSummary() }
            }
        }
        .sheet(item: $selectedVisit) { visit in
            GuestVisitActionSheet(visit: visit) {
                Task { await fetchSummary() }
            }
        }
    }

    // MARK: - Visits Tab

    private var visitsTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let stats = summary?.stats {
                    statsStrip(stats)
                }

                if let visits = summary?.recentVisits, !visits.isEmpty {
                    LazyVStack(spacing: 10) {
                        ForEach(filteredVisits()) { visit in
                            Button { selectedVisit = visit } label: {
                                visitCard(visit)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                } else {
                    emptyState(
                        icon: "person.2.slash",
                        title: "No visits yet",
                        subtitle: "Register a guest visit using the + button."
                    )
                    .padding(.top, 40)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
    }

    private func filteredVisits() -> [GuestVisit] {
        summary?.recentVisits ?? []
    }

    private func statsStrip(_ stats: GuestStats) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                statChip(value: "\(stats.upcomingVisits)", label: "Upcoming", color: Color.club.primary)
                statChip(value: "\(stats.visitsThisMonth)", label: "This Month", color: Color(hex: "2563eb"))
                statChip(
                    value: stats.guestFeesThisMonth.asCurrency,
                    label: "Fees (mo)",
                    color: Color(hex: "16a34a")
                )
                if isAdmin {
                    statChip(value: "\(stats.totalGuests)", label: "Guests", color: Color(hex: "9333ea"))
                    if stats.blockedGuests > 0 {
                        statChip(value: "\(stats.blockedGuests)", label: "Blocked", color: Color.club.destructive)
                    }
                }
            }
        }
    }

    private func statChip(value: String, label: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(color)
            Text(label.uppercased())
                .font(.system(size: 9, weight: .bold))
                .tracking(0.7)
                .foregroundStyle(Color.club.onSurfaceVariant)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(minWidth: 90, alignment: .leading)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 12))
    }

    private func visitCard(_ visit: GuestVisit) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 2) {
                Text(DateUtilities.shortMonth(from: visit.visitDate))
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Color.club.primary)
                Text(DateUtilities.dayNumber(from: visit.visitDate))
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Color.club.foreground)
            }
            .frame(width: 44)
            .padding(.vertical, 6)
            .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(visit.guestName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)
                        .lineLimit(1)

                    statusBadge(visit.status)
                }

                Text("Host: \(visit.hostName)")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                    .lineLimit(1)

                HStack(spacing: 8) {
                    if let facility = visit.facilityType {
                        Label(facility.capitalized, systemImage: facilityIcon(facility))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                    if visit.guestFee > 0 {
                        Text(visit.guestFee.asCurrency)
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.club.primary)
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.club.outline)
        }
        .padding(14)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
    }

    private func statusBadge(_ status: String) -> some View {
        Text(statusLabel(status).uppercased())
            .font(.system(size: 9, weight: .bold))
            .tracking(0.5)
            .foregroundStyle(statusTextColor(status))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(statusBgColor(status), in: Capsule())
    }

    private func statusLabel(_ status: String) -> String {
        switch status {
        case "checked_in": return "Checked in"
        case "checked_out": return "Checked out"
        case "no_show": return "No show"
        default: return status.capitalized
        }
    }

    private func statusTextColor(_ status: String) -> Color {
        switch status {
        case "checked_in": return Color(hex: "16a34a")
        case "checked_out": return Color(hex: "2563eb")
        case "registered": return Color(hex: "d97706")
        case "no_show", "cancelled": return Color.club.destructive
        default: return Color(hex: "6b7280")
        }
    }

    private func statusBgColor(_ status: String) -> Color {
        switch status {
        case "checked_in": return Color(hex: "dcfce7")
        case "checked_out": return Color(hex: "dbeafe")
        case "registered": return Color(hex: "fef3c7")
        case "no_show", "cancelled": return Color(hex: "fee2e2")
        default: return Color(hex: "f3f4f6")
        }
    }

    private func facilityIcon(_ type: String) -> String {
        switch type {
        case "golf": return "flag.fill"
        case "tennis": return "figure.tennis"
        case "dining": return "fork.knife"
        case "pool": return "figure.pool.swim"
        case "fitness": return "dumbbell.fill"
        default: return "building.2.fill"
        }
    }

    // MARK: - Guests Tab

    private var guestsTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 15))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                    TextField("Search guests…", text: $searchText)
                        .font(.system(size: 15))
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.words)
                    if !searchText.isEmpty {
                        Button { searchText = "" } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 15))
                                .foregroundStyle(Color.club.onSurfaceVariant)
                        }
                        .accessibilityLabel("Clear search")
                    }
                }
                .padding(12)
                .background(Color.club.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 12))

                let filtered = filteredGuests()
                if filtered.isEmpty {
                    emptyState(
                        icon: "person.crop.circle.badge.questionmark",
                        title: (summary?.guests.isEmpty ?? true) ? "No guests yet" : "No matches",
                        subtitle: (summary?.guests.isEmpty ?? true)
                            ? "Register a guest visit to add their record here."
                            : "Try a different search."
                    )
                    .padding(.top, 40)
                } else {
                    LazyVStack(spacing: 10) {
                        ForEach(filtered) { guest in
                            Button { selectedGuest = guest } label: {
                                guestCard(guest)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
    }

    private func filteredGuests() -> [Guest] {
        let all = summary?.guests ?? []
        guard !searchText.isEmpty else { return all }
        let q = searchText.lowercased()
        return all.filter {
            $0.fullName.lowercased().contains(q)
                || ($0.email ?? "").lowercased().contains(q)
                || ($0.phone ?? "").contains(q)
        }
    }

    private func guestCard(_ guest: Guest) -> some View {
        HStack(spacing: 14) {
            Text(initials(for: guest.fullName))
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(
                    guest.isBlocked ? Color.club.destructive : Color.club.primary,
                    in: Circle()
                )

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(guest.fullName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)
                        .lineLimit(1)

                    if guest.isBlocked {
                        Text("BLOCKED")
                            .font(.system(size: 9, weight: .bold))
                            .tracking(0.5)
                            .foregroundStyle(Color.club.destructive)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(hex: "fee2e2"), in: Capsule())
                    }
                }

                Text("\(guest.totalVisits) visit\(guest.totalVisits == 1 ? "" : "s")")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.club.onSurfaceVariant)

                if let email = guest.email {
                    Text(email)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .lineLimit(1)
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.club.outline)
        }
        .padding(14)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Policies Tab

    private var policiesTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let policies = summary?.policies.filter({ $0.isActive }), !policies.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("ACTIVE POLICIES")
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(1.2)
                            .foregroundStyle(Color.club.onSurfaceVariant)

                        LazyVStack(spacing: 10) {
                            ForEach(policies) { policy in
                                policyCard(policy)
                            }
                        }
                    }
                }

                if let schedules = summary?.feeSchedules.filter({ $0.isActive }), !schedules.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("FEE SCHEDULES")
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(1.2)
                            .foregroundStyle(Color.club.onSurfaceVariant)
                            .padding(.top, 4)

                        LazyVStack(spacing: 10) {
                            ForEach(schedules) { schedule in
                                feeScheduleCard(schedule)
                            }
                        }
                    }
                }

                if (summary?.policies.isEmpty ?? true) && (summary?.feeSchedules.isEmpty ?? true) {
                    emptyState(
                        icon: "doc.text",
                        title: "No policies yet",
                        subtitle: "Policies and fee schedules are configured from the web dashboard."
                    )
                    .padding(.top, 40)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
        }
    }

    private func policyCard(_ policy: GuestPolicy) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(policy.name)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                Spacer()
                if let facility = policy.facilityType {
                    Text(facility.capitalized)
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.5)
                        .foregroundStyle(Color.club.primary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.club.accent, in: Capsule())
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                policyRow("Fee", value: policy.guestFee.asCurrency)
                policyRow("Max per visit", value: "\(policy.maxGuestsPerVisit)")
                if let monthly = policy.maxGuestVisitsPerMonth {
                    policyRow("Max visits / month", value: "\(monthly)")
                }
                policyRow("Same guest / month", value: "\(policy.maxSameGuestPerMonth)")
                if policy.requireMemberPresent {
                    policyRow("Member present", value: "Required")
                }
                if !policy.blackoutDays.isEmpty {
                    policyRow("Blackout days", value: policy.blackoutDays.map(dayShort).joined(separator: ", "))
                }
            }

            if let notes = policy.notes, !notes.isEmpty {
                Text(notes)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                    .padding(.top, 4)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
    }

    private func policyRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(Color.club.onSurfaceVariant)
            Spacer()
            Text(value)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.club.foreground)
        }
    }

    private func dayShort(_ day: Int) -> String {
        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][max(0, min(6, day))]
    }

    private func feeScheduleCard(_ schedule: GuestFeeSchedule) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Label(schedule.facilityType.capitalized, systemImage: facilityIcon(schedule.facilityType))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                Spacer()
                if let tier = schedule.tierName {
                    Text(tier)
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.5)
                        .foregroundStyle(Color.club.primary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.club.accent, in: Capsule())
                }
            }
            HStack {
                Text("\(schedule.guestFee.asCurrency) base")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                if schedule.weekendSurcharge > 0 {
                    Text("+ \(schedule.weekendSurcharge.asCurrency) weekends")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Empty state + helpers

    private func emptyState(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(Color.club.outlineVariant)
            Text(title)
                .font(.custom("Georgia", size: 18).weight(.semibold))
                .foregroundStyle(Color.club.foreground)
                .padding(.top, 8)
            Text(subtitle)
                .font(.system(size: 13))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 28)
    }

    private func initials(for name: String) -> String {
        let parts = name.components(separatedBy: " ")
        let first = parts.first?.prefix(1) ?? ""
        let last = parts.count > 1 ? parts.last!.prefix(1) : ""
        return "\(first)\(last)".uppercased()
    }

    private func visits(for guest: Guest) -> [GuestVisit] {
        (summary?.recentVisits ?? []).filter { $0.guestId == guest.id }
    }

    // MARK: - Fetch

    private func fetchSummary() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let response: GuestManagementSummary = try await APIClient.shared.get("/guests")
            summary = response
        } catch {
            ErrorBanner.shared.show(error)
        }
    }
}

// MARK: - Helpers shared with sheets

extension Double {
    var asCurrency: String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        f.maximumFractionDigits = self.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 2
        return f.string(from: NSNumber(value: self)) ?? "$\(self)"
    }
}

extension DateUtilities {
    static func shortMonth(from ymd: String) -> String {
        let parts = ymd.split(separator: "-")
        guard parts.count == 3, let month = Int(parts[1]) else { return "" }
        let months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
        return months[max(0, min(11, month - 1))]
    }

    static func dayNumber(from ymd: String) -> String {
        let parts = ymd.split(separator: "-")
        guard parts.count == 3 else { return "" }
        return String(Int(parts[2]) ?? 0)
    }
}
