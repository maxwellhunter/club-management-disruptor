import SwiftUI

// MARK: - Members Directory

struct MembersView: View {
    @State private var members: [DirectoryMember] = []
    @State private var tiers: [MemberTier] = []
    @State private var callerRole: String?
    @State private var statusFilter: MemberStatusFilter = .active
    @State private var searchText = ""
    @State private var selectedTierId: String? = nil
    @State private var isLoading = true
    @State private var searchTask: Task<Void, Never>?
    @State private var errorMessage: String?

    @State private var showAddSheet = false
    @State private var selectedMember: DirectoryMember?

    private var isAdmin: Bool { callerRole == "admin" }

    var body: some View {
        VStack(spacing: 0) {
            // MARK: - Search Bar
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 16))
                    .foregroundStyle(Color.club.onSurfaceVariant)

                TextField("Search members…", text: $searchText)
                    .font(.system(size: 15))
                    .foregroundStyle(Color.club.foreground)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)

                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                }
            }
            .padding(12)
            .background(Color.club.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 14))
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 8)

            // MARK: - Tier Filter Chips
            if !tiers.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        tierChip(label: "All", isSelected: selectedTierId == nil) {
                            selectedTierId = nil
                        }
                        ForEach(tiers) { tier in
                            tierChip(label: tier.name, isSelected: selectedTierId == tier.id) {
                                selectedTierId = selectedTierId == tier.id ? nil : tier.id
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .padding(.bottom, 12)
            }

            // MARK: - Status Filter (admin only)
            if isAdmin {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(MemberStatusFilter.allCases) { filter in
                            tierChip(label: filter.label, isSelected: statusFilter == filter) {
                                statusFilter = filter
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .padding(.bottom, 12)
            }

            // MARK: - Content
            if isLoading && members.isEmpty {
                Spacer()
                ProgressView()
                    .tint(Color.club.primary)
                Spacer()
            } else if members.isEmpty {
                Spacer()
                emptyState
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(members) { member in
                            if isAdmin {
                                Button { selectedMember = member } label: {
                                    memberCard(member)
                                }
                                .buttonStyle(.plain)
                            } else {
                                memberCard(member)
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 24)
                }
                .refreshable { await fetchMembers() }
            }
        }
        .background(Color.club.background)
        .navigationTitle("Members")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isAdmin {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 16, weight: .semibold))
                    }
                    .accessibilityLabel("Add member")
                }
            }
        }
        .onChange(of: searchText) { _, _ in debouncedSearch() }
        .onChange(of: selectedTierId) { _, _ in
            Task { await fetchMembers() }
        }
        .onChange(of: statusFilter) { _, _ in
            Task { await fetchMembers() }
        }
        .task { await fetchMembers() }
        .sheet(isPresented: $showAddSheet) {
            AddMemberSheet(tiers: tiers) {
                Task { await fetchMembers() }
            }
        }
        .sheet(item: $selectedMember) { member in
            MemberDetailSheet(member: member, tiers: tiers) {
                Task { await fetchMembers() }
            }
        }
    }

    // MARK: - Tier Chip

    private func tierChip(label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(isSelected ? Color.club.primaryForeground : Color.club.onSurfaceVariant)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(
                    isSelected ? Color.club.primaryContainer : Color.club.surfaceContainerHigh,
                    in: Capsule()
                )
        }
    }

    // MARK: - Member Card

    private func memberCard(_ member: DirectoryMember) -> some View {
        HStack(spacing: 14) {
            // Avatar — show image if available, initials fallback
            if let url = member.avatarUrl, let imageUrl = URL(string: url) {
                CachedAsyncImage(url: imageUrl) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 44, height: 44)
                            .clipShape(Circle())
                            .contentShape(Circle())
                    default:
                        memberInitialsCircle(member)
                    }
                }
            } else {
                memberInitialsCircle(member)
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(member.fullName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)
                        .lineLimit(1)

                    if isAdmin, let status = member.status, status != "active" {
                        Text(status.uppercased())
                            .font(.system(size: 9, weight: .bold))
                            .tracking(0.5)
                            .foregroundStyle(statusTextColor(status))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(statusBgColor(status), in: Capsule())
                    }

                    if let tierName = member.tierName {
                        Text(tierName.uppercased())
                            .font(.system(size: 9, weight: .bold))
                            .tracking(0.5)
                            .foregroundStyle(tierTextColor(tierName))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(tierBgColor(tierName), in: Capsule())
                    }
                }

                if let memberNumber = member.memberNumber {
                    Text("#\(memberNumber)")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }

                if let email = member.email {
                    Text(email)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .lineLimit(1)
                }
            }

            Spacer()

            if let phone = member.phone {
                Button {
                    if let url = URL(string: "tel:\(phone.replacingOccurrences(of: " ", with: ""))") {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    Image(systemName: "phone.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.club.primary)
                        .frame(width: 36, height: 36)
                        .background(Color.club.accent, in: Circle())
                }
            }
        }
        .padding(14)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "person.2")
                .font(.system(size: 48))
                .foregroundStyle(Color.club.outlineVariant)

            Text("No Members Found")
                .font(.custom("Georgia", size: 18).weight(.semibold))
                .foregroundStyle(Color.club.foreground)
                .padding(.top, 8)

            Text("Try adjusting your search or filters.")
                .font(.system(size: 14))
                .foregroundStyle(Color.club.onSurfaceVariant)
        }
    }

    // MARK: - Debounce

    private func debouncedSearch() {
        searchTask?.cancel()
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000) // 300ms
            guard !Task.isCancelled else { return }
            await fetchMembers()
        }
    }

    // MARK: - Data

    private func fetchMembers() async {
        isLoading = true
        defer { isLoading = false }

        var query: [String: String] = [:]
        if !searchText.isEmpty {
            query["search"] = searchText
        }
        if let tierId = selectedTierId {
            query["tier"] = tierId
        }
        query["status"] = statusFilter.queryValue

        struct Response: Decodable {
            let members: [DirectoryMember]
            let tiers: [MemberTier]?
            let role: String?
        }

        do {
            let response: Response = try await APIClient.shared.get("/members", query: query)
            members = response.members
            if let fetchedTiers = response.tiers, !fetchedTiers.isEmpty {
                tiers = fetchedTiers
            }
            callerRole = response.role
        } catch {
            ErrorBanner.shared.show(error)
        }
    }

    private func memberInitialsCircle(_ member: DirectoryMember) -> some View {
        Text(initials(for: member.fullName))
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 44, height: 44)
            .background(avatarColor(for: member.fullName), in: Circle())
    }

    // MARK: - Helpers

    private func initials(for name: String) -> String {
        let parts = name.components(separatedBy: " ")
        let first = parts.first?.prefix(1) ?? ""
        let last = parts.count > 1 ? parts.last!.prefix(1) : ""
        return "\(first)\(last)".uppercased()
    }

    private func avatarColor(for name: String) -> Color {
        let colors: [Color] = [
            Color(hex: "16a34a"), Color(hex: "2563eb"), Color(hex: "9333ea"),
            Color(hex: "dc2626"), Color(hex: "ea580c"), Color(hex: "0891b2"),
        ]
        let hash = name.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        return colors[hash % colors.count]
    }

    private func tierTextColor(_ tier: String) -> Color {
        switch tier.lowercased() {
        case "premium": return Color(hex: "2563eb")
        case "vip": return Color(hex: "9333ea")
        case "honorary": return Color(hex: "d97706")
        case "golf": return Color(hex: "16a34a")
        default: return Color(hex: "6b7280")
        }
    }

    private func tierBgColor(_ tier: String) -> Color {
        switch tier.lowercased() {
        case "premium": return Color(hex: "dbeafe")
        case "vip": return Color(hex: "f3e8ff")
        case "honorary": return Color(hex: "fef3c7")
        case "golf": return Color(hex: "dcfce7")
        default: return Color(hex: "f3f4f6")
        }
    }

    private func statusTextColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "invited": return Color(hex: "d97706")
        case "suspended": return Color(hex: "dc2626")
        case "inactive": return Color(hex: "6b7280")
        default: return Color(hex: "6b7280")
        }
    }

    private func statusBgColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "invited": return Color(hex: "fef3c7")
        case "suspended": return Color(hex: "fee2e2")
        case "inactive": return Color(hex: "f3f4f6")
        default: return Color(hex: "f3f4f6")
        }
    }
}

// MARK: - Models

struct DirectoryMember: Decodable, Identifiable, Hashable {
    let id: UUID
    let firstName: String
    let lastName: String
    let email: String?
    let phone: String?
    let memberNumber: String?
    let tierName: String?
    let status: String?
    let avatarUrl: String?
    let role: String?

    var fullName: String { "\(firstName) \(lastName)" }
}

struct MemberTier: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
}

enum MemberStatusFilter: String, CaseIterable, Identifiable {
    case active, invited, inactive, suspended

    var id: String { rawValue }
    var label: String { rawValue.capitalized }
    var queryValue: String { rawValue }
}
