import SwiftUI

// MARK: - Announcements Screen

struct AnnouncementsView: View {
    @State private var announcements: [AnnouncementDetail] = []
    @State private var tiers: [AnnouncementTier] = []
    @State private var callerRole: String?
    @State private var isLoading = true

    @State private var adminFilter: AdminFilter = .all
    @State private var showComposer = false
    @State private var selectedAnnouncement: AnnouncementDetail?

    private var isAdmin: Bool { callerRole == "admin" }

    private var visibleAnnouncements: [AnnouncementDetail] {
        guard isAdmin else { return announcements }
        switch adminFilter {
        case .all: return announcements
        case .published: return announcements.filter { $0.publishedAt != nil }
        case .drafts: return announcements.filter { $0.publishedAt == nil }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            if isAdmin {
                Picker("", selection: $adminFilter) {
                    ForEach(AdminFilter.allCases) { f in
                        Text(f.label).tag(f)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 24)
                .padding(.top, 12)
                .padding(.bottom, 6)
            }

            Group {
                if isLoading && announcements.isEmpty {
                    ProgressView()
                        .tint(Color.club.primary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if visibleAnnouncements.isEmpty {
                    emptyState
                } else {
                    list
                }
            }
        }
        .background(Color.club.background)
        .navigationTitle("Announcements")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isAdmin {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showComposer = true
                    } label: {
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 16, weight: .semibold))
                    }
                    .accessibilityLabel("New announcement")
                }
            }
        }
        .refreshable { await load() }
        .task { await load() }
        .sheet(isPresented: $showComposer) {
            AnnouncementComposerSheet(existing: nil, tiers: tiers) {
                Task { await load() }
            }
        }
        .sheet(item: $selectedAnnouncement) { item in
            AnnouncementDetailSheet(announcement: item, tiers: tiers) {
                Task { await load() }
            }
        }
    }

    // MARK: - List

    private var list: some View {
        ScrollView(showsIndicators: false) {
            LazyVStack(spacing: 14) {
                ForEach(visibleAnnouncements) { item in
                    if isAdmin {
                        Button { selectedAnnouncement = item } label: {
                            announcementCard(item)
                        }
                        .buttonStyle(.plain)
                    } else {
                        announcementCard(item)
                    }
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
    }

    // MARK: - Card

    private func announcementCard(_ item: AnnouncementDetail) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                priorityBadge(item.priority)
                if isAdmin && item.publishedAt == nil {
                    Text("DRAFT")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.8)
                        .foregroundStyle(Color(hex: "6b7280"))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color(hex: "f3f4f6"), in: RoundedRectangle(cornerRadius: 8))
                }
                if isAdmin, let tierIds = item.targetTierIds, !tierIds.isEmpty {
                    Label("\(tierIds.count) tier\(tierIds.count == 1 ? "" : "s")", systemImage: "target")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.club.primary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 8))
                }
                Spacer()
                Text(DateUtilities.relativeTimeString(from: item.publishedAt ?? item.createdAt))
                    .font(.system(size: 12))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }

            Text(item.title)
                .font(.custom("Georgia", size: 18).weight(.bold))
                .foregroundStyle(Color.club.foreground)
                .lineSpacing(2)
                .multilineTextAlignment(.leading)

            Text(item.content)
                .font(.system(size: 14))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .lineSpacing(4)
                .lineLimit(3)
                .multilineTextAlignment(.leading)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 20))
        .shadow(color: Color.club.foreground.opacity(0.04), radius: 24, y: 8)
    }

    // MARK: - Priority Badge

    private func priorityBadge(_ priority: AnnouncementPriority) -> some View {
        let config: (label: String, bg: Color, fg: Color) = switch priority {
        case .urgent:
            ("URGENT", Color(hex: "fef2f2"), Color(hex: "dc2626"))
        case .high:
            ("IMPORTANT", Color(hex: "fffbeb"), Color(hex: "d97706"))
        case .low:
            ("LOW", Color(hex: "f3f4f6"), Color(hex: "6b7280"))
        case .normal:
            ("ANNOUNCEMENT", Color.club.accent, Color.club.primary)
        }

        return HStack(spacing: 6) {
            Circle()
                .fill(config.fg)
                .frame(width: 6, height: 6)
            Text(config.label)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(config.fg)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(config.bg, in: RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "megaphone")
                .font(.system(size: 48))
                .foregroundStyle(Color.club.outlineVariant)

            Text(emptyStateTitle)
                .font(.custom("Georgia", size: 18).weight(.semibold))
                .foregroundStyle(Color.club.foreground)
                .padding(.top, 8)

            Text(emptyStateSubtitle)
                .font(.system(size: 14))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyStateTitle: String {
        if isAdmin {
            switch adminFilter {
            case .drafts: return "No Drafts"
            case .published: return "Nothing Published"
            case .all: return "No Announcements"
            }
        }
        return "No Announcements"
    }

    private var emptyStateSubtitle: String {
        if isAdmin {
            return adminFilter == .drafts
                ? "Tap the compose icon to draft a new announcement."
                : "Tap the compose icon to post a club-wide announcement."
        }
        return "Club announcements will appear here when posted."
    }

    // MARK: - Data

    private func load() async {
        isLoading = announcements.isEmpty
        defer { isLoading = false }

        struct Response: Decodable {
            let announcements: [AnnouncementDetail]
            let role: String?
            let tiers: [AnnouncementTier]?
        }

        do {
            let response: Response = try await APIClient.shared.get("/announcements")
            announcements = response.announcements
            callerRole = response.role
            if let tiers = response.tiers {
                self.tiers = tiers
            }
        } catch {
            ErrorBanner.shared.show(error)
        }
    }
}

// MARK: - Supporting filter

enum AdminFilter: String, CaseIterable, Identifiable {
    case all, published, drafts
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

// MARK: - Models (internal so sheets can reach them)

struct AnnouncementDetail: Decodable, Identifiable, Hashable {
    let id: UUID
    let title: String
    let content: String
    let priority: AnnouncementPriority
    let publishedAt: String?
    let createdAt: String?
    let targetTierIds: [UUID]?

    var isPublished: Bool { publishedAt != nil }
}

struct AnnouncementTier: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let level: String?
}

extension AnnouncementPriority {
    var color: Color {
        switch self {
        case .urgent: return Color(hex: "dc2626")
        case .high: return Color(hex: "d97706")
        case .low: return Color(hex: "6b7280")
        case .normal: return Color.club.primary
        }
    }
}
