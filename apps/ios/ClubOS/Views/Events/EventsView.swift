import SwiftUI

// MARK: - Event Response Models

struct EventsListResponse: Decodable {
    let events: [ClubEvent]
}

struct EventDetailResponse: Decodable {
    let event: ClubEvent
}

struct RsvpResponse: Decodable {
    let rsvp: RsvpResult
}

struct RsvpResult: Decodable {
    let id: String
    let status: String
}

struct EventsHeroResponse: Decodable {
    let eventsImageUrl: String?
}

// MARK: - Event Icon Mapping

private func eventIcon(for title: String) -> (icon: String, colors: [Color]) {
    let t = title.lowercased()
    if t.contains("golf") || t.contains("tournament") {
        return ("figure.golf", [Color(hex: "0d5c2e"), Color(hex: "0a3d1e")])
    } else if t.contains("wine") || t.contains("tasting") || t.contains("cocktail") {
        return ("wineglass.fill", [Color(hex: "5c1a4e"), Color(hex: "3d0e34")])
    } else if t.contains("brunch") || t.contains("dinner") || t.contains("dining") {
        return ("fork.knife", [Color(hex: "8b4513"), Color(hex: "5c2e0e")])
    } else if t.contains("movie") || t.contains("film") {
        return ("film.fill", [Color(hex: "1a3a5c"), Color(hex: "0e2640")])
    } else if t.contains("tennis") {
        return ("tennisball.fill", [Color(hex: "5c8a1a"), Color(hex: "3d5c0e")])
    } else if t.contains("pool") || t.contains("swim") {
        return ("figure.pool.swim", [Color(hex: "0e6490"), Color(hex: "0a4060")])
    } else if t.contains("family") || t.contains("kid") || t.contains("junior") {
        return ("figure.and.child.holdinghands", [Color(hex: "5c4a1a"), Color(hex: "3d310e")])
    } else {
        return ("star.fill", [Color.club.primaryContainer, Color(hex: "012d1d")])
    }
}

// MARK: - Events View

struct EventsView: View {
    enum Screen { case list, detail }

    @State private var screen: Screen = .list
    @State private var events: [ClubEvent] = []
    @State private var loading = true
    @State private var selectedEvent: ClubEvent?

    // Hero image — nil = still loading, "" = no image, URL string = has image
    @State private var eventsHeroUrl: String?
    @State private var heroLoaded = false

    /// True when we should show hero space (loading shimmer or actual image)
    private var hasHeroContent: Bool {
        !heroLoaded || (eventsHeroUrl != nil && !eventsHeroUrl!.isEmpty)
    }

    // RSVP
    @State private var rsvpInProgress: String? = nil  // tracks which status is loading
    @State private var showRsvpSuccess = false
    @State private var rsvpSuccessMessage = ""
    @State private var rsvpError: String?

    var body: some View {
        ZStack {
            Color.club.background.ignoresSafeArea()

            switch screen {
            case .list:
                eventListView
            case .detail:
                eventDetailView
            }
        }
        .navigationTitle(screen == .list && hasHeroContent ? "" : (screen == .list ? "Events" : ""))
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(screen == .list && hasHeroContent ? .hidden : .visible, for: .navigationBar)
        .task {
            await fetchEventsHero()
            await fetchEvents()
        }
        .alert("RSVP Updated!", isPresented: $showRsvpSuccess) {
            Button("OK") {}
        } message: {
            Text(rsvpSuccessMessage)
        }
        .alert("RSVP Error", isPresented: .constant(rsvpError != nil)) {
            Button("OK") { rsvpError = nil }
        } message: {
            Text(rsvpError ?? "")
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Event List
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var eventListView: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 24) {
                // Hero — shimmer while loading, image when ready, nothing if no URL
                if !heroLoaded {
                    ShimmerView()
                        .frame(height: 300)
                } else if let heroUrl = eventsHeroUrl, !heroUrl.isEmpty,
                          let url = URL(string: heroUrl) {
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

                if loading {
                    ProgressView()
                        .tint(Color.club.primary)
                        .padding(.top, 40)
                } else if events.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "calendar")
                            .font(.system(size: 32))
                            .foregroundStyle(Color.club.outlineVariant)
                        Text("No upcoming events")
                            .font(.system(size: 15))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                    .padding(.top, 40)
                } else {
                    // Featured event (first)
                    if let featured = events.first {
                        featuredEventCard(featured)
                            .padding(.horizontal, 20)
                    }

                    // Rest of events
                    if events.count > 1 {
                        VStack(spacing: 14) {
                            ForEach(Array(events.dropFirst())) { event in
                                eventCard(event)
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                }

                Spacer(minLength: 32)
            }
        }
        .ignoresSafeArea(edges: hasHeroContent ? .top : [])
    }

    private func featuredEventCard(_ event: ClubEvent) -> some View {
        let (icon, gradientColors) = eventIcon(for: event.title)

        return Button {
            selectedEvent = event
            screen = .detail
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                // Hero image or gradient
                ZStack(alignment: .bottomLeading) {
                    if let imageUrl = event.imageUrl, let url = URL(string: imageUrl) {
                        CachedAsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                            default:
                                LinearGradient(
                                    colors: gradientColors,
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                                .overlay {
                                    Image(systemName: icon)
                                        .font(.system(size: 56))
                                        .foregroundStyle(.white.opacity(0.1))
                                }
                            }
                        }
                        .frame(height: 160)
                        .clipped()
                    } else {
                        LinearGradient(
                            colors: gradientColors,
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        .frame(height: 160)
                        .overlay {
                            Image(systemName: icon)
                                .font(.system(size: 56))
                                .foregroundStyle(.white.opacity(0.1))
                        }
                    }

                    // Date badge
                    VStack(spacing: 0) {
                        Text(eventMonthLabel(event.startDate))
                            .font(.system(size: 9, weight: .bold))
                            .tracking(0.5)
                            .foregroundStyle(Color.club.primary)
                        Text(eventDayLabel(event.startDate))
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(Color.club.foreground)
                    }
                    .frame(width: 48, height: 48)
                    .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 12))
                    .shadow(color: .black.opacity(0.2), radius: 4, y: 2)
                    .padding(16)
                }
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                VStack(alignment: .leading, spacing: 8) {
                    // Tags row
                    HStack(spacing: 6) {
                        if event.priceValue == nil || event.priceValue == 0 {
                            tagBadge("FREE", color: Color.club.primary)
                        } else {
                            tagBadge(formatPrice(event.priceValue!), color: Color(hex: "8b6914"))
                        }

                        if let cap = event.capacity {
                            let spotsLeft = cap - event.rsvpCount
                            if spotsLeft <= 5 && spotsLeft > 0 {
                                tagBadge("\(spotsLeft) spots left", color: .red)
                            } else if spotsLeft <= 0 {
                                tagBadge("FULL", color: .red)
                            }
                        }

                        if event.userRsvpStatus == "attending" {
                            tagBadge("GOING", color: Color.club.primary)
                        }
                    }

                    Text(event.title)
                        .font(.custom("Georgia", size: 20).weight(.bold))
                        .foregroundStyle(Color.club.foreground)
                        .lineLimit(2)

                    if let desc = event.description, !desc.isEmpty {
                        Text(desc)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                            .lineLimit(2)
                    }

                    HStack(spacing: 16) {
                        HStack(spacing: 4) {
                            Image(systemName: "clock")
                                .font(.system(size: 11))
                            Text(eventTimeRange(event))
                                .font(.system(size: 12))
                        }
                        .foregroundStyle(Color.club.onSurfaceVariant)

                        if let loc = event.location, !loc.isEmpty {
                            HStack(spacing: 4) {
                                Image(systemName: "mappin")
                                    .font(.system(size: 11))
                                Text(loc)
                                    .font(.system(size: 12))
                                    .lineLimit(1)
                            }
                            .foregroundStyle(Color.club.onSurfaceVariant)
                        }
                    }

                    // Capacity bar
                    if let cap = event.capacity, cap > 0 {
                        capacityBar(attending: event.rsvpCount, capacity: cap)
                    }
                }
                .padding(16)
            }
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: Color.club.foreground.opacity(0.06), radius: 12, y: 4)
        }
        .buttonStyle(.plain)
    }

    private func eventCard(_ event: ClubEvent) -> some View {
        let (icon, gradientColors) = eventIcon(for: event.title)

        return Button {
            selectedEvent = event
            screen = .detail
        } label: {
            HStack(spacing: 14) {
                // Event image or icon gradient
                if let imageUrl = event.imageUrl, let url = URL(string: imageUrl) {
                    CachedAsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        default:
                            ZStack {
                                LinearGradient(colors: gradientColors, startPoint: .topLeading, endPoint: .bottomTrailing)
                                Image(systemName: icon)
                                    .font(.system(size: 18))
                                    .foregroundStyle(.white.opacity(0.7))
                            }
                        }
                    }
                    .frame(width: 56, height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                } else {
                    ZStack {
                        LinearGradient(
                            colors: gradientColors,
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        Image(systemName: icon)
                            .font(.system(size: 18))
                            .foregroundStyle(.white.opacity(0.7))
                    }
                    .frame(width: 56, height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(event.title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.club.foreground)
                            .lineLimit(1)

                        Spacer()

                        if event.userRsvpStatus == "attending" {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 14))
                                .foregroundStyle(Color.club.primary)
                        }
                    }

                    Text(eventDateLabel(event.startDate) + " · " + eventTimeLabel(event.startDate))
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)

                    HStack(spacing: 8) {
                        if let loc = event.location, !loc.isEmpty {
                            HStack(spacing: 3) {
                                Image(systemName: "mappin")
                                    .font(.system(size: 9))
                                Text(loc)
                                    .font(.system(size: 11))
                                    .lineLimit(1)
                            }
                            .foregroundStyle(Color.club.outline)
                        }

                        Spacer()

                        if event.priceValue == nil || event.priceValue == 0 {
                            Text("Free")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Color.club.primary)
                        } else {
                            Text(formatPrice(event.priceValue!))
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Color.club.foreground)
                        }
                    }
                }
            }
            .padding(14)
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))
            .shadow(color: Color.club.foreground.opacity(0.03), radius: 8, y: 2)
        }
        .buttonStyle(.plain)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Event Detail
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var eventDetailView: some View {
        guard let event = selectedEvent else {
            return AnyView(EmptyView())
        }

        let (icon, gradientColors) = eventIcon(for: event.title)
        let currentStatus = event.userRsvpStatus

        return AnyView(
            ZStack(alignment: .bottom) {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        // Hero image
                        ZStack(alignment: .topLeading) {
                            if let imageUrl = event.imageUrl, let url = URL(string: imageUrl) {
                                CachedAsyncImage(url: url) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                            .frame(height: 220)
                                            .clipped()
                                    default:
                                        LinearGradient(
                                            colors: gradientColors,
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                        .frame(height: 220)
                                        .overlay {
                                            Image(systemName: icon)
                                                .font(.system(size: 64))
                                                .foregroundStyle(.white.opacity(0.1))
                                        }
                                    }
                                }
                            } else {
                                LinearGradient(
                                    colors: gradientColors,
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                                .frame(height: 220)
                                .overlay {
                                    Image(systemName: icon)
                                        .font(.system(size: 64))
                                        .foregroundStyle(.white.opacity(0.1))
                                }
                            }

                            Button {
                                screen = .list
                                selectedEvent = nil
                            } label: {
                                Image(systemName: "chevron.left")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .frame(width: 36, height: 36)
                                    .background(.ultraThinMaterial, in: Circle())
                            }
                            .padding(.top, 12)
                            .padding(.leading, 20)
                        }

                        VStack(alignment: .leading, spacing: 20) {
                            // Tags
                            HStack(spacing: 6) {
                                if event.priceValue == nil || event.priceValue == 0 {
                                    tagBadge("FREE", color: Color.club.primary)
                                } else {
                                    tagBadge(formatPrice(event.priceValue!), color: Color(hex: "8b6914"))
                                }

                                if let cap = event.capacity {
                                    let spotsLeft = cap - event.rsvpCount
                                    if spotsLeft <= 5 && spotsLeft > 0 {
                                        tagBadge("\(spotsLeft) spots left", color: .red)
                                    } else if spotsLeft <= 0 {
                                        tagBadge("FULL", color: .red)
                                    }
                                }

                                if currentStatus == "attending" {
                                    tagBadge("YOU'RE GOING", color: Color.club.primary)
                                } else if currentStatus == "maybe" {
                                    tagBadge("MAYBE", color: Color(hex: "8b6914"))
                                }
                            }

                            // Title
                            Text(event.title)
                                .font(.custom("Georgia", size: 24).weight(.bold))
                                .foregroundStyle(Color.club.foreground)

                            // Info rows
                            VStack(spacing: 14) {
                                infoRow(icon: "calendar", label: "Date", value: eventDateLabel(event.startDate))
                                infoRow(icon: "clock", label: "Time", value: eventTimeRange(event))
                                if let loc = event.location, !loc.isEmpty {
                                    infoRow(icon: "mappin.and.ellipse", label: "Location", value: loc)
                                }
                                if let cap = event.capacity {
                                    infoRow(icon: "person.2", label: "Capacity", value: "\(event.rsvpCount) / \(cap) attending")
                                }
                                if let price = event.priceValue, price > 0 {
                                    infoRow(icon: "creditcard", label: "Price", value: formatPrice(price) + " per person")
                                }
                            }
                            .padding(16)
                            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))

                            // Capacity bar
                            if let cap = event.capacity, cap > 0 {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("ATTENDANCE")
                                        .font(.system(size: 10, weight: .bold))
                                        .tracking(1)
                                        .foregroundStyle(Color.club.outline)
                                    capacityBar(attending: event.rsvpCount, capacity: cap)
                                }
                            }

                            // Description
                            if let desc = event.description, !desc.isEmpty {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("ABOUT THIS EVENT")
                                        .font(.system(size: 10, weight: .bold))
                                        .tracking(1)
                                        .foregroundStyle(Color.club.outline)

                                    Text(desc)
                                        .font(.system(size: 15))
                                        .foregroundStyle(Color.club.foreground)
                                        .lineSpacing(4)
                                }
                            }

                            Spacer(minLength: 120)
                        }
                        .padding(20)
                    }
                }

                // RSVP buttons
                rsvpBar(event: event)
            }
        )
    }

    private func infoRow(icon: String, label: String, value: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(Color.club.primary)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color.club.outline)
                Text(value)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.club.foreground)
            }

            Spacer()
        }
    }

    private func rsvpBar(event: ClubEvent) -> some View {
        let current = event.userRsvpStatus
        let isFull = event.capacity != nil && event.rsvpCount >= (event.capacity ?? 0)

        return VStack(spacing: 8) {
            Divider()

            // RSVP action buttons — all gray by default, selected one is green
            HStack(spacing: 10) {
                rsvpButton(
                    label: "I'm Going",
                    icon: "hand.thumbsup",
                    selectedIcon: "hand.thumbsup.fill",
                    status: "attending",
                    current: current,
                    eventId: event.id,
                    disabled: isFull && current != "attending"
                )

                rsvpButton(
                    label: "Maybe",
                    icon: "hand.raised",
                    selectedIcon: "hand.raised.fill",
                    status: "maybe",
                    current: current,
                    eventId: event.id,
                    disabled: false
                )

                rsvpButton(
                    label: "Can't Go",
                    icon: "hand.thumbsdown",
                    selectedIcon: "hand.thumbsdown.fill",
                    status: "declined",
                    current: current,
                    eventId: event.id,
                    disabled: false
                )
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 8)
        }
        .background(.ultraThinMaterial)
    }

    private func rsvpButton(label: String, icon: String, selectedIcon: String, status: String, current: String?, eventId: String, disabled: Bool) -> some View {
        let isSelected = current == status
        let isLoading = rsvpInProgress == status

        return Button {
            Task { await submitRsvp(eventId: eventId, status: status) }
        } label: {
            VStack(spacing: 4) {
                if isLoading {
                    ProgressView()
                        .tint(isSelected ? .white : Color.club.onSurfaceVariant)
                        .frame(height: 15)
                } else {
                    Image(systemName: isSelected ? selectedIcon : icon)
                        .font(.system(size: 15))
                }
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(isSelected ? .white : Color.club.onSurfaceVariant)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(
                isSelected ? Color.club.primary : Color.club.surfaceContainerHigh,
                in: RoundedRectangle(cornerRadius: 12)
            )
        }
        .disabled(rsvpInProgress != nil || disabled)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Shared UI Components
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func tagBadge(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .bold))
            .tracking(0.3)
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.12), in: Capsule())
    }

    private func capacityBar(attending: Int, capacity: Int) -> some View {
        let pct = min(Double(attending) / Double(capacity), 1.0)
        let barColor: Color = pct >= 0.9 ? .red : pct >= 0.7 ? .orange : Color.club.primary

        return VStack(spacing: 6) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.club.surfaceContainerHigh)
                        .frame(height: 6)

                    RoundedRectangle(cornerRadius: 4)
                        .fill(barColor)
                        .frame(width: geo.size.width * pct, height: 6)
                }
            }
            .frame(height: 6)

            HStack {
                Text("\(attending) attending")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                Spacer()
                Text("\(capacity - attending) spots remaining")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.outline)
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Date Formatting
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func parseDate(_ iso: String) -> Date? {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = fmt.date(from: iso) { return d }
        fmt.formatOptions = [.withInternetDateTime]
        return fmt.date(from: iso)
    }

    private func eventMonthLabel(_ iso: String) -> String {
        guard let date = parseDate(iso) else { return "" }
        let df = DateFormatter()
        df.dateFormat = "MMM"
        return df.string(from: date).uppercased()
    }

    private func eventDayLabel(_ iso: String) -> String {
        guard let date = parseDate(iso) else { return "" }
        let df = DateFormatter()
        df.dateFormat = "d"
        return df.string(from: date)
    }

    private func eventDateLabel(_ iso: String) -> String {
        guard let date = parseDate(iso) else { return "" }
        let df = DateFormatter()
        df.dateFormat = "EEEE, MMMM d"
        return df.string(from: date)
    }

    private func eventTimeLabel(_ iso: String) -> String {
        guard let date = parseDate(iso) else { return "" }
        let df = DateFormatter()
        df.dateFormat = "h:mm a"
        return df.string(from: date)
    }

    private func eventTimeRange(_ event: ClubEvent) -> String {
        let start = eventTimeLabel(event.startDate)
        if let end = event.endDate {
            let endStr = eventTimeLabel(end)
            return "\(start) – \(endStr)"
        }
        return start
    }

    private func formatPrice(_ price: Double) -> String {
        String(format: "$%.0f", price)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - API Calls
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func fetchEventsHero() async {
        // Check cache first for instant display
        if let cached = await AppCacheService.shared.getString("events_hero_url") {
            eventsHeroUrl = cached
            heroLoaded = true
        }

        // Always fetch fresh from API (updates cache for next time)
        do {
            let response: EventsHeroResponse = try await APIClient.shared.get("/club/events-image")
            let url = response.eventsImageUrl ?? ""
            eventsHeroUrl = url
            heroLoaded = true
            await AppCacheService.shared.setString(url, forKey: "events_hero_url")
        } catch {
            if !heroLoaded {
                heroLoaded = true
            }
            print("Failed to fetch events hero:", error)
        }
    }

    private func fetchEvents() async {
        loading = true
        defer { loading = false }

        do {
            let response: EventsListResponse = try await APIClient.shared.get("/events")
            events = response.events
        } catch {
            print("Failed to fetch events:", error)
        }
    }

    private func submitRsvp(eventId: String, status: String) async {
        rsvpInProgress = status
        defer { rsvpInProgress = nil }

        struct RsvpRequest: Encodable {
            let eventId: String
            let status: String
            let guestCount: Int
        }

        let request = RsvpRequest(
            eventId: eventId,
            status: status,
            guestCount: 0
        )

        do {
            // Build request manually so we can handle the response ourselves
            let urlRequest = try APIClient.shared.buildRequest(
                path: "/events/rsvp",
                method: "POST",
                body: request
            )
            let (data, response) = try await URLSession.shared.data(for: urlRequest)

            guard let httpResponse = response as? HTTPURLResponse else {
                rsvpError = "Invalid response"
                return
            }

            if httpResponse.statusCode >= 400 {
                // Try to extract error message
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let errorMsg = json["error"] as? String {
                    rsvpError = errorMsg
                } else {
                    rsvpError = "RSVP failed (status \(httpResponse.statusCode))"
                }
                return
            }

            // Success — re-fetch events to get updated RSVP status and counts
            await fetchEvents()
            if let updatedEvent = events.first(where: { $0.id == eventId }) {
                selectedEvent = updatedEvent
            }

            let statusLabel = status == "attending" ? "You're going!" :
                             status == "maybe" ? "Marked as maybe." : "RSVP declined."
            rsvpSuccessMessage = statusLabel
            showRsvpSuccess = true
        } catch {
            rsvpError = error.localizedDescription
        }
    }
}
