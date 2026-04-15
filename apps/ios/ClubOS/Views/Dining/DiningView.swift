import SwiftUI

// MARK: - Dining Models

struct DiningFacility: Decodable, Identifiable {
    let id: String
    let name: String
    let type: String
    let description: String?
    let imageUrl: String?
    let maxPartySize: Int?

    var effectiveMaxPartySize: Int { maxPartySize ?? 12 }
}

struct DiningFacilitiesResponse: Decodable {
    let facilities: [DiningFacility]
}

struct DiningHeroResponse: Decodable {
    let diningImageUrl: String?
}

struct MenuCategory: Decodable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let imageUrl: String?
    let items: [MenuItem]
}

struct MenuItem: Decodable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let price: Double
    let isAvailable: Bool
    let imageUrl: String?
    let dietaryTags: [String]?
    let prepTime: Int?
}

struct MenuResponse: Decodable {
    let facility: DiningFacility?
    let categories: [MenuCategory]
}

struct DiningOrderResponse: Decodable {
    let order: DiningOrderResult
}

struct DiningOrderResult: Decodable {
    let id: String
}

// MARK: - My Activity Models

struct MyDiningOrder: Decodable, Identifiable {
    let id: String
    let facilityName: String
    let status: String
    let total: Double
    let tableNumber: String?
    let createdAt: String?
    let items: [MyDiningOrderItem]
}

struct MyDiningOrderItem: Decodable, Identifiable {
    let id: String
    let name: String
    let quantity: Int
    let price: Double
}

struct MyDiningOrdersResponse: Decodable {
    let orders: [MyDiningOrder]
}

struct MyDiningReservation: Decodable, Identifiable {
    let id: String
    let facilityId: String?
    let date: String
    let startTime: String
    let endTime: String?
    let partySize: Int
    let status: String
    let facilityName: String?
    let facilityType: String?
    let facilityImageUrl: String?
    let notes: String?
}

private struct MyDiningReservationsResponse: Decodable {
    let bookings: [MyDiningReservation]
}

struct DiningSlot: Decodable {
    let startTime: String
    let endTime: String
    let isAvailable: Bool
    let bookingsRemaining: Int
}

struct DiningSlotsResponse: Decodable {
    let slots: [DiningSlot]
}

struct DiningBookingResponse: Decodable {
    let booking: DiningBookingResult
}

struct DiningBookingResult: Decodable {
    let id: String
}

// MARK: - Cart Item

struct CartItem: Identifiable {
    var id: String { menuItemId }
    let menuItemId: String
    let name: String
    let price: Double
    var quantity: Int
}

// MARK: - Venue Info

private struct VenueInfo {
    let tagline: String
    let cuisine: String
    let hours: String
    let icon: String
}

private func venueInfo(for name: String) -> VenueInfo {
    switch name {
    case "Main Dining Room":
        return VenueInfo(tagline: "Modern European, farm-to-table", cuisine: "Fine Dining", hours: "Dinner 18:00–22:30", icon: "leaf.fill")
    case "Grill Room":
        return VenueInfo(tagline: "Artisanal burgers, premium steaks", cuisine: "Casual Elite", hours: "Lunch & Dinner", icon: "flame.fill")
    default:
        return VenueInfo(tagline: "Fine dining experience", cuisine: "Restaurant", hours: "Open Today", icon: "fork.knife")
    }
}

private let TAX_RATE = 0.08
private let SERVICE_CHARGE_RATE = 0.18

// MARK: - Glass Effect Modifier

private struct GlassToggleModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content
                .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 14))
                .contentShape(RoundedRectangle(cornerRadius: 14))
        } else {
            content
                .background(Color.club.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 14))
                .contentShape(RoundedRectangle(cornerRadius: 14))
        }
    }
}

// MARK: - Dining View

struct DiningView: View {
    // Navigation destinations pushed onto our NavigationStack's path.
    // Before this refactor we used a manual `switch screen` inside a
    // ZStack which snapped instantly with no animation, no system back
    // button, and no swipe-to-go-back. Routing through NavigationStack
    // gives native iOS push/pop animations + gestures for free.
    enum DiningRoute: Hashable { case menu, cart }
    enum ReserveStep: Int, CaseIterable { case date = 0, time = 1, confirm = 2 }
    enum FlowMode: String { case reserve = "Reserve", order = "Order" }

    @Namespace private var toggleAnimation
    @State private var path: [DiningRoute] = []
    @State private var flowMode: FlowMode = .reserve

    // Hero image — nil = still loading, "" = no image, URL string = has image
    @State private var diningHeroUrl: String?
    @State private var heroLoaded = false

    /// True when we should show hero space (loading shimmer or actual image)
    private var hasHeroContent: Bool {
        !heroLoaded || (diningHeroUrl != nil && !diningHeroUrl!.isEmpty)
    }

    // Venues
    @State private var facilities: [DiningFacility] = []
    @State private var loadingFacilities = true
    @State private var hasLoadedFacilitiesOnce = false
    @State private var selectedFacility: DiningFacility?

    // Menu / Order flow
    @State private var categories: [MenuCategory] = []
    @State private var loadingMenu = false
    @State private var selectedCategoryId: String?
    @State private var cart: [CartItem] = []
    @State private var tableNumber = ""
    @State private var orderNotes = ""
    @State private var placingOrder = false
    @State private var showOrderSuccess = false
    @State private var orderError: String?

    // My Activity
    @State private var myReservations: [MyDiningReservation] = []
    @State private var myOrders: [MyDiningOrder] = []
    @State private var loadingActivity = true
    @State private var hasLoadedActivityOnce = false

    // Edit Reservation
    @State private var editingReservation: MyDiningReservation?
    @State private var editPartySize: Int = 2
    @State private var editMaxPartySize: Int = 12
    @State private var editDateStr: String = ""
    @State private var editSlots: [DiningSlot] = []
    @State private var editSelectedSlot: DiningSlot?
    @State private var editLoadingSlots = false
    @State private var editSaving = false
    @State private var editError: String?
    @State private var showEditSuccess = false
    @State private var showCancelReservationAlert = false
    @State private var cancellingReservation = false

    // Reserve sheet flow
    @State private var showReserveSheet = false
    @State private var reserveStep: ReserveStep = .date
    @State private var reserveDates: [BookableDate] = []
    @State private var selectedDateStr = ""
    @State private var slots: [DiningSlot] = []
    @State private var loadingSlots = false
    @State private var selectedSlot: DiningSlot?
    @State private var partySize = 2
    @State private var seatingPreference = "any"
    @State private var specialRequests = ""
    @State private var bookingInProgress = false
    @State private var showReservationSuccess = false
    @State private var reservationError: String?

    private let seatingOptions = [
        ("any", "No Preference", "chair.lounge"),
        ("indoor", "Indoor", "building.2"),
        ("outdoor", "Outdoor", "sun.max"),
        ("bar", "Bar", "wineglass"),
        ("patio", "Patio", "leaf"),
    ]

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                Color.club.background.ignoresSafeArea()
                venueSelectionView
            }
            .navigationTitle(hasHeroContent ? "" : "Dining")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(hasHeroContent ? .hidden : .visible, for: .navigationBar)
            .navigationDestination(for: DiningRoute.self) { route in
                // Each destination applies its own nav-bar config so the
                // hero-transparent treatment doesn't leak into child views.
                ZStack {
                    Color.club.background.ignoresSafeArea()
                    switch route {
                    case .menu:
                        menuBrowsingView
                    case .cart:
                        cartView
                    }
                }
                .navigationTitle(route == .menu ? (selectedFacility?.name ?? "Menu") : "Your Order")
                .navigationBarTitleDisplayMode(.inline)
                .toolbarBackground(.visible, for: .navigationBar)
            }
        }
        .task {
            await fetchFacilities()
            async let heroTask: Void = fetchDiningHero()
            async let activityTask: Void = fetchMyActivity()
            _ = await (heroTask, activityTask)
        }
        .alert("Order Placed!", isPresented: $showOrderSuccess) {
            Button("OK") {
                resetFlow()
                path.removeAll()
            }
        } message: {
            Text("Your order has been submitted and charged to your member account.")
        }
        .alert("Reservation Confirmed!", isPresented: $showReservationSuccess) {
            Button("OK") {
                resetFlow()
                showReserveSheet = false
            }
        } message: {
            Text("Your dining reservation has been confirmed. You'll receive an email confirmation shortly.")
        }
        .sheet(isPresented: $showReserveSheet) {
            reserveSheetView
        }
        .alert("Order Error", isPresented: .constant(orderError != nil)) {
            Button("OK") { orderError = nil }
        } message: {
            Text(orderError ?? "")
        }
        .alert("Reservation Error", isPresented: .constant(reservationError != nil)) {
            Button("OK") { reservationError = nil }
        } message: {
            Text(reservationError ?? "")
        }
        .sheet(item: $editingReservation) { reservation in
            editReservationSheet(reservation)
        }
        .alert("Reservation Updated", isPresented: $showEditSuccess) {
            Button("OK") {}
        } message: {
            Text("Your reservation has been updated.")
        }
        .alert("Cancel Reservation?", isPresented: $showCancelReservationAlert) {
            Button("Keep", role: .cancel) {}
            Button("Cancel Reservation", role: .destructive) {
                if let res = editingReservation {
                    Task { await cancelReservation(res) }
                }
            }
        } message: {
            Text("This will cancel your dining reservation. This cannot be undone.")
        }
        .alert("Edit Error", isPresented: .constant(editError != nil)) {
            Button("OK") { editError = nil }
        } message: {
            Text(editError ?? "")
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Venue Selection
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var venueSelectionView: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 0) {
                // Hero — shimmer while loading, image when ready, nothing if no URL
                if !heroLoaded {
                    // API hasn't returned yet — show shimmer
                    ShimmerView()
                        .frame(height: 300)
                } else if let heroUrl = diningHeroUrl, !heroUrl.isEmpty,
                          let url = URL(string: heroUrl) {
                    // Have a hero image URL — show cached image
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

                // Flow mode toggle
                flowModeToggle
                    .padding(.horizontal, 20)
                    .padding(.top, 20)

                // My Activity section — skeleton on first load, real content after
                if loadingActivity && !hasLoadedActivityOnce {
                    activitySkeletonSection
                        .padding(.top, 20)
                        .transition(.opacity)
                } else if !myReservations.isEmpty || !myOrders.isEmpty {
                    myActivitySection
                        .padding(.top, 20)
                }

                if loadingFacilities && !hasLoadedFacilitiesOnce {
                    diningSkeleton
                        .padding(.horizontal, 20)
                        .padding(.top, 20)
                        .transition(.opacity)
                } else if facilities.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "fork.knife")
                            .font(.system(size: 32))
                            .foregroundStyle(Color.club.outlineVariant)
                        Text("No dining venues available")
                            .font(.system(size: 15))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                    .padding(.top, 40)
                } else {
                    VStack(spacing: 16) {
                        ForEach(facilities) { facility in
                            venueCard(facility)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 20)
                }

                Spacer(minLength: 32)
            }
            .animation(.easeInOut(duration: 0.25), value: loadingFacilities)
            .animation(.easeInOut(duration: 0.25), value: loadingActivity)
        }
        .ignoresSafeArea(edges: hasHeroContent ? .top : [])
    }

    // MARK: - Skeleton

    private var diningSkeleton: some View {
        VStack(spacing: 16) {
            ForEach(0..<2, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 0) {
                    RoundedRectangle(cornerRadius: 0)
                        .fill(Color.club.surfaceContainerHigh)
                        .frame(height: 120)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Placeholder venue name")
                            .font(.custom("Georgia", size: 18).weight(.semibold))
                        Text("Placeholder tagline describing this dining venue and its cuisine.")
                            .font(.system(size: 13))
                        HStack(spacing: 4) {
                            Text("Open 00:00 AM – 00:00 PM")
                                .font(.system(size: 11))
                        }
                        Text("Reserve Table")
                            .font(.system(size: 14, weight: .semibold))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(Color.club.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 10))
                            .padding(.top, 4)
                    }
                    .padding(16)
                }
                .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            }
        }
        .redacted(reason: .placeholder)
        .allowsHitTesting(false)
    }

    private var flowModeToggle: some View {
        HStack(spacing: 0) {
            ForEach([FlowMode.reserve, FlowMode.order], id: \.rawValue) { mode in
                let isSelected = flowMode == mode
                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        flowMode = mode
                    }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: mode == .reserve ? "calendar.badge.clock" : "bag.fill")
                            .font(.system(size: 13))
                        Text(mode.rawValue)
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .foregroundStyle(isSelected ? .white : Color.club.onSurfaceVariant)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background {
                        if isSelected {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.club.primary)
                                .matchedGeometryEffect(id: "toggle", in: toggleAnimation)
                        }
                    }
                    .contentShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .modifier(GlassToggleModifier())
    }

    private var diningHeroFallback: some View {
        VStack(spacing: 8) {
            Image(systemName: "fork.knife")
                .font(.system(size: 36))
                .foregroundStyle(Color.club.primary)
                .frame(width: 64, height: 64)
                .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 18))
        }
        .padding(.top, 16)
        .padding(.bottom, 8)
    }

    private func venueCard(_ facility: DiningFacility) -> some View {
        let info = venueInfo(for: facility.name)

        return Button {
            selectedFacility = facility
            if flowMode == .order {
                Task { await fetchMenu(facilityId: facility.id) }
                path.append(.menu)
            } else {
                generateDates()
                reserveStep = .date
                selectedDateStr = ""
                selectedSlot = nil
                specialRequests = ""
                seatingPreference = "any"
                showReserveSheet = true
            }
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                // Venue image or gradient fallback
                ZStack(alignment: .topLeading) {
                    if let imageUrl = facility.imageUrl, let url = URL(string: imageUrl) {
                        CachedAsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(height: 120)
                                    .clipped()
                            case .failure:
                                LinearGradient(
                                    colors: [Color.club.primaryContainer, Color(hex: "012d1d")],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                                .frame(height: 120)
                                .overlay {
                                    Image(systemName: info.icon)
                                        .font(.system(size: 40))
                                        .foregroundStyle(.white.opacity(0.15))
                                }
                            default:
                                ShimmerView()
                                    .frame(height: 120)
                            }
                        }
                    } else {
                        LinearGradient(
                            colors: [Color.club.primaryContainer, Color(hex: "012d1d")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        .frame(height: 120)
                        .overlay {
                            Image(systemName: info.icon)
                                .font(.system(size: 40))
                                .foregroundStyle(.white.opacity(0.15))
                        }
                    }

                    // Cuisine badge
                    Text(info.cuisine)
                        .font(.system(size: 9, weight: .bold))
                        .tracking(0.5)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.ultraThinMaterial.opacity(0.6), in: Capsule())
                        .padding(12)
                }
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                VStack(alignment: .leading, spacing: 8) {
                    Text(facility.name)
                        .font(.custom("Georgia", size: 18).weight(.semibold))
                        .foregroundStyle(Color.club.foreground)

                    Text(facility.description ?? info.tagline)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .lineLimit(2)

                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.system(size: 11))
                        Text(info.hours)
                            .font(.system(size: 11))
                    }
                    .foregroundStyle(Color.club.onSurfaceVariant)

                    HStack(spacing: 6) {
                        Image(systemName: flowMode == .reserve ? "calendar.badge.plus" : "book.fill")
                            .font(.system(size: 12))
                        Text(flowMode == .reserve ? "Reserve Table" : "View Menu")
                            .font(.system(size: 14, weight: .semibold))
                        Image(systemName: "arrow.right")
                            .font(.system(size: 11))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 10))
                    .padding(.top, 4)
                }
                .padding(16)
            }
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: Color.club.foreground.opacity(0.04), radius: 12, y: 4)
            .contentShape(RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Reserve Sheet (Bottom Sheet Flow)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var reserveSheetView: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                Color.club.background.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        // Step progress bar
                        reserveProgressBar
                            .padding(.top, 8)
                            .padding(.bottom, 20)

                        // Step content with transition
                        Group {
                            switch reserveStep {
                            case .date:
                                reserveDateStep
                            case .time:
                                reserveTimeStep
                            case .confirm:
                                reserveConfirmStep
                            }
                        }
                        .transition(.asymmetric(
                            insertion: .move(edge: .trailing).combined(with: .opacity),
                            removal: .move(edge: .leading).combined(with: .opacity)
                        ))
                        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: reserveStep)

                        Spacer(minLength: 120)
                    }
                }

                // Bottom action bar with glass effect
                reserveActionBar
            }
            .navigationTitle(reserveSheetTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    if reserveStep == .date {
                        Button("Cancel") { showReserveSheet = false }
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    } else {
                        Button {
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                                if reserveStep == .time {
                                    reserveStep = .date
                                    selectedSlot = nil
                                } else {
                                    reserveStep = .time
                                }
                            }
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "chevron.left")
                                    .font(.system(size: 12, weight: .semibold))
                                Text("Back")
                            }
                            .foregroundStyle(Color.club.onSurfaceVariant)
                        }
                    }
                }
            }
            .interactiveDismissDisabled(reserveStep != .date)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(24)
        .presentationBackground {
            if #available(iOS 26.0, *) {
                Color.club.background
                    .glassEffect(.regular, in: .rect(cornerRadius: 24))
            } else {
                Color.club.background
            }
        }
    }

    private var reserveSheetTitle: String {
        switch reserveStep {
        case .date: return selectedFacility?.name ?? "Reserve"
        case .time: return formattedSelectedDate
        case .confirm: return "Confirm Reservation"
        }
    }

    // Step progress indicator
    private var reserveProgressBar: some View {
        HStack(spacing: 6) {
            ForEach(ReserveStep.allCases, id: \.rawValue) { step in
                let isCurrent = step == reserveStep
                let isCompleted = step.rawValue < reserveStep.rawValue

                HStack(spacing: 4) {
                    if isCompleted {
                        Image(systemName: "checkmark")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 16, height: 16)
                            .background(Color.club.primary, in: Circle())
                    }

                    if isCurrent || !isCompleted {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(isCurrent ? Color.club.primary : Color.club.outlineVariant.opacity(0.3))
                            .frame(height: 4)
                    }
                }
                .animation(.spring(response: 0.4), value: reserveStep)
            }
        }
        .padding(.horizontal, 24)
    }

    // MARK: Step 1 — Date & Party Size

    private var reserveDateStep: some View {
        VStack(spacing: 24) {
            // Party size
            VStack(alignment: .leading, spacing: 10) {
                Text("PARTY SIZE")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1)
                    .foregroundStyle(Color.club.outline)

                let maxParty = selectedFacility?.effectiveMaxPartySize ?? 12
                if maxParty <= 8 {
                    // Grid of buttons for small max
                    HStack(spacing: 8) {
                        ForEach(1...maxParty, id: \.self) { size in
                            let isSelected = partySize == size
                            Button { withAnimation(.spring(response: 0.25)) { partySize = size } } label: {
                                VStack(spacing: 4) {
                                    Image(systemName: size == 1 ? "person.fill" : "person.\(min(size, 3)).fill")
                                        .font(.system(size: 14))
                                    Text("\(size)")
                                        .font(.system(size: 13, weight: .bold))
                                }
                                .foregroundStyle(isSelected ? .white : Color.club.onSurfaceVariant)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(
                                    isSelected ? Color.club.primary : Color.club.surfaceContainerLowest,
                                    in: RoundedRectangle(cornerRadius: 12)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(isSelected ? Color.clear : Color.club.outlineVariant.opacity(0.3), lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                } else {
                    // Stepper for larger max
                    HStack(spacing: 16) {
                        Button {
                            if partySize > 1 { withAnimation { partySize -= 1 } }
                        } label: {
                            Image(systemName: "minus.circle.fill")
                                .font(.system(size: 28))
                                .foregroundStyle(partySize > 1 ? Color.club.primary : Color.club.outlineVariant)
                        }
                        .disabled(partySize <= 1)

                        Text("\(partySize)")
                            .font(.system(size: 24, weight: .bold))
                            .foregroundStyle(Color.club.foreground)
                            .frame(width: 40)

                        Button {
                            if partySize < maxParty { withAnimation { partySize += 1 } }
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 28))
                                .foregroundStyle(partySize < maxParty ? Color.club.primary : Color.club.outlineVariant)
                        }
                        .disabled(partySize >= maxParty)

                        Spacer()
                        Text("of \(maxParty) max")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                    .padding(16)
                    .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))
                }
            }
            .padding(.horizontal, 20)

            // Date strip
            VStack(alignment: .leading, spacing: 10) {
                Text("SELECT DATE")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1)
                    .foregroundStyle(Color.club.outline)
                    .padding(.horizontal, 20)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(reserveDates) { d in
                            let isSelected = selectedDateStr == d.dateString
                            Button {
                                withAnimation(.spring(response: 0.25)) {
                                    selectedDateStr = d.dateString
                                }
                            } label: {
                                VStack(spacing: 6) {
                                    Text(d.dayName)
                                        .font(.system(size: 10, weight: .medium))
                                        .foregroundStyle(isSelected ? .white.opacity(0.8) : Color.club.onSurfaceVariant)
                                    Text(d.dayNum)
                                        .font(.system(size: 20, weight: .bold))
                                        .foregroundStyle(isSelected ? .white : Color.club.foreground)
                                    Text(d.monthName)
                                        .font(.system(size: 10))
                                        .foregroundStyle(isSelected ? .white.opacity(0.8) : Color.club.onSurfaceVariant)
                                }
                                .frame(width: 56, height: 76)
                                .background(
                                    isSelected ? Color.club.primary : Color.club.surfaceContainerLowest,
                                    in: RoundedRectangle(cornerRadius: 14)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14)
                                        .stroke(isSelected ? Color.clear : Color.club.outlineVariant.opacity(0.3), lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 20)
                }
            }
        }
    }

    // MARK: Step 2 — Time Selection

    private var reserveTimeStep: some View {
        VStack(spacing: 16) {
            // Context chip
            HStack(spacing: 6) {
                Image(systemName: "person.2.fill")
                    .font(.system(size: 11))
                Text("Party of \(partySize)")
                    .font(.system(size: 12, weight: .semibold))
                Text("·")
                    .foregroundStyle(Color.club.outline)
                Text(selectedFacility?.name ?? "")
                    .font(.system(size: 12))
            }
            .foregroundStyle(Color.club.onSurfaceVariant)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.club.surfaceContainerHigh, in: Capsule())
            .padding(.bottom, 4)

            if loadingSlots {
                ProgressView()
                    .tint(Color.club.primary)
                    .padding(.top, 40)
            } else if slots.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "clock.badge.xmark")
                        .font(.system(size: 32))
                        .foregroundStyle(Color.club.outlineVariant)
                    Text("No time slots available")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                    Text("Try a different date")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.club.outline)
                }
                .padding(.top, 40)
            } else {
                let lunchSlots = slots.filter { timeHour($0.startTime) < 15 }
                let dinnerSlots = slots.filter { timeHour($0.startTime) >= 15 }

                VStack(spacing: 24) {
                    if !lunchSlots.isEmpty {
                        slotGroup(title: "Lunch", icon: "sun.max.fill", slots: lunchSlots)
                    }
                    if !dinnerSlots.isEmpty {
                        slotGroup(title: "Dinner", icon: "moon.stars.fill", slots: dinnerSlots)
                    }
                }
            }
        }
    }

    private func slotGroup(title: String, icon: String, slots: [DiningSlot]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.club.primary)
                Text(title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.club.foreground)
            }
            .padding(.horizontal, 20)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible()),
            ], spacing: 10) {
                ForEach(Array(slots.enumerated()), id: \.offset) { _, slot in
                    let isSelected = selectedSlot?.startTime == slot.startTime
                    let isAvailable = slot.isAvailable
                    Button {
                        if isAvailable {
                            withAnimation(.spring(response: 0.25)) { selectedSlot = slot }
                        }
                    } label: {
                        VStack(spacing: 4) {
                            Text(formatSlotTime(slot.startTime))
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(
                                    !isAvailable ? Color.club.outline :
                                    isSelected ? .white : Color.club.foreground
                                )
                            if isAvailable {
                                Text("\(slot.bookingsRemaining) left")
                                    .font(.system(size: 10))
                                    .foregroundStyle(
                                        isSelected ? .white.opacity(0.8) :
                                        slot.bookingsRemaining <= 2 ? Color.red : Color.club.onSurfaceVariant
                                    )
                            } else {
                                Text("Full")
                                    .font(.system(size: 10))
                                    .foregroundStyle(Color.club.outline)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(
                            !isAvailable ? Color.club.surfaceContainerHigh.opacity(0.5) :
                            isSelected ? Color.club.primary : Color.club.surfaceContainerLowest,
                            in: RoundedRectangle(cornerRadius: 12)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(
                                    isSelected ? Color.clear :
                                    !isAvailable ? Color.clear : Color.club.outlineVariant.opacity(0.3),
                                    lineWidth: 1
                                )
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(!isAvailable)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    // MARK: Step 3 — Confirm

    private var reserveConfirmStep: some View {
        VStack(spacing: 20) {
            // Summary card
            VStack(spacing: 16) {
                HStack(spacing: 14) {
                    Image(systemName: "calendar.badge.clock")
                        .font(.system(size: 24))
                        .foregroundStyle(Color.club.primary)
                        .frame(width: 48, height: 48)
                        .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 14))

                    VStack(alignment: .leading, spacing: 4) {
                        Text(selectedFacility?.name ?? "")
                            .font(.custom("Georgia", size: 16).weight(.semibold))
                            .foregroundStyle(Color.club.foreground)
                        Text(formattedSelectedDate)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                    Spacer()
                }

                Rectangle()
                    .fill(Color.club.outlineVariant.opacity(0.2))
                    .frame(height: 1)

                HStack(spacing: 24) {
                    reserveSummaryItem(icon: "clock", label: "Time", value: formatSlotTime(selectedSlot?.startTime ?? ""))
                    reserveSummaryItem(icon: "person.2", label: "Guests", value: "\(partySize)")
                    reserveSummaryItem(icon: "chair.lounge", label: "Seating", value: seatingLabel)
                }
            }
            .padding(16)
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal, 20)

            // Seating preference
            VStack(alignment: .leading, spacing: 10) {
                Text("SEATING PREFERENCE")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1)
                    .foregroundStyle(Color.club.outline)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(seatingOptions, id: \.0) { key, label, icon in
                            let isSelected = seatingPreference == key
                            Button {
                                withAnimation(.spring(response: 0.25)) { seatingPreference = key }
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: icon)
                                        .font(.system(size: 12))
                                    Text(label)
                                        .font(.system(size: 13, weight: .medium))
                                }
                                .foregroundStyle(isSelected ? .white : Color.club.foreground)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 10)
                                .background(
                                    isSelected ? Color.club.primary : Color.club.surfaceContainerLowest,
                                    in: Capsule()
                                )
                                .overlay(
                                    Capsule()
                                        .stroke(isSelected ? Color.clear : Color.club.outlineVariant.opacity(0.3), lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.horizontal, 20)

            // Special requests
            VStack(alignment: .leading, spacing: 6) {
                Text("SPECIAL REQUESTS")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1)
                    .foregroundStyle(Color.club.outline)
                TextField("Allergies, celebrations, etc.", text: $specialRequests)
                    .font(.system(size: 15))
                    .foregroundStyle(Color.club.foreground)
                    .padding(12)
                    .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.club.outlineVariant.opacity(0.5), lineWidth: 1)
                    )
            }
            .padding(.horizontal, 20)
        }
    }

    // Bottom action bar
    private var reserveActionBar: some View {
        VStack(spacing: 0) {
            // Glass action button
            Group {
                switch reserveStep {
                case .date:
                    if !selectedDateStr.isEmpty {
                        reserveNextButton(title: "Choose Time", icon: "clock") {
                            Task {
                                if let fac = selectedFacility {
                                    await fetchSlots(facilityId: fac.id, date: selectedDateStr)
                                }
                            }
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                                reserveStep = .time
                            }
                        }
                    }
                case .time:
                    if selectedSlot != nil {
                        reserveNextButton(title: "Review Reservation", icon: "text.badge.checkmark") {
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                                reserveStep = .confirm
                            }
                        }
                    }
                case .confirm:
                    Button {
                        Task { await bookReservation() }
                    } label: {
                        Group {
                            if bookingInProgress {
                                ProgressView().tint(.white)
                            } else {
                                HStack(spacing: 8) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 16))
                                    Text("Confirm Reservation")
                                        .font(.system(size: 16, weight: .bold))
                                }
                            }
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(
                            LinearGradient(
                                colors: [Color.club.primary, Color.club.primaryContainer],
                                startPoint: .leading,
                                endPoint: .trailing
                            ),
                            in: RoundedRectangle(cornerRadius: 14)
                        )
                    }
                    .disabled(bookingInProgress)
                    .padding(.horizontal, 20)
                }
            }
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .animation(.spring(response: 0.3), value: selectedDateStr)
            .animation(.spring(response: 0.3), value: selectedSlot?.startTime)

            if reserveStep == .confirm {
                Text("You'll receive an email confirmation")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.club.outline)
                    .padding(.top, 6)
            }
        }
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    private func reserveNextButton(title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                Text(title)
                    .font(.system(size: 16, weight: .bold))
                Spacer()
                Image(systemName: "arrow.right")
                    .font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 14))
        }
        .padding(.horizontal, 20)
    }

    private func reserveSummaryItem(icon: String, label: String, value: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(Color.club.primary)
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(Color.club.outline)
            Text(value)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.club.foreground)
        }
        .frame(maxWidth: .infinity)
    }

    private var seatingLabel: String {
        seatingOptions.first(where: { $0.0 == seatingPreference })?.1 ?? "Any"
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Shared Header
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func screenHeader(title: String, subtitle: String, backAction: @escaping () -> Void) -> some View {
        HStack(spacing: 12) {
            Button(action: backAction) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                    .frame(width: 32, height: 32)
                    .background(Color.club.surfaceContainerHigh, in: Circle())
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.custom("Georgia", size: 18).weight(.semibold))
                    .foregroundStyle(Color.club.foreground)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }
            }

            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Menu Browsing (unchanged)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var menuBrowsingView: some View {
        ZStack(alignment: .bottom) {
            VStack(spacing: 0) {
                // In-content subtitle row (the nav bar shows the facility
                // name + system back button; this line keeps the tagline
                // context and a compact cart counter visible while scrolling
                // the menu).
                HStack(spacing: 12) {
                    Text(venueInfo(for: selectedFacility?.name ?? "").tagline)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .lineLimit(1)

                    Spacer()

                    if cartCount > 0 {
                        Button { path.append(.cart) } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "basket.fill")
                                    .font(.system(size: 13))
                                Text("\(cartCount)")
                                    .font(.system(size: 13, weight: .bold))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color.club.primary, in: Capsule())
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 4)

                if loadingMenu {
                    Spacer()
                    ProgressView()
                        .tint(Color.club.primary)
                    Spacer()
                } else if categories.isEmpty {
                    Spacer()
                    VStack(spacing: 12) {
                        Image(systemName: "book")
                            .font(.system(size: 32))
                            .foregroundStyle(Color.club.outlineVariant)
                        Text("No menu items available")
                            .font(.system(size: 15))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                    Spacer()
                } else {
                    // Category pills
                    Text("Browse the Menu")
                        .font(.custom("Georgia", size: 16).weight(.semibold))
                        .foregroundStyle(Color.club.foreground)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 20)
                        .padding(.top, 4)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(categories) { cat in
                                let isSelected = selectedCategoryId == cat.id
                                Button { selectedCategoryId = cat.id } label: {
                                    Text(cat.name)
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundStyle(isSelected ? .white : Color.club.foreground)
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 8)
                                        .background(
                                            isSelected ? Color.club.primary : Color.club.surfaceContainerLowest,
                                            in: Capsule()
                                        )
                                        .overlay(
                                            Capsule()
                                                .stroke(isSelected ? Color.clear : Color.club.outlineVariant.opacity(0.5), lineWidth: 1)
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 8)
                    }

                    // Menu items
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: 12) {
                            if let activeCategory = categories.first(where: { $0.id == selectedCategoryId }) {
                                ForEach(activeCategory.items) { item in
                                    menuItemCard(item)
                                }
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.bottom, cartCount > 0 ? 80 : 20)
                    }
                }
            }

            // Floating cart bar
            if cartCount > 0 {
                Button { path.append(.cart) } label: {
                    HStack {
                        HStack(spacing: 6) {
                            Image(systemName: "basket.fill")
                                .font(.system(size: 16))
                            Text("\(cartCount) \(cartCount == 1 ? "Item" : "Items")")
                                .font(.system(size: 14, weight: .semibold))
                        }

                        Spacer()

                        Text(formatPrice(subtotal))
                            .font(.system(size: 16, weight: .bold))

                        Text("View Order")
                            .font(.system(size: 13, weight: .semibold))
                            .padding(.leading, 8)

                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 16)
                    .background(
                        LinearGradient(
                            colors: [Color.club.primary, Color.club.primaryContainer],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        in: RoundedRectangle(cornerRadius: 16)
                    )
                    .shadow(color: Color.club.primary.opacity(0.3), radius: 8, y: 4)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 8)
            }
        }
    }

    private func menuItemCard(_ item: MenuItem) -> some View {
        let inCart = cart.first(where: { $0.menuItemId == item.id })

        return HStack(spacing: 12) {
            if let imageUrl = item.imageUrl, let url = URL(string: imageUrl) {
                CachedAsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    default:
                        ZStack {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(LinearGradient(
                                    colors: [Color(hex: "2e3131"), Color(hex: "191c1c")],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ))
                            Image(systemName: "fork.knife")
                                .font(.system(size: 16))
                                .foregroundStyle(.white.opacity(0.2))
                        }
                    }
                }
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(LinearGradient(
                            colors: [Color(hex: "2e3131"), Color(hex: "191c1c")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                    Image(systemName: "fork.knife")
                        .font(.system(size: 16))
                        .foregroundStyle(.white.opacity(0.2))
                }
                .frame(width: 64, height: 64)
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(item.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)
                        .lineLimit(1)
                    Spacer()
                    Text(formatPrice(item.price))
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.club.foreground)
                }

                if let desc = item.description, !desc.isEmpty {
                    Text(desc)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .lineLimit(2)
                }

                if let tags = item.dietaryTags, !tags.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(tags.prefix(3), id: \.self) { tag in
                            Text(tag)
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(Color.club.primary)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.club.accent, in: Capsule())
                        }
                    }
                }

                HStack {
                    Spacer()
                    if let inCart {
                        HStack(spacing: 12) {
                            Button { updateQuantity(item.id, delta: -1) } label: {
                                Image(systemName: "minus")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(Color.club.primary)
                                    .frame(width: 28, height: 28)
                                    .background(Color.club.accent, in: Circle())
                            }

                            Text("\(inCart.quantity)")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(Color.club.foreground)

                            Button { updateQuantity(item.id, delta: 1) } label: {
                                Image(systemName: "plus")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(.white)
                                    .frame(width: 28, height: 28)
                                    .background(Color.club.primary, in: Circle())
                            }
                        }
                    } else {
                        Button { addToCart(item) } label: {
                            Image(systemName: "plus")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 32, height: 32)
                                .background(Color.club.primary, in: Circle())
                        }
                    }
                }
            }
        }
        .padding(12)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))
        .shadow(color: Color.club.foreground.opacity(0.03), radius: 8, y: 2)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Cart / Checkout
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var cartView: some View {
        ZStack(alignment: .bottom) {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 20) {
                    // Facility context line under the nav title. The
                    // native back button (upper-left) returns to menu.
                    if let facilityName = selectedFacility?.name, !facilityName.isEmpty {
                        Text(facilityName)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 20)
                            .padding(.top, 8)
                    }

                    // Cart items
                    VStack(spacing: 10) {
                        ForEach(cart) { item in
                            cartItemRow(item)
                        }
                    }
                    .padding(.horizontal, 20)

                    // Table number
                    VStack(alignment: .leading, spacing: 6) {
                        Text("TABLE NUMBER")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Color.club.outline)
                        TextField("Optional", text: $tableNumber)
                            .font(.system(size: 15))
                            .foregroundStyle(Color.club.foreground)
                            .padding(12)
                            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color.club.outlineVariant.opacity(0.5), lineWidth: 1)
                            )
                    }
                    .padding(.horizontal, 20)

                    // Notes
                    VStack(alignment: .leading, spacing: 6) {
                        Text("SPECIAL REQUESTS")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Color.club.outline)
                        TextField("Dietary notes or requests", text: $orderNotes)
                            .font(.system(size: 15))
                            .foregroundStyle(Color.club.foreground)
                            .padding(12)
                            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color.club.outlineVariant.opacity(0.5), lineWidth: 1)
                            )
                    }
                    .padding(.horizontal, 20)

                    // Totals
                    totalsSection

                    Spacer(minLength: 120)
                }
                .padding(.top, 8)
            }

            // Place order button
            VStack(spacing: 8) {
                Divider()
                Button {
                    Task { await placeOrder() }
                } label: {
                    Group {
                        if placingOrder {
                            ProgressView().tint(.white)
                        } else {
                            HStack(spacing: 8) {
                                Image(systemName: "fork.knife")
                                    .font(.system(size: 14))
                                Text("Place Order")
                                    .font(.system(size: 16, weight: .bold))
                            }
                        }
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        LinearGradient(
                            colors: [Color.club.primary, Color.club.primaryContainer],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        in: RoundedRectangle(cornerRadius: 14)
                    )
                }
                .disabled(placingOrder || cart.isEmpty)
                .padding(.horizontal, 20)

                Text("By placing this order, you authorize the charge to your Member Account")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.club.outline)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
            }
            .background(.ultraThinMaterial)
        }
    }

    private func cartItemRow(_ item: CartItem) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "fork.knife")
                .font(.system(size: 14))
                .foregroundStyle(Color.club.primary)
                .frame(width: 32, height: 32)
                .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                Text(formatPrice(item.price) + " each")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }

            Spacer()

            HStack(spacing: 10) {
                Button { updateQuantity(item.menuItemId, delta: -1) } label: {
                    Image(systemName: "minus")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.club.primary)
                        .frame(width: 24, height: 24)
                        .background(Color.club.accent, in: Circle())
                }

                Text("\(item.quantity)")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.club.foreground)
                    .frame(width: 20)

                Button { updateQuantity(item.menuItemId, delta: 1) } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Color.club.primary)
                        .frame(width: 24, height: 24)
                        .background(Color.club.accent, in: Circle())
                }
            }

            Text(formatPrice(item.price * Double(item.quantity)))
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.club.foreground)
                .frame(width: 60, alignment: .trailing)
        }
        .padding(12)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 12))
    }

    private var totalsSection: some View {
        VStack(spacing: 10) {
            HStack {
                Text("Subtotal")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                Spacer()
                Text(formatPrice(subtotal))
                    .font(.system(size: 14))
                    .foregroundStyle(Color.club.foreground)
            }

            HStack {
                Text("Tax (8%)")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                Spacer()
                Text(formatPrice(tax))
                    .font(.system(size: 14))
                    .foregroundStyle(Color.club.foreground)
            }

            HStack {
                Text("Service Charge (18%)")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                Spacer()
                Text(formatPrice(serviceCharge))
                    .font(.system(size: 14))
                    .foregroundStyle(Color.club.foreground)
            }

            Rectangle()
                .fill(Color.club.outlineVariant.opacity(0.3))
                .frame(height: 1)

            HStack {
                Text("Total")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color.club.foreground)
                Spacer()
                Text(formatPrice(total))
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color.club.primary)
            }
        }
        .padding(16)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 20)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Cart Helpers
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var cartCount: Int {
        cart.reduce(0) { $0 + $1.quantity }
    }

    private var subtotal: Double {
        cart.reduce(0) { $0 + $1.price * Double($1.quantity) }
    }

    private var tax: Double {
        (subtotal * TAX_RATE * 100).rounded() / 100
    }

    private var serviceCharge: Double {
        (subtotal * SERVICE_CHARGE_RATE * 100).rounded() / 100
    }

    private var total: Double {
        ((subtotal + tax + serviceCharge) * 100).rounded() / 100
    }

    private func addToCart(_ item: MenuItem) {
        if let index = cart.firstIndex(where: { $0.menuItemId == item.id }) {
            cart[index].quantity += 1
        } else {
            cart.append(CartItem(menuItemId: item.id, name: item.name, price: item.price, quantity: 1))
        }
    }

    private func updateQuantity(_ menuItemId: String, delta: Int) {
        if let index = cart.firstIndex(where: { $0.menuItemId == menuItemId }) {
            cart[index].quantity += delta
            if cart[index].quantity <= 0 {
                cart.remove(at: index)
            }
        }
    }

    private func formatPrice(_ price: Double) -> String {
        String(format: "$%.2f", price)
    }

    private func resetFlow() {
        selectedFacility = nil
        categories = []
        selectedCategoryId = nil
        cart = []
        tableNumber = ""
        orderNotes = ""
        // Reset reservation state
        selectedDateStr = ""
        slots = []
        selectedSlot = nil
        partySize = 2
        seatingPreference = "any"
        specialRequests = ""
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Date / Time Helpers
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func generateDates() {
        let cal = Calendar.current
        let today = Date()
        reserveDates = (0..<14).compactMap { offset -> BookableDate? in
            guard let date = cal.date(byAdding: .day, value: offset, to: today) else { return nil }
            let df = DateFormatter()
            df.dateFormat = "yyyy-MM-dd"
            let dateString = df.string(from: date)

            df.dateFormat = "EEE"
            let dayLabel = df.string(from: date).uppercased()

            df.dateFormat = "d"
            let dayNumber = df.string(from: date)

            df.dateFormat = "MMM"
            let monthLabel = df.string(from: date)

            return BookableDate(dateString: dateString, dayName: dayLabel, dayNum: dayNumber, monthName: monthLabel)
        }
    }

    private var formattedSelectedDate: String {
        guard !selectedDateStr.isEmpty else { return "" }
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        guard let date = df.date(from: selectedDateStr) else { return selectedDateStr }
        df.dateFormat = "EEEE, MMMM d"
        return df.string(from: date)
    }

    private func timeHour(_ time: String) -> Int {
        let parts = time.split(separator: ":")
        return Int(parts.first ?? "0") ?? 0
    }

    private func formatSlotTime(_ time: String) -> String {
        let parts = time.split(separator: ":")
        guard parts.count >= 2, let hour = Int(parts[0]), let min = Int(parts[1]) else { return time }
        let period = hour >= 12 ? "PM" : "AM"
        let h = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour)
        return min == 0 ? "\(h) \(period)" : "\(h):\(String(format: "%02d", min)) \(period)"
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - My Activity Section
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var myActivitySection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Your Activity")
                .font(.custom("Georgia", size: 18).weight(.bold))
                .foregroundStyle(Color.club.foreground)
                .padding(.horizontal, 20)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    // Reservations
                    ForEach(myReservations) { res in
                        Button { openEditReservation(res) } label: {
                            reservationCard(res)
                        }
                        .buttonStyle(.plain)
                    }
                    // Active orders
                    ForEach(myOrders) { order in
                        orderCard(order)
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }

    private var activitySkeletonSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Your Activity")
                .font(.custom("Georgia", size: 18).weight(.bold))
                .foregroundStyle(Color.club.foreground)
                .padding(.horizontal, 20)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(0..<2, id: \.self) { _ in
                        activitySkeletonCard
                    }
                }
                .padding(.horizontal, 20)
            }
            .redacted(reason: .placeholder)
            .allowsHitTesting(false)
        }
    }

    private var activitySkeletonCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "calendar.badge.clock")
                    .font(.system(size: 13))
                Text("Reservation")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.5)
                Spacer()
                Text("Status")
                    .font(.system(size: 10, weight: .bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.club.surfaceContainerHigh, in: Capsule())
            }
            Text("Placeholder venue name")
                .font(.system(size: 15, weight: .semibold))
            HStack(spacing: 12) {
                Label("Placeholder date", systemImage: "calendar")
                Label("0:00 PM", systemImage: "clock")
            }
            .font(.system(size: 12))
            HStack {
                HStack(spacing: 4) {
                    Image(systemName: "person.2").font(.system(size: 11))
                    Text("Party of 0").font(.system(size: 12, weight: .medium))
                }
                Spacer()
                Text("Edit").font(.system(size: 12, weight: .semibold))
            }
        }
        .padding(16)
        .frame(width: 240)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
    }

    private func reservationCard(_ res: MyDiningReservation) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "calendar.badge.clock")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.club.primary)
                Text("Reservation")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(Color.club.primary)
                Spacer()
                Text(res.status.capitalized)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(statusColor(res.status))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(statusColor(res.status).opacity(0.12), in: Capsule())
            }

            Text(res.facilityName ?? "Dining")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.club.foreground)
                .lineLimit(1)

            HStack(spacing: 12) {
                Label(formatActivityDate(res.date), systemImage: "calendar")
                Label(formatActivityTime(res.startTime), systemImage: "clock")
            }
            .font(.system(size: 12))
            .foregroundStyle(Color.club.onSurfaceVariant)

            HStack {
                HStack(spacing: 4) {
                    Image(systemName: "person.2")
                        .font(.system(size: 11))
                    Text("Party of \(res.partySize)")
                        .font(.system(size: 12, weight: .medium))
                }
                .foregroundStyle(Color.club.onSurfaceVariant)

                Spacer()

                HStack(spacing: 4) {
                    Text("Edit")
                        .font(.system(size: 12, weight: .semibold))
                    Image(systemName: "chevron.right")
                        .font(.system(size: 10))
                }
                .foregroundStyle(Color.club.primary)
            }
        }
        .padding(16)
        .frame(width: 240)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.club.foreground.opacity(0.04), radius: 8, y: 4)
    }

    private func orderCard(_ order: MyDiningOrder) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "bag.fill")
                    .font(.system(size: 13))
                    .foregroundStyle(Color(hex: "ea580c"))
                Text("Order")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(Color(hex: "ea580c"))
                Spacer()
                Text(orderStatusLabel(order.status))
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(statusColor(order.status))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(statusColor(order.status).opacity(0.12), in: Capsule())
            }

            Text(order.facilityName)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.club.foreground)
                .lineLimit(1)

            // Item summary
            Text(order.items.prefix(3).map { "\($0.quantity)× \($0.name)" }.joined(separator: ", "))
                .font(.system(size: 12))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .lineLimit(2)

            HStack {
                if let table = order.tableNumber, !table.isEmpty {
                    Label("Table \(table)", systemImage: "tablecells")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }
                Spacer()
                Text(formatPrice(order.total))
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.club.foreground)
            }
        }
        .padding(16)
        .frame(width: 240)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.club.foreground.opacity(0.04), radius: 8, y: 4)
    }

    private func orderStatusLabel(_ status: String) -> String {
        switch status {
        case "pending": return "Pending"
        case "confirmed": return "Confirmed"
        case "preparing": return "Preparing"
        case "ready": return "Ready"
        default: return status.capitalized
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "confirmed": return Color(hex: "16a34a")
        case "pending": return Color(hex: "d97706")
        case "preparing": return Color(hex: "2563eb")
        case "ready": return Color(hex: "16a34a")
        default: return Color(hex: "6b7280")
        }
    }

    private func formatActivityDate(_ dateStr: String) -> String {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        guard let date = df.date(from: dateStr) else { return dateStr }
        let cal = Calendar.current
        if cal.isDateInToday(date) { return "Today" }
        if cal.isDateInTomorrow(date) { return "Tomorrow" }
        df.dateFormat = "EEE, MMM d"
        return df.string(from: date)
    }

    private func formatActivityTime(_ time: String) -> String {
        let parts = time.split(separator: ":")
        guard parts.count >= 2, let hour = Int(parts[0]), let min = Int(parts[1]) else { return time }
        let period = hour >= 12 ? "PM" : "AM"
        let h = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour)
        return min == 0 ? "\(h) \(period)" : "\(h):\(String(format: "%02d", min)) \(period)"
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Edit Reservation Sheet
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func openEditReservation(_ res: MyDiningReservation) {
        editPartySize = res.partySize
        editDateStr = res.date
        editSelectedSlot = nil
        editSlots = []
        editError = nil
        // Look up facility max party size
        if let facId = res.facilityId,
           let fac = facilities.first(where: { $0.id == facId }) {
            editMaxPartySize = fac.effectiveMaxPartySize
        } else {
            editMaxPartySize = 12
        }
        // Clamp current party size to max
        if editPartySize > editMaxPartySize {
            editPartySize = editMaxPartySize
        }
        editingReservation = res
        // Load available slots for the current date
        if let facId = res.facilityId {
            Task { await fetchEditSlots(facilityId: facId, date: res.date) }
        }
    }

    private func editReservationSheet(_ reservation: MyDiningReservation) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {

                    // Header
                    VStack(alignment: .leading, spacing: 6) {
                        Text(reservation.facilityName ?? "Dining")
                            .font(.custom("Georgia", size: 22).weight(.bold))
                            .foregroundStyle(Color.club.foreground)
                        HStack(spacing: 6) {
                            Image(systemName: "calendar.badge.clock")
                                .font(.system(size: 13))
                            Text("Edit Reservation")
                                .font(.system(size: 14))
                        }
                        .foregroundStyle(Color.club.onSurfaceVariant)
                    }

                    // Date picker
                    VStack(alignment: .leading, spacing: 10) {
                        Text("DATE")
                            .font(.system(size: 11, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Color.club.outline)

                        let editDates = generateEditDates()
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(editDates) { d in
                                    let isSelected = editDateStr == d.dateString
                                    Button {
                                        editDateStr = d.dateString
                                        editSelectedSlot = nil
                                        if let facId = reservation.facilityId {
                                            Task { await fetchEditSlots(facilityId: facId, date: d.dateString) }
                                        }
                                    } label: {
                                        VStack(spacing: 4) {
                                            Text(d.dayName)
                                                .font(.system(size: 10, weight: .semibold))
                                                .tracking(0.5)
                                            Text(d.dayNum)
                                                .font(.system(size: 18, weight: .bold))
                                            Text(d.monthName)
                                                .font(.system(size: 10))
                                        }
                                        .foregroundStyle(isSelected ? .white : Color.club.foreground)
                                        .frame(width: 56, height: 72)
                                        .background(
                                            isSelected ? Color.club.primary : Color.club.surfaceContainerLowest,
                                            in: RoundedRectangle(cornerRadius: 14)
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 14)
                                                .stroke(isSelected ? Color.clear : Color.club.outlineVariant.opacity(0.3), lineWidth: 1)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    // Time slots
                    VStack(alignment: .leading, spacing: 10) {
                        Text("TIME")
                            .font(.system(size: 11, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Color.club.outline)

                        if editLoadingSlots {
                            ProgressView()
                                .tint(Color.club.primary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 20)
                        } else if editSlots.isEmpty {
                            Text("No available times for this date")
                                .font(.system(size: 14))
                                .foregroundStyle(Color.club.onSurfaceVariant)
                                .padding(.vertical, 12)
                        } else {
                            let columns = [GridItem(.adaptive(minimum: 90), spacing: 8)]
                            LazyVGrid(columns: columns, spacing: 8) {
                                ForEach(editSlots.filter(\.isAvailable), id: \.startTime) { slot in
                                    let isSelected = editSelectedSlot?.startTime == slot.startTime
                                    Button {
                                        editSelectedSlot = slot
                                    } label: {
                                        Text(formatActivityTime(slot.startTime))
                                            .font(.system(size: 13, weight: .semibold))
                                            .foregroundStyle(isSelected ? .white : Color.club.foreground)
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 10)
                                            .background(
                                                isSelected ? Color.club.primary : Color.club.surfaceContainerLowest,
                                                in: RoundedRectangle(cornerRadius: 10)
                                            )
                                            .overlay(
                                                RoundedRectangle(cornerRadius: 10)
                                                    .stroke(isSelected ? Color.clear : Color.club.outlineVariant.opacity(0.3), lineWidth: 1)
                                            )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    // Party size
                    VStack(alignment: .leading, spacing: 10) {
                        Text("PARTY SIZE")
                            .font(.system(size: 11, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Color.club.outline)

                        HStack(spacing: 16) {
                            Button {
                                if editPartySize > 1 { editPartySize -= 1 }
                            } label: {
                                Image(systemName: "minus.circle.fill")
                                    .font(.system(size: 28))
                                    .foregroundStyle(editPartySize > 1 ? Color.club.primary : Color.club.outlineVariant)
                            }
                            .disabled(editPartySize <= 1)

                            Text("\(editPartySize)")
                                .font(.system(size: 24, weight: .bold))
                                .foregroundStyle(Color.club.foreground)
                                .frame(width: 40)
                                .multilineTextAlignment(.center)

                            Button {
                                if editPartySize < editMaxPartySize { editPartySize += 1 }
                            } label: {
                                Image(systemName: "plus.circle.fill")
                                    .font(.system(size: 28))
                                    .foregroundStyle(editPartySize < editMaxPartySize ? Color.club.primary : Color.club.outlineVariant)
                            }
                            .disabled(editPartySize >= editMaxPartySize)

                            Spacer()

                            Text(editPartySize == 1 ? "Guest" : "Guests")
                                .font(.system(size: 14))
                                .foregroundStyle(Color.club.onSurfaceVariant)
                        }
                        .padding(16)
                        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))
                    }

                    // Save button
                    Button {
                        Task { await saveReservationEdit(reservation) }
                    } label: {
                        HStack {
                            if editSaving {
                                ProgressView().tint(.white)
                            }
                            Text("Save Changes")
                                .font(.system(size: 16, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(editSaving)

                    // Cancel reservation
                    Button {
                        showCancelReservationAlert = true
                    } label: {
                        Text("Cancel Reservation")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.club.destructive)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(Color.club.destructive.opacity(0.25), lineWidth: 1)
                            )
                    }
                    .disabled(cancellingReservation)
                }
                .padding(20)
            }
            .background(Color.club.background)
            .navigationTitle("Edit Reservation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { editingReservation = nil }
                }
            }
        }
        .presentationDetents([.large])
    }

    private func generateEditDates() -> [BookableDate] {
        let cal = Calendar.current
        let today = Date()
        return (0..<14).compactMap { offset -> BookableDate? in
            guard let date = cal.date(byAdding: .day, value: offset, to: today) else { return nil }
            let df = DateFormatter()
            df.dateFormat = "yyyy-MM-dd"
            let dateString = df.string(from: date)
            df.dateFormat = "EEE"
            let dayLabel = df.string(from: date).uppercased()
            df.dateFormat = "d"
            let dayNumber = df.string(from: date)
            df.dateFormat = "MMM"
            let monthLabel = df.string(from: date)
            return BookableDate(dateString: dateString, dayName: dayLabel, dayNum: dayNumber, monthName: monthLabel)
        }
    }

    private func fetchEditSlots(facilityId: String, date: String) async {
        editLoadingSlots = true
        editSelectedSlot = nil
        defer { editLoadingSlots = false }

        do {
            let response: DiningSlotsResponse = try await APIClient.shared.get("/dining/availability", query: [
                "facility_id": facilityId,
                "date": date,
            ])
            editSlots = response.slots
        } catch {
            editSlots = []
        }
    }

    private func saveReservationEdit(_ reservation: MyDiningReservation) async {
        editSaving = true
        defer { editSaving = false }

        struct ModifyRequest: Encodable {
            var date: String?
            var startTime: String?
            var endTime: String?
            var partySize: Int?
        }

        var changes = ModifyRequest()
        var hasChanges = false

        // Date changed?
        if editDateStr != reservation.date {
            changes.date = editDateStr
            hasChanges = true
        }

        // Time changed?
        if let slot = editSelectedSlot {
            let currentTime = String(reservation.startTime.prefix(5))
            let newTime = String(slot.startTime.prefix(5))
            if newTime != currentTime {
                changes.startTime = newTime
                changes.endTime = String(slot.endTime.prefix(5))
                hasChanges = true
            }
        }

        // Party size changed?
        if editPartySize != reservation.partySize {
            changes.partySize = editPartySize
            hasChanges = true
        }

        guard hasChanges else {
            editingReservation = nil
            return
        }

        do {
            try await APIClient.shared.patch("/bookings/\(reservation.id)/modify", body: changes)
            editingReservation = nil
            showEditSuccess = true
            await fetchMyActivity()
        } catch {
            editError = error.localizedDescription
        }
    }

    private func cancelReservation(_ reservation: MyDiningReservation) async {
        cancellingReservation = true
        defer { cancellingReservation = false }

        do {
            try await APIClient.shared.patch("/bookings/\(reservation.id)/cancel")
            editingReservation = nil
            myReservations.removeAll { $0.id == reservation.id }
        } catch {
            editError = error.localizedDescription
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - API Calls
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func fetchMyActivity() async {
        loadingActivity = true
        defer {
            loadingActivity = false
            hasLoadedActivityOnce = true
        }

        async let reservationsTask: MyDiningReservationsResponse? = try? await APIClient.shared.get(
            "/bookings/my", query: ["type": "dining"]
        )
        async let ordersTask: MyDiningOrdersResponse? = try? await APIClient.shared.get("/dining/orders/my")

        let (resResult, ordResult) = await (reservationsTask, ordersTask)
        // Preserve cached activity on failure — only overwrite on success.
        if let r = resResult { myReservations = r.bookings }
        if let o = ordResult { myOrders = o.orders }
    }

    private func fetchFacilities() async {
        loadingFacilities = true
        defer {
            loadingFacilities = false
            hasLoadedFacilitiesOnce = true
        }

        do {
            let response: DiningFacilitiesResponse = try await APIClient.shared.get("/facilities", query: ["type": "dining"])
            facilities = response.facilities
        } catch {
            // Preserve cached facilities on failure — don't wipe the list.
            print("Failed to fetch dining facilities:", error)
        }
    }

    private func fetchDiningHero() async {
        // Check cache first for instant display
        if let cached = await AppCacheService.shared.getString("dining_hero_url") {
            diningHeroUrl = cached
            heroLoaded = true
        }

        // Always fetch fresh from API (updates cache for next time)
        do {
            let response: DiningHeroResponse = try await APIClient.shared.get("/club/dining-image")
            let url = response.diningImageUrl ?? ""
            diningHeroUrl = url
            heroLoaded = true
            await AppCacheService.shared.setString(url, forKey: "dining_hero_url")
        } catch {
            // If we had a cached value, keep showing it
            if !heroLoaded {
                heroLoaded = true  // Stop shimmer, show nothing
            }
            print("Failed to fetch dining hero:", error)
        }
    }

    private func fetchMenu(facilityId: String) async {
        loadingMenu = true
        defer { loadingMenu = false }

        do {
            let response: MenuResponse = try await APIClient.shared.get("/dining/menu", query: ["facility_id": facilityId])
            categories = response.categories
            if let first = response.categories.first {
                selectedCategoryId = first.id
            }
        } catch {
            print("Failed to fetch menu:", error)
        }
    }

    private func fetchSlots(facilityId: String, date: String) async {
        loadingSlots = true
        selectedSlot = nil
        defer { loadingSlots = false }

        do {
            let response: DiningSlotsResponse = try await APIClient.shared.get("/dining/availability", query: [
                "facility_id": facilityId,
                "date": date,
            ])
            slots = response.slots
        } catch {
            print("Failed to fetch dining slots:", error)
            slots = []
        }
    }

    private func placeOrder() async {
        guard let facility = selectedFacility, !cart.isEmpty else { return }
        placingOrder = true
        defer { placingOrder = false }

        struct OrderItem: Encodable {
            let menuItemId: String
            let quantity: Int
        }

        struct OrderRequest: Encodable {
            let facilityId: String
            let tableNumber: String?
            let notes: String?
            let items: [OrderItem]
        }

        do {
            let _: DiningOrderResponse = try await APIClient.shared.post("/dining/orders", body: OrderRequest(
                facilityId: facility.id,
                tableNumber: tableNumber.isEmpty ? nil : tableNumber,
                notes: orderNotes.isEmpty ? nil : orderNotes,
                items: cart.map { OrderItem(menuItemId: $0.menuItemId, quantity: $0.quantity) }
            ))
            showOrderSuccess = true
        } catch {
            orderError = error.localizedDescription
        }
    }

    private func bookReservation() async {
        guard let facility = selectedFacility, let slot = selectedSlot else { return }
        bookingInProgress = true
        defer { bookingInProgress = false }

        struct ReservationRequest: Encodable {
            let facilityId: String
            let date: String
            let startTime: String
            let endTime: String
            let partySize: Int
            let notes: String?
        }

        let notes = [
            seatingPreference != "any" ? "Seating: \(seatingLabel)" : nil,
            specialRequests.isEmpty ? nil : specialRequests,
        ].compactMap { $0 }.joined(separator: " | ")

        do {
            let _: DiningBookingResponse = try await APIClient.shared.post("/bookings", body: ReservationRequest(
                facilityId: facility.id,
                date: selectedDateStr,
                startTime: slot.startTime,
                endTime: slot.endTime,
                partySize: partySize,
                notes: notes.isEmpty ? nil : notes
            ))
            showReservationSuccess = true
        } catch {
            reservationError = error.localizedDescription
        }
    }
}
