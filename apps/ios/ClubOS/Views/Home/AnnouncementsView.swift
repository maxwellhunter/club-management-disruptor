import SwiftUI

// MARK: - Announcements Screen

struct AnnouncementsView: View {
    @State private var announcements: [AnnouncementDetail] = []
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .tint(Color.club.primary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if announcements.isEmpty {
                emptyState
            } else {
                list
            }
        }
        .background(Color.club.background)
        .navigationTitle("Announcements")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .task { await load() }
    }

    // MARK: - List

    private var list: some View {
        ScrollView(showsIndicators: false) {
            LazyVStack(spacing: 14) {
                ForEach(announcements) { item in
                    announcementCard(item)
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
            // Header: badge + time
            HStack {
                priorityBadge(item.priority)
                Spacer()
                Text(DateUtilities.relativeTimeString(from: item.publishedAt ?? item.createdAt))
                    .font(.system(size: 12))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }

            // Title
            Text(item.title)
                .font(.custom("Georgia", size: 18).weight(.bold))
                .foregroundStyle(Color.club.foreground)
                .lineSpacing(2)

            // Content
            Text(item.content)
                .font(.system(size: 14))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .lineSpacing(4)
                .lineLimit(3)
        }
        .padding(20)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 20))
        .shadow(color: Color.club.foreground.opacity(0.04), radius: 24, y: 8)
    }

    // MARK: - Priority Badge

    private func priorityBadge(_ priority: String) -> some View {
        let config: (label: String, bg: Color, fg: Color) = switch priority {
        case "urgent":
            ("URGENT", Color(hex: "fef2f2"), Color(hex: "dc2626"))
        case "high", "important":
            ("IMPORTANT", Color(hex: "fffbeb"), Color(hex: "d97706"))
        default:
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

            Text("No Announcements")
                .font(.custom("Georgia", size: 18).weight(.semibold))
                .foregroundStyle(Color.club.foreground)
                .padding(.top, 8)

            Text("Club announcements will appear here when posted.")
                .font(.system(size: 14))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Data

    private func load() async {
        isLoading = announcements.isEmpty
        defer { isLoading = false }

        struct Response: Decodable {
            let announcements: [AnnouncementDetail]
        }

        do {
            let response: Response = try await APIClient.shared.get("/announcements")
            announcements = response.announcements
        } catch {
            // Keep existing data on error
        }
    }

}

// MARK: - Model

private struct AnnouncementDetail: Decodable, Identifiable {
    let id: UUID
    let title: String
    let content: String
    let priority: String
    let publishedAt: String?
    let createdAt: String?
}
