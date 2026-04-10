import SwiftUI

// MARK: - Dining Models

struct DiningFacility: Decodable, Identifiable {
    let id: String
    let name: String
    let type: String
    let description: String?
}

struct DiningFacilitiesResponse: Decodable {
    let facilities: [DiningFacility]
}

struct MenuCategory: Decodable, Identifiable {
    let id: String
    let name: String
    let description: String?
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

// MARK: - Dining View

struct DiningView: View {
    enum Screen { case venues, menu, cart, reserveDate, reserveTime, reserveConfirm }
    enum FlowMode: String { case reserve = "Reserve", order = "Order" }

    @State private var screen: Screen = .venues
    @State private var flowMode: FlowMode = .reserve

    // Venues
    @State private var facilities: [DiningFacility] = []
    @State private var loadingFacilities = true
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

    // Reserve flow
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
        ZStack {
            Color.club.background.ignoresSafeArea()

            switch screen {
            case .venues:
                venueSelectionView
            case .menu:
                menuBrowsingView
            case .cart:
                cartView
            case .reserveDate:
                reserveDateView
            case .reserveTime:
                reserveTimeView
            case .reserveConfirm:
                reserveConfirmView
            }
        }
        .navigationTitle(navTitle)
        .navigationBarTitleDisplayMode(.inline)
        .task { await fetchFacilities() }
        .alert("Order Placed!", isPresented: $showOrderSuccess) {
            Button("OK") {
                resetFlow()
                screen = .venues
            }
        } message: {
            Text("Your order has been submitted and charged to your member account.")
        }
        .alert("Reservation Confirmed!", isPresented: $showReservationSuccess) {
            Button("OK") {
                resetFlow()
                screen = .venues
            }
        } message: {
            Text("Your dining reservation has been confirmed. You'll receive an email confirmation shortly.")
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
    }

    private var navTitle: String {
        switch screen {
        case .venues: return "Dining"
        case .menu: return selectedFacility?.name ?? "Menu"
        case .cart: return "Your Order"
        case .reserveDate: return "Select Date"
        case .reserveTime: return "Select Time"
        case .reserveConfirm: return "Confirm Reservation"
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Venue Selection
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var venueSelectionView: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 24) {
                // Hero
                VStack(spacing: 8) {
                    Image(systemName: "fork.knife")
                        .font(.system(size: 36))
                        .foregroundStyle(Color.club.primary)
                        .frame(width: 64, height: 64)
                        .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 18))

                    Text("Dining at The Lakes")
                        .font(.custom("Georgia", size: 22).weight(.bold))
                        .foregroundStyle(Color.club.foreground)

                    Text("Reserve a table or order from our world-class restaurants.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
                .padding(.top, 16)
                .padding(.bottom, 8)

                // Flow mode toggle
                flowModeToggle
                    .padding(.horizontal, 20)

                if loadingFacilities {
                    ProgressView()
                        .tint(Color.club.primary)
                        .padding(.top, 40)
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
                }

                Spacer(minLength: 32)
            }
        }
    }

    private var flowModeToggle: some View {
        HStack(spacing: 0) {
            ForEach([FlowMode.reserve, FlowMode.order], id: \.rawValue) { mode in
                let isSelected = flowMode == mode
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { flowMode = mode }
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
                    .background(
                        isSelected ? Color.club.primary : Color.clear,
                        in: RoundedRectangle(cornerRadius: 12)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Color.club.surfaceContainerHigh, in: RoundedRectangle(cornerRadius: 14))
    }

    private func venueCard(_ facility: DiningFacility) -> some View {
        let info = venueInfo(for: facility.name)

        return Button {
            selectedFacility = facility
            if flowMode == .order {
                Task { await fetchMenu(facilityId: facility.id) }
                screen = .menu
            } else {
                generateDates()
                screen = .reserveDate
            }
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                // Venue image gradient
                ZStack(alignment: .topLeading) {
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
        }
        .buttonStyle(.plain)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Reserve: Date Selection
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var reserveDateView: some View {
        VStack(spacing: 0) {
            // Header
            screenHeader(
                title: selectedFacility?.name ?? "Reservation",
                subtitle: "Select a date for your dining experience",
                backAction: { screen = .venues; selectedDateStr = "" }
            )

            ScrollView(showsIndicators: false) {
                VStack(spacing: 24) {
                    // Party size selector
                    VStack(alignment: .leading, spacing: 10) {
                        Text("PARTY SIZE")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Color.club.outline)

                        HStack(spacing: 8) {
                            ForEach(1...6, id: \.self) { size in
                                let isSelected = partySize == size
                                Button { partySize = size } label: {
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
                                        selectedDateStr = d.dateString
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

                    Spacer(minLength: 60)
                }
                .padding(.top, 16)
            }

            // Continue button
            if !selectedDateStr.isEmpty {
                VStack(spacing: 8) {
                    Divider()
                    Button {
                        Task {
                            if let fac = selectedFacility {
                                await fetchSlots(facilityId: fac.id, date: selectedDateStr)
                            }
                        }
                        screen = .reserveTime
                    } label: {
                        HStack(spacing: 8) {
                            Text("Choose Time")
                                .font(.system(size: 16, weight: .bold))
                            Image(systemName: "arrow.right")
                                .font(.system(size: 14, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
                }
                .background(.ultraThinMaterial)
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Reserve: Time Selection
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var reserveTimeView: some View {
        VStack(spacing: 0) {
            screenHeader(
                title: formattedSelectedDate,
                subtitle: "\(selectedFacility?.name ?? "") · Party of \(partySize)",
                backAction: { screen = .reserveDate; selectedSlot = nil }
            )

            if loadingSlots {
                Spacer()
                ProgressView()
                    .tint(Color.club.primary)
                Spacer()
            } else if slots.isEmpty {
                Spacer()
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
                Spacer()
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 24) {
                        // Group by Lunch / Dinner
                        let lunchSlots = slots.filter { timeHour($0.startTime) < 15 }
                        let dinnerSlots = slots.filter { timeHour($0.startTime) >= 15 }

                        if !lunchSlots.isEmpty {
                            slotGroup(title: "Lunch", icon: "sun.max.fill", slots: lunchSlots)
                        }

                        if !dinnerSlots.isEmpty {
                            slotGroup(title: "Dinner", icon: "moon.stars.fill", slots: dinnerSlots)
                        }

                        Spacer(minLength: 80)
                    }
                    .padding(.top, 16)
                }
            }

            // Continue
            if selectedSlot != nil {
                VStack(spacing: 8) {
                    Divider()
                    Button {
                        screen = .reserveConfirm
                    } label: {
                        HStack(spacing: 8) {
                            Text("Review Reservation")
                                .font(.system(size: 16, weight: .bold))
                            Image(systemName: "arrow.right")
                                .font(.system(size: 14, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
                }
                .background(.ultraThinMaterial)
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
                        if isAvailable { selectedSlot = slot }
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Reserve: Confirm
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var reserveConfirmView: some View {
        ZStack(alignment: .bottom) {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 20) {
                    screenHeader(
                        title: "Confirm Reservation",
                        subtitle: selectedFacility?.name ?? "",
                        backAction: { screen = .reserveTime }
                    )

                    // Reservation summary card
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
                                    Button { seatingPreference = key } label: {
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

                    Spacer(minLength: 120)
                }
                .padding(.top, 8)
            }

            // Confirm button
            VStack(spacing: 8) {
                Divider()
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

                Text("You'll receive an email confirmation for your reservation")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.club.outline)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
            }
            .background(.ultraThinMaterial)
        }
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
                // Header
                HStack(spacing: 12) {
                    Button {
                        screen = .venues
                        categories = []
                        cart = []
                        selectedCategoryId = nil
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                            .frame(width: 32, height: 32)
                            .background(Color.club.surfaceContainerHigh, in: Circle())
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(selectedFacility?.name ?? "")
                            .font(.custom("Georgia", size: 18).weight(.semibold))
                            .foregroundStyle(Color.club.foreground)
                        Text(venueInfo(for: selectedFacility?.name ?? "").tagline)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }

                    Spacer()

                    if cartCount > 0 {
                        Button { screen = .cart } label: {
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
                .padding(.vertical, 12)

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
                Button { screen = .cart } label: {
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
                    screenHeader(
                        title: "Your Order",
                        subtitle: selectedFacility?.name ?? "",
                        backAction: { screen = .menu }
                    )

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
    // MARK: - API Calls
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func fetchFacilities() async {
        loadingFacilities = true
        defer { loadingFacilities = false }

        do {
            let response: DiningFacilitiesResponse = try await APIClient.shared.get("/facilities", query: ["type": "dining"])
            facilities = response.facilities
        } catch {
            print("Failed to fetch dining facilities:", error)
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
