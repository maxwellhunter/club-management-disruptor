import SwiftUI

// MARK: - Bookings hero image (shared between Golf + Spaces)
//
// Mirrors the Dining and Events hero pattern: fetches `/club/bookings-image`,
// caches via AppCacheService under `bookings_hero_url`, shows a shimmer while
// loading, then a parallax image with gradient fade-out. Instantiate this at
// the very top of either child ScrollView — both Golf and Spaces use the same
// cache key so switching modes is instant after the first load.

struct BookingsHeroResponse: Decodable {
    let bookingsImageUrl: String?
}

struct BookingsHero: View {
    @State private var heroUrl: String?
    @State private var heroLoaded = false

    var body: some View {
        Group {
            if !heroLoaded {
                // API hasn't returned yet — show shimmer
                ShimmerView()
                    .frame(height: 300)
            } else if let heroUrl, !heroUrl.isEmpty, let url = URL(string: heroUrl) {
                GeometryReader { geo in
                    let minY = geo.frame(in: .global).minY
                    let heroHeight: CGFloat = 300
                    let offset = minY > 0 ? -minY : 0
                    let height = minY > 0 ? heroHeight + minY : heroHeight

                    ZStack(alignment: .bottom) {
                        CachedAsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: geo.size.width, height: height)
                                    .clipped()
                            case .failure:
                                Color.club.surfaceContainer
                                    .frame(width: geo.size.width, height: height)
                            default:
                                ShimmerView()
                                    .frame(width: geo.size.width, height: height)
                            }
                        }

                        // Gradient fade from image into background
                        LinearGradient(
                            colors: [
                                Color.club.background.opacity(0),
                                Color.club.background.opacity(0.6),
                                Color.club.background,
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        .frame(height: 120)
                    }
                    .frame(width: geo.size.width, height: height)
                    .offset(y: offset)
                }
                .frame(height: 300)
            }
        }
        .task { await fetchHero() }
    }

    private func fetchHero() async {
        // Instant display from cache, then refresh from API.
        if let cached = await AppCacheService.shared.getString("bookings_hero_url") {
            heroUrl = cached
            heroLoaded = true
        }

        do {
            let response: BookingsHeroResponse = try await APIClient.shared.get("/club/bookings-image")
            let url = response.bookingsImageUrl ?? ""
            heroUrl = url
            heroLoaded = true
            await AppCacheService.shared.setString(url, forKey: "bookings_hero_url")
        } catch {
            // If we had a cached value, keep showing it. Otherwise stop
            // shimmering and show nothing.
            if !heroLoaded {
                heroLoaded = true
            }
            print("Failed to fetch bookings hero:", error)
        }
    }
}

// MARK: - Book tab container
// Switches between Golf (tee times) and Spaces (courts/cabanas/studios/etc.)
//
// Structure is important here. Previously we had:
//   VStack { Picker; NavigationStack { child } }
// That nested NavigationStack-as-VStack-sibling-of-Picker caused UIKit to
// install an invisible UINavigationBar gesture region over the top of the
// child's scroll content, making the first card + CTA unclickable.
//
// Fix: NavigationStack is the OUTERMOST view and the Picker lives INSIDE its
// root (above the child). The NavigationStack gets a real toolbar area so it
// takes its space cleanly — content starts below it, no ghost gesture layer.

struct BookView: View {
    enum Mode: String, CaseIterable, Identifiable {
        case golf = "Golf"
        case spaces = "Spaces"
        var id: String { rawValue }
    }

    @State private var mode: Mode = .golf
    @State private var golfPath: [GolfRoute] = []
    @State private var spacesPath: [Space] = []

    var body: some View {
        // One NavigationStack per mode. Switching modes tears down and
        // rebuilds the stack (acceptable — each mode's drill-down state is
        // independent).
        switch mode {
        case .golf:
            NavigationStack(path: $golfPath) {
                VStack(spacing: 0) {
                    modePicker
                    GolfBookingView(path: $golfPath)
                }
                .background(Color.club.background)
                .navigationTitle("Book")
                .navigationBarTitleDisplayMode(.inline)
            }
        case .spaces:
            NavigationStack(path: $spacesPath) {
                VStack(spacing: 0) {
                    modePicker
                    SpacesView(path: $spacesPath)
                }
                .background(Color.club.background)
                .navigationTitle("Book")
                .navigationBarTitleDisplayMode(.inline)
            }
        }
    }

    private var modePicker: some View {
        Picker("", selection: $mode) {
            ForEach(Mode.allCases) { m in
                Text(m.rawValue).tag(m)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 4)
        .background(Color.club.background)
    }
}
