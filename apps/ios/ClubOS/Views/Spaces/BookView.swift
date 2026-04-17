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

    private static let heroHeight: CGFloat = 300

    var body: some View {
        Group {
            if !heroLoaded {
                // API hasn't returned yet — show shimmer
                ShimmerView()
                    .frame(height: Self.heroHeight)
            } else if let heroUrl, !heroUrl.isEmpty, let url = URL(string: heroUrl) {
                // Parallax stretch — when pulled down (overscrolled past the
                // natural top), the image grows with the pull instead of
                // revealing a white gap under the status bar. Identical
                // behavior to the Dining hero.
                GeometryReader { geo in
                    let minY = geo.frame(in: .global).minY
                    let baseHeight = Self.heroHeight
                    let offset = minY > 0 ? -minY : 0
                    let height = minY > 0 ? baseHeight + minY : baseHeight

                    ZStack(alignment: .bottom) {
                        CachedAsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: geo.size.width, height: height)
                                    .clipped()
                                    .contentShape(Rectangle())
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
                .frame(height: Self.heroHeight)
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
            ErrorBanner.shared.show(error)
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
        // Both NavigationStacks stay MOUNTED in a ZStack; we fade between
        // them via opacity. Previously we used `switch mode` which tore
        // down the entire NavigationStack on every toggle — that also
        // destroyed the old ModePicker before the new one appeared, so
        // matchedGeometryEffect had no source to animate from.
        //
        // Keeping both trees in the hierarchy means the indicator's
        // `matchedGeometryEffect` source exists in the outgoing picker
        // while the destination exists in the incoming one, allowing
        // the spring animation to bridge them.
        //
        // Each child's data fetches happen once on first appear (cached
        // thereafter), so the extra mount is inexpensive.
        ZStack {
            NavigationStack(path: $golfPath) {
                GolfBookingView(path: $golfPath, modePicker: { ModePicker(mode: $mode) })
                    .background(Color.club.background)
                    .navigationTitle("")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbarBackground(.hidden, for: .navigationBar)
            }
            .opacity(mode == .golf ? 1 : 0)
            .allowsHitTesting(mode == .golf)

            NavigationStack(path: $spacesPath) {
                SpacesView(path: $spacesPath, modePicker: { ModePicker(mode: $mode) })
                    .background(Color.club.background)
                    .navigationTitle("")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbarBackground(.hidden, for: .navigationBar)
            }
            .opacity(mode == .spaces ? 1 : 0)
            .allowsHitTesting(mode == .spaces)
        }
    }
}

// Shared mode toggle rendered by both child views, just below the hero.
// Matches Dining's `flowModeToggle` — a glass-pill with an animated
// selection indicator (matchedGeometryEffect) and SF Symbol icons.
struct ModePicker: View {
    @Binding var mode: BookView.Mode

    private func icon(for mode: BookView.Mode) -> String {
        switch mode {
        case .golf: return "figure.golf"
        case .spaces: return "mappin.and.ellipse"
        }
    }

    private var selectedIndex: Int {
        BookView.Mode.allCases.firstIndex(of: mode) ?? 0
    }

    var body: some View {
        // Single animated pill positioned via offset over the button row.
        // Previously used matchedGeometryEffect across per-button
        // backgrounds, but `isSource` is baked in at insertion time — so
        // flipping which button was the source on every mode change left
        // multiple views claiming isSource:true inside the group and
        // spammed the "Multiple inserted views…" runtime warning.
        HStack(spacing: 0) {
            ForEach(BookView.Mode.allCases) { m in
                let isSelected = mode == m
                Button {
                    mode = m
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: icon(for: m))
                            .font(.system(size: 13))
                        Text(m.rawValue)
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .foregroundStyle(isSelected ? .white : Color.club.onSurfaceVariant)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .contentShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
        }
        .background {
            GeometryReader { geo in
                let pillWidth = geo.size.width / CGFloat(BookView.Mode.allCases.count)
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.club.primary)
                    .frame(width: pillWidth)
                    .offset(x: CGFloat(selectedIndex) * pillWidth)
                    .animation(.spring(response: 0.35, dampingFraction: 0.8), value: selectedIndex)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(4)
        .modifier(BookModeGlassToggleModifier())
        .padding(.horizontal, 16)
        .padding(.top, 4)
        .padding(.bottom, 4)
    }
}

// Plain light-gray pill background. We originally used Liquid Glass here
// (to match Dining), but the Book tab sits above the tab bar which has
// a darker image peeking through — the glass material kept re-sampling
// that content and flashing darker on every toggle animation. Using a
// static surface color keeps the toggle visually stable.
private struct BookModeGlassToggleModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Color.white, in: RoundedRectangle(cornerRadius: 14))
            .contentShape(RoundedRectangle(cornerRadius: 14))
    }
}
