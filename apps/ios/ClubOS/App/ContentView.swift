import SwiftUI

// MARK: - Main Tab Container (Authenticated)

struct ContentView: View {
    @State private var selectedTab = 0 // Home

    var body: some View {
        TabView(selection: $selectedTab) {
            // Tab 0: Home (profile accessible via avatar in nav bar).
            // Binding `selectedTab` down so the Concierge Services cards on
            // the Home screen can deep-link into the right tab (Book /
            // Dining / Events / Chat).
            NavigationStack {
                HomeView(selectedTab: $selectedTab)
            }
            .tabItem {
                Label("Home", systemImage: "house.fill")
            }
            .tag(0)

            // Tab 1: Book (Golf + Spaces)
            // NOTE: no outer NavigationStack here — both GolfBookingView and
            // SpacesView manage their own NavigationStack with a `path`
            // binding. Wrapping them in a second one caused nested-stack
            // hit-testing issues (top-of-screen buttons became unresponsive).
            BookView()
                .tabItem {
                    Label("Book", systemImage: "calendar.badge.plus")
                }
                .tag(1)

            // Tab 2: Dining
            // NOTE: no outer NavigationStack — DiningView owns its own
            // path-bound NavigationStack so it can programmatically push
            // Menu / Cart screens with native transitions + swipe-back.
            DiningView()
                .tabItem {
                    Label("Dining", systemImage: "fork.knife")
                }
                .tag(2)

            // Tab 3: Events
            NavigationStack {
                EventsView()
            }
            .tabItem {
                Label("Events", systemImage: "calendar")
            }
            .tag(3)

            // Tab 4: AI Chat
            NavigationStack {
                ChatView()
            }
            .tabItem {
                Label("Chat", systemImage: "sparkles")
            }
            .tag(4)
        }
        .tint(Color.club.primary)
    }
}

// MARK: - Placeholder Views (Phase 2+)

struct ChatPlaceholderView: View {
    var body: some View {
        PlaceholderScreen(
            icon: "message.fill",
            title: "AI Concierge",
            subtitle: "Coming in Phase 4"
        )
    }
}

struct GolfPlaceholderView: View {
    var body: some View {
        PlaceholderScreen(
            icon: "figure.golf",
            title: "Golf Bookings",
            subtitle: "Coming in Phase 3"
        )
    }
}

struct DiningPlaceholderView: View {
    var body: some View {
        PlaceholderScreen(
            icon: "fork.knife",
            title: "Dining",
            subtitle: "Coming in Phase 3"
        )
    }
}

struct EventsPlaceholderView: View {
    var body: some View {
        PlaceholderScreen(
            icon: "calendar",
            title: "Events",
            subtitle: "Coming in Phase 3"
        )
    }
}

struct ProfilePlaceholderView: View {
    var body: some View {
        PlaceholderScreen(
            icon: "person.fill",
            title: "Profile",
            subtitle: "Coming in Phase 2"
        )
    }
}

// MARK: - Reusable Placeholder

struct PlaceholderScreen: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(Color.club.primary)
                .frame(width: 80, height: 80)
                .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 20))

            Text(title)
                .font(.clubTitle)
                .foregroundStyle(Color.club.foreground)

            Text(subtitle)
                .font(.clubCaption)
                .foregroundStyle(Color.club.onSurfaceVariant)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.club.background)
    }
}
