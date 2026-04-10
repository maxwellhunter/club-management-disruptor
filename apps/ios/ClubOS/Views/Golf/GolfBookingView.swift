import SwiftUI

// MARK: - Models

struct GolfFacility: Decodable, Identifiable {
    let id: String
    let name: String
    let type: String
    let description: String?
    let capacity: Int?
}

struct FacilitiesResponse: Decodable {
    let facilities: [GolfFacility]
}

struct TeeTimeSlot: Decodable, Identifiable {
    var id: String { startTime }
    let startTime: String
    let endTime: String
    let isAvailable: Bool
    let bookingId: String?
    let waitlistCount: Int
    let onWaitlist: Bool
}

struct TeeSlotsResponse: Decodable {
    let facility: GolfFacility?
    let date: String?
    let slots: [TeeTimeSlot]
}

struct BookingResponse: Decodable {
    let booking: BookingResult
}

struct BookingResult: Decodable {
    let id: String
}

struct MyBooking: Decodable, Identifiable {
    let id: String
    let facilityId: String
    let date: String
    let startTime: String
    let endTime: String
    let status: String
    let partySize: Int
    let notes: String?
    let facilityName: String
    let facilityType: String
}

struct MyBookingsResponse: Decodable {
    let bookings: [MyBooking]
}

// MARK: - Player Picker Models

struct SearchableMember: Decodable, Identifiable {
    let id: String
    let firstName: String
    let lastName: String
    let email: String
    let avatarUrl: String?
    let tierName: String?
    let tierLevel: String?

    // No CodingKeys needed — APIClient uses .convertFromSnakeCase

    var fullName: String { "\(firstName) \(lastName)" }
    var initials: String { "\(firstName.prefix(1))\(lastName.prefix(1))" }
}

struct MemberSearchResponse: Decodable {
    let members: [SearchableMember]
}

struct BookingPlayerEntry: Identifiable {
    let id = UUID()
    let type: BookingPlayerEntryType
    let member: SearchableMember?
    let guestName: String?
}

enum BookingPlayerEntryType: String, Encodable {
    case member, guest
}

struct BookingPlayerPayload: Encodable {
    let playerType: String
    let memberId: String?
    let guestName: String?

    // No CodingKeys needed — APIClient uses .convertToSnakeCase for encoding
}

// MARK: - Rate Lookup Models

struct RateLookupRequest: Encodable {
    let facilityId: String
    let date: String
    let startTime: String
    let holes: String
    let players: [BookingPlayerPayload]

    // No CodingKeys needed — APIClient uses .convertToSnakeCase for encoding
}

struct RateLookupResponse: Decodable {
    let dayType: String
    let timeType: String
    let holes: String
    let players: [PlayerPricing]
    let total: Double

    // No CodingKeys needed — APIClient uses .convertFromSnakeCase for decoding
}

struct PlayerPricing: Decodable, Identifiable {
    var id: String { displayName + playerType }
    let playerType: String
    let displayName: String
    let tierName: String?
    let greensFee: Double
    let cartFee: Double
    let caddieFee: Double
    let totalFee: Double
    let rateName: String?
    let included: Bool
    let noRate: Bool

    // No CodingKeys needed — APIClient uses .convertFromSnakeCase for decoding
}

// MARK: - Rate Category

struct RateCategory {
    let label: String
    let price: Int
    let color: Color
}

private func rateCategory(for time: String) -> RateCategory {
    let hour = Int(time.prefix(2)) ?? 0
    if hour < 8 {
        return RateCategory(label: "Member Exclusive", price: 165, color: Color(hex: "7c3aed"))
    } else if hour < 11 {
        return RateCategory(label: "Prime Time", price: 195, color: Color(hex: "ea580c"))
    } else if hour >= 15 {
        return RateCategory(label: "Twilight", price: 145, color: Color(hex: "0284c7"))
    } else {
        return RateCategory(label: "Standard", price: 185, color: Color.club.primary)
    }
}

// MARK: - Bookable Date

struct BookableDate: Identifiable {
    var id: String { dateString }
    let dateString: String
    let dayName: String
    let dayNum: String
    let monthName: String
}

private func generateBookableDates() -> [BookableDate] {
    let calendar = Calendar.current
    let formatter = DateFormatter()
    var dates: [BookableDate] = []

    for offset in 1...14 {
        guard let date = calendar.date(byAdding: .day, value: offset, to: Date()) else { continue }

        formatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatter.string(from: date)

        formatter.dateFormat = "EEE"
        let dayName = formatter.string(from: date)

        formatter.dateFormat = "d"
        let dayNum = formatter.string(from: date)

        formatter.dateFormat = "MMM"
        let monthName = formatter.string(from: date)

        dates.append(BookableDate(dateString: dateString, dayName: dayName, dayNum: dayNum, monthName: monthName))
    }
    return dates
}

private func formatTime(_ time: String) -> String {
    let parts = time.split(separator: ":")
    guard parts.count >= 2, let hour = Int(parts[0]) else { return time }
    let minute = parts[1]
    let ampm = hour >= 12 ? "PM" : "AM"
    let display = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour)
    return "\(display):\(minute) \(ampm)"
}

private func formatDate(_ dateStr: String) -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    guard let date = formatter.date(from: dateStr) else { return dateStr }
    formatter.dateFormat = "EEE, MMM d"
    return formatter.string(from: date)
}

// MARK: - Golf Booking View

struct GolfBookingView: View {
    enum Screen { case list, courses, book }

    @State private var screen: Screen = .list

    // My bookings
    @State private var bookings: [MyBooking] = []
    @State private var loadingBookings = true
    @State private var cancellingId: String?

    // Course selection
    @State private var facilities: [GolfFacility] = []
    @State private var loadingFacilities = true
    @State private var facilitiesError: String?
    @State private var selectedFacility: GolfFacility?

    // Booking wizard
    @State private var selectedDate = ""
    @State private var slots: [TeeTimeSlot] = []
    @State private var loadingSlots = false
    @State private var selectedSlot: TeeTimeSlot?
    @State private var transportMode = "cart"

    // Player picker
    @State private var addedPlayers: [BookingPlayerEntry] = []
    @State private var memberSearchText = ""
    @State private var memberSearchResults: [SearchableMember] = []
    @State private var isSearching = false
    @State private var showGuestInput = false
    @State private var guestNameInput = ""

    private var partySize: Int { 1 + addedPlayers.count }

    // Pricing
    @State private var pricingResult: RateLookupResponse?
    @State private var loadingPricing = false

    // Booking state
    @State private var isBooking = false
    @State private var showConfirmation = false
    @State private var bookingError: String?

    // Cancel
    @State private var showCancelAlert = false
    @State private var bookingToCancel: MyBooking?

    // Waitlist
    @State private var joiningWaitlist: String?

    private let bookableDates = generateBookableDates()

    var body: some View {
        ZStack {
            Color.club.background.ignoresSafeArea()

            switch screen {
            case .list:
                myBookingsView
            case .courses:
                courseSelectionView
            case .book:
                bookingWizardView
            }
        }
        .navigationTitle(navTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 8) {
                    NavigationLink {
                        PlayerRatesView()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "dollarsign.circle.fill")
                                .font(.system(size: 12))
                            Text("Rates")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .foregroundStyle(.orange)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.orange.opacity(0.12), in: Capsule())
                    }

                    NavigationLink {
                        ScorecardView()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "flag.fill")
                                .font(.system(size: 12))
                            Text("Scorecard")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        .foregroundStyle(Color.club.primary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.club.accent, in: Capsule())
                    }
                }
            }
        }
        .task {
            async let b: () = fetchBookings()
            async let f: () = fetchFacilities()
            _ = await (b, f)
        }
        .onChange(of: addedPlayers.count) { _, _ in
            Task { await fetchPricing() }
        }
        .onChange(of: selectedSlot?.startTime) { _, _ in
            Task { await fetchPricing() }
        }
        .alert("Tee Time Confirmed!", isPresented: $showConfirmation) {
            Button("OK") {
                resetBookingFlow()
                screen = .list
                Task { await fetchBookings() }
            }
        } message: {
            Text("Your tee time has been booked. You'll receive a confirmation email shortly.")
        }
        .alert("Booking Error", isPresented: .constant(bookingError != nil)) {
            Button("OK") { bookingError = nil }
        } message: {
            Text(bookingError ?? "")
        }
        .alert("Cancel Booking", isPresented: $showCancelAlert) {
            Button("Keep", role: .cancel) { bookingToCancel = nil }
            Button("Cancel Booking", role: .destructive) {
                if let booking = bookingToCancel {
                    Task { await cancelBooking(booking) }
                }
            }
        } message: {
            Text("Are you sure you want to cancel this tee time?")
        }
    }

    private var navTitle: String {
        switch screen {
        case .list: return "Golf"
        case .courses: return "Select Course"
        case .book: return "Book Tee Time"
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - My Bookings List
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var myBookingsView: some View {
        ZStack(alignment: .bottomTrailing) {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 20) {
                    // Hero
                    heroSection

                    if loadingBookings {
                        ProgressView()
                            .tint(Color.club.primary)
                            .padding(.top, 40)
                    } else if bookings.isEmpty {
                        emptyBookingsState
                    } else {
                        // Upcoming header
                        HStack {
                            Text("Upcoming")
                                .font(.custom("Georgia", size: 18).weight(.semibold))
                                .foregroundStyle(Color.club.foreground)
                            Spacer()
                            Text("\(bookings.count) Booking\(bookings.count == 1 ? "" : "s")")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Color.club.onSurfaceVariant)
                        }
                        .padding(.horizontal, 20)

                        // Booking cards
                        VStack(spacing: 12) {
                            ForEach(bookings) { booking in
                                bookingCard(booking)
                            }
                        }
                        .padding(.horizontal, 20)
                    }

                    Spacer(minLength: 100)
                }
                .padding(.top, 8)
            }

            // FAB
            Button {
                screen = .courses
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 56, height: 56)
                    .background(Color.club.primary, in: Circle())
                    .shadow(color: Color.club.primary.opacity(0.3), radius: 8, y: 4)
            }
            .padding(.trailing, 20)
            .padding(.bottom, 20)
        }
    }

    private var heroSection: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text("YOUR SCHEDULE")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1)
                    .foregroundStyle(Color.club.outline)

                Text("Prepare for\nthe Green.")
                    .font(.custom("Georgia", size: 26).weight(.bold))
                    .foregroundStyle(Color.club.foreground)
            }

            Spacer()

            if let next = bookings.first {
                VStack(alignment: .trailing, spacing: 4) {
                    Text("Next Appearance")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.club.outline)

                    Text("\(formatDate(next.date))")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Color.club.foreground)

                    Text(formatTime(next.startTime))
                        .font(.system(size: 13))
                        .foregroundStyle(Color.club.onSurfaceVariant)

                    HStack(spacing: 4) {
                        Image(systemName: "sun.max.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.club.tertiary)
                        Text("Clear Skies")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                    .padding(.top, 2)
                }
                .padding(12)
                .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 12))
                .shadow(color: Color.club.foreground.opacity(0.03), radius: 8, y: 2)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
    }

    private func bookingCard(_ booking: MyBooking) -> some View {
        VStack(spacing: 0) {
            // Course header gradient
            ZStack(alignment: .topLeading) {
                LinearGradient(
                    colors: [Color.club.primaryContainer, Color.club.primary],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .frame(height: 80)

                HStack {
                    Spacer()
                    Image(systemName: "figure.golf")
                        .font(.system(size: 50))
                        .foregroundStyle(.white.opacity(0.1))
                        .offset(x: 10, y: 10)
                }
                .frame(height: 80)

                Text(booking.facilityName)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(.ultraThinMaterial.opacity(0.6), in: Capsule())
                    .padding(12)
            }

            // Card body
            VStack(spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(formatDate(booking.date))
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(Color.club.foreground)
                        Text("\(formatTime(booking.startTime)) \u{00B7} \(booking.partySize) \(booking.partySize == 1 ? "Player" : "Players")")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }

                    Spacer()

                    Image(systemName: booking.partySize > 2 ? "person.2.fill" : "person.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(Color.club.primary)
                        .frame(width: 36, height: 36)
                        .background(Color.club.accent, in: Circle())
                }

                // Actions
                HStack(spacing: 10) {
                    // Cancel button
                    Button {
                        bookingToCancel = booking
                        showCancelAlert = true
                    } label: {
                        Group {
                            if cancellingId == booking.id {
                                ProgressView()
                                    .controlSize(.small)
                                    .tint(Color.club.destructive)
                            } else {
                                Image(systemName: "xmark.circle")
                                    .font(.system(size: 16))
                                    .foregroundStyle(Color.club.onSurfaceVariant)
                            }
                        }
                        .frame(width: 40, height: 36)
                        .background(Color.club.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(cancellingId == booking.id)
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .padding(14)
        }
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.club.foreground.opacity(0.04), radius: 12, y: 4)
    }

    private var emptyBookingsState: some View {
        VStack(spacing: 12) {
            Image(systemName: "figure.golf")
                .font(.system(size: 36))
                .foregroundStyle(Color.club.outlineVariant)
                .frame(width: 64, height: 64)
                .background(Color.club.surfaceContainerLow, in: RoundedRectangle(cornerRadius: 18))

            Text("No upcoming tee times")
                .font(.custom("Georgia", size: 17).weight(.semibold))
                .foregroundStyle(Color.club.foreground)

            Text("Book your next round to see it here.")
                .font(.system(size: 13))
                .foregroundStyle(Color.club.onSurfaceVariant)

            Button {
                screen = .courses
            } label: {
                HStack(spacing: 6) {
                    Text("Book a Tee Time")
                        .font(.system(size: 14, weight: .semibold))
                    Image(systemName: "arrow.right")
                        .font(.system(size: 12))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 12))
            }
            .padding(.top, 4)
        }
        .padding(.top, 40)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Course Selection
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var courseSelectionView: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 24) {
                // Back + Hero
                HStack(spacing: 12) {
                    Button {
                        screen = .list
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                            .frame(width: 32, height: 32)
                            .background(Color.club.surfaceContainerHigh, in: Circle())
                    }
                    Spacer()
                }
                .padding(.horizontal, 20)

                VStack(spacing: 8) {
                    Text("SELECT YOUR COURSE")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(1.5)
                        .foregroundStyle(Color.club.outline)

                    Text("The Lakes")
                        .font(.custom("Georgia", size: 26).weight(.bold))
                        .foregroundStyle(Color.club.foreground)

                    Text("Select your canvas for the day from our world-renowned championship greens.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
                .padding(.bottom, 8)

                if loadingFacilities {
                    ProgressView()
                        .tint(Color.club.primary)
                        .padding(.top, 40)
                } else if let error = facilitiesError {
                    VStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 32))
                            .foregroundStyle(Color.club.outlineVariant)
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                    .padding(.top, 40)
                } else if facilities.isEmpty {
                    emptyFacilitiesState
                } else {
                    VStack(spacing: 16) {
                        ForEach(Array(facilities.enumerated()), id: \.element.id) { index, facility in
                            courseCard(facility, isPremier: index == 0)
                        }
                    }
                    .padding(.horizontal, 20)

                    premiumCard
                }

                Spacer(minLength: 32)
            }
            .padding(.top, 8)
        }
    }

    private func courseCard(_ facility: GolfFacility, isPremier: Bool) -> some View {
        Button {
            selectedFacility = facility
            screen = .book
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .topLeading) {
                    LinearGradient(
                        colors: [Color.club.primaryContainer, Color.club.primary],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .frame(height: 140)

                    VStack {
                        Spacer()
                        HStack {
                            Spacer()
                            Image(systemName: "figure.golf")
                                .font(.system(size: 80))
                                .foregroundStyle(.white.opacity(0.1))
                                .offset(x: 20, y: 20)
                        }
                    }
                    .frame(height: 140)

                    if isPremier {
                        Text("PREMIER")
                            .font(.system(size: 9, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Color.club.tertiaryFixed)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.club.tertiaryContainer, in: Capsule())
                            .padding(12)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                VStack(alignment: .leading, spacing: 8) {
                    Text(facility.name)
                        .font(.custom("Georgia", size: 18).weight(.semibold))
                        .foregroundStyle(Color.club.foreground)

                    HStack(spacing: 16) {
                        statPill(icon: "flag.fill", text: "18 Holes")
                        statPill(icon: "scope", text: "Par 72")
                        statPill(icon: "ruler", text: "7,100 yds")
                    }

                    if let desc = facility.description, !desc.isEmpty {
                        Text(desc)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                            .lineLimit(2)
                    }

                    HStack(spacing: 6) {
                        Text("Book Tee Time")
                            .font(.system(size: 14, weight: .semibold))
                        Image(systemName: "arrow.right")
                            .font(.system(size: 12, weight: .semibold))
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

    private func statPill(icon: String, text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 10))
            Text(text)
                .font(.system(size: 11))
        }
        .foregroundStyle(Color.club.onSurfaceVariant)
    }

    private var premiumCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "diamond.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.club.tertiaryFixed)
                    .frame(width: 28, height: 28)
                    .background(Color.club.tertiaryContainer, in: RoundedRectangle(cornerRadius: 8))

                Text("EXCLUSIVE")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1)
                    .foregroundStyle(Color.club.tertiaryFixed)
            }

            Text("Private Reserve Experience")
                .font(.custom("Georgia", size: 17).weight(.semibold))
                .foregroundStyle(Color.club.foreground)

            Text("Priority 48-hour booking window, digital concierge, and equipment valet service.")
                .font(.system(size: 13))
                .foregroundStyle(Color.club.onSurfaceVariant)

            ForEach(["Digital Concierge", "Equipment Valet", "Priority Booking"], id: \.self) { perk in
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.club.primary)
                    Text(perk)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.club.foreground)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.club.tertiaryFixed.opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal, 20)
    }

    private var emptyFacilitiesState: some View {
        VStack(spacing: 12) {
            Image(systemName: "figure.golf")
                .font(.system(size: 32))
                .foregroundStyle(Color.club.outlineVariant)
            Text("No golf courses available")
                .font(.system(size: 15))
                .foregroundStyle(Color.club.onSurfaceVariant)
        }
        .padding(.top, 40)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Booking Wizard
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var bookingWizardView: some View {
        ZStack(alignment: .bottom) {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 24) {
                    wizardHeader
                    dateStripSection
                    playerSection
                    transportSection

                    if selectedDate.isEmpty {
                        selectDatePrompt
                    } else {
                        timeSlotsSection
                    }

                    if selectedSlot != nil {
                        Spacer(minLength: 100)
                    } else {
                        Spacer(minLength: 32)
                    }
                }
                .padding(.top, 8)
            }

            if let slot = selectedSlot {
                confirmBar(slot: slot)
            }
        }
    }

    private var wizardHeader: some View {
        HStack(spacing: 12) {
            Button {
                resetBookingFlow()
                screen = .courses
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                    .frame(width: 32, height: 32)
                    .background(Color.club.surfaceContainerHigh, in: Circle())
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("BOOK TEE TIME")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1)
                    .foregroundStyle(Color.club.outline)
                Text(selectedFacility?.name ?? "")
                    .font(.custom("Georgia", size: 18).weight(.semibold))
                    .foregroundStyle(Color.club.foreground)
            }

            Spacer()
        }
        .padding(.horizontal, 20)
    }

    // MARK: - Date Strip

    private var dateStripSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Select Date")
                .font(.custom("Georgia", size: 16).weight(.semibold))
                .foregroundStyle(Color.club.foreground)
                .padding(.horizontal, 20)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(bookableDates) { date in
                        let isActive = selectedDate == date.dateString
                        Button {
                            selectedDate = date.dateString
                            selectedSlot = nil
                            if let facility = selectedFacility {
                                Task { await fetchSlots(facilityId: facility.id, date: date.dateString) }
                            }
                        } label: {
                            VStack(spacing: 4) {
                                Text(date.dayName)
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundStyle(isActive ? .white : Color.club.onSurfaceVariant)
                                Text(date.dayNum)
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundStyle(isActive ? .white : Color.club.foreground)
                            }
                            .frame(width: 52, height: 64)
                            .background(
                                isActive ? Color.club.primary : Color.club.surfaceContainerLowest,
                                in: RoundedRectangle(cornerRadius: 12)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(isActive ? Color.clear : Color.club.outlineVariant.opacity(0.5), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }

    // MARK: - Players

    private var playerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Your Group")
                    .font(.custom("Georgia", size: 16).weight(.semibold))
                    .foregroundStyle(Color.club.foreground)

                Spacer()

                Text("\(partySize)/4 Players")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }

            // Booker (always first)
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Color.club.primary)
                        .frame(width: 36, height: 36)
                    Text("You")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("You (Booking Member)")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)
                }

                Spacer()
            }
            .padding(10)
            .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.club.primary.opacity(0.3), lineWidth: 1)
            )

            // Added players
            ForEach(addedPlayers) { player in
                HStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(player.type == .member ? Color.blue.opacity(0.15) : Color.orange.opacity(0.15))
                            .frame(width: 36, height: 36)
                        Image(systemName: player.type == .member ? "person.fill" : "person.badge.plus")
                            .font(.system(size: 14))
                            .foregroundStyle(player.type == .member ? .blue : .orange)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(player.type == .member ? (player.member?.fullName ?? "Member") : (player.guestName ?? "Guest"))
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.club.foreground)
                        Text(player.type == .member ? (player.member?.tierName ?? "Member") : "Guest")
                            .font(.system(size: 12))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }

                    Spacer()

                    Button {
                        addedPlayers.removeAll { $0.id == player.id }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(Color.club.outlineVariant)
                    }
                }
                .padding(10)
                .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.club.outlineVariant.opacity(0.3), lineWidth: 1)
                )
            }

            // Add player controls (only if < 3 additional)
            if addedPlayers.count < 3 {
                // Member search
                VStack(spacing: 0) {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.club.onSurfaceVariant)

                        TextField("Search members to add...", text: $memberSearchText)
                            .font(.system(size: 14))
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .onChange(of: memberSearchText) { _, newValue in
                                Task { await searchMembers(query: newValue) }
                            }

                        if isSearching {
                            ProgressView()
                                .controlSize(.small)
                                .tint(Color.club.primary)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(Color.club.outlineVariant.opacity(0.5), lineWidth: 1)
                    )

                    // Search results
                    if !memberSearchResults.isEmpty {
                        VStack(spacing: 0) {
                            ForEach(memberSearchResults.filter { m in
                                !addedPlayers.contains { $0.member?.id == m.id }
                            }) { member in
                                Button {
                                    addedPlayers.append(BookingPlayerEntry(
                                        type: .member,
                                        member: member,
                                        guestName: nil
                                    ))
                                    memberSearchText = ""
                                    memberSearchResults = []
                                } label: {
                                    HStack(spacing: 10) {
                                        ZStack {
                                            Circle()
                                                .fill(Color.blue.opacity(0.1))
                                                .frame(width: 30, height: 30)
                                            Text(member.initials)
                                                .font(.system(size: 11, weight: .bold))
                                                .foregroundStyle(.blue)
                                        }

                                        VStack(alignment: .leading, spacing: 1) {
                                            Text(member.fullName)
                                                .font(.system(size: 13, weight: .medium))
                                                .foregroundStyle(Color.club.foreground)
                                            Text(member.tierName ?? "Member")
                                                .font(.system(size: 11))
                                                .foregroundStyle(Color.club.onSurfaceVariant)
                                        }

                                        Spacer()
                                    }
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                }
                                .buttonStyle(.plain)

                                Divider().padding(.leading, 52)
                            }
                        }
                        .background(Color.club.surfaceContainerLowest)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color.club.outlineVariant.opacity(0.5), lineWidth: 1)
                        )
                        .padding(.top, 4)
                    }
                }

                // Guest add
                if showGuestInput {
                    HStack(spacing: 8) {
                        TextField("Guest name", text: $guestNameInput)
                            .font(.system(size: 14))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color.club.outlineVariant.opacity(0.5), lineWidth: 1)
                            )
                            .onSubmit {
                                addGuest()
                            }

                        Button("Add") {
                            addGuest()
                        }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Color.orange, in: RoundedRectangle(cornerRadius: 10))
                        .disabled(guestNameInput.trimmingCharacters(in: .whitespaces).isEmpty)

                        Button {
                            showGuestInput = false
                            guestNameInput = ""
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Color.club.onSurfaceVariant)
                                .frame(width: 36, height: 36)
                                .background(Color.club.surfaceContainerHigh, in: Circle())
                        }
                    }
                } else {
                    Button {
                        showGuestInput = true
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "person.badge.plus")
                                .font(.system(size: 14))
                            Text("Add a Guest")
                                .font(.system(size: 14, weight: .medium))
                        }
                        .foregroundStyle(Color.orange)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(style: StrokeStyle(lineWidth: 1, dash: [6]))
                                .foregroundStyle(Color.orange.opacity(0.4))
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 20)
    }

    private func addGuest() {
        let name = guestNameInput.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty, addedPlayers.count < 3 else { return }
        addedPlayers.append(BookingPlayerEntry(type: .guest, member: nil, guestName: name))
        guestNameInput = ""
        showGuestInput = false
    }

    // MARK: - Transport

    private var transportSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Transport")
                .font(.custom("Georgia", size: 16).weight(.semibold))
                .foregroundStyle(Color.club.foreground)

            HStack(spacing: 10) {
                transportButton(id: "cart", icon: "car.fill", label: "Golf Cart")
                transportButton(id: "walk", icon: "figure.walk", label: "Walking")
            }
        }
        .padding(.horizontal, 20)
    }

    private func transportButton(id: String, icon: String, label: String) -> some View {
        Button {
            transportMode = id
        } label: {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                Text(label)
                    .font(.system(size: 14, weight: .medium))
            }
            .foregroundStyle(transportMode == id ? Color.club.primary : Color.club.onSurfaceVariant)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                transportMode == id ? Color.club.accent : Color.club.surfaceContainerLowest,
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(transportMode == id ? Color.club.primary.opacity(0.3) : Color.club.outlineVariant.opacity(0.5), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Select Date Prompt

    private var selectDatePrompt: some View {
        VStack(spacing: 10) {
            Image(systemName: "calendar")
                .font(.system(size: 24))
                .foregroundStyle(Color.club.outlineVariant)
            Text("Select a date above to see available tee times")
                .font(.system(size: 14))
                .foregroundStyle(Color.club.onSurfaceVariant)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }

    // MARK: - Time Slots

    private var timeSlotsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Available Times")
                    .font(.custom("Georgia", size: 16).weight(.semibold))
                    .foregroundStyle(Color.club.foreground)

                Spacer()

                if !slots.isEmpty {
                    Text("\(slots.filter(\.isAvailable).count) Slots")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }
            }
            .padding(.horizontal, 20)

            if loadingSlots {
                HStack(spacing: 10) {
                    ProgressView().tint(Color.club.primary)
                    Text("Finding tee times...")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
            } else if slots.isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "clock")
                        .font(.system(size: 24))
                        .foregroundStyle(Color.club.outlineVariant)
                    Text("No available times on this date")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
            } else {
                VStack(spacing: 8) {
                    ForEach(slots) { slot in
                        slotCard(slot)
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }

    private func slotCard(_ slot: TeeTimeSlot) -> some View {
        let isSelected = selectedSlot?.startTime == slot.startTime
        let category = rateCategory(for: slot.startTime)

        return VStack(spacing: 0) {
            Button {
                if slot.isAvailable {
                    selectedSlot = slot
                }
            } label: {
                HStack(spacing: 0) {
                    if isSelected {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.club.primary)
                            .frame(width: 4, height: 48)
                            .padding(.trailing, 12)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text(formatTime(slot.startTime))
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(
                                !slot.isAvailable ? Color.club.outlineVariant :
                                isSelected ? Color.club.primary : Color.club.foreground
                            )

                        HStack(spacing: 8) {
                            Text(category.label)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(category.color)

                            HStack(spacing: 3) {
                                Image(systemName: "person.2.fill")
                                    .font(.system(size: 10))
                                Text(slot.isAvailable ? "Up to 4 players" : "Booked")
                                    .font(.system(size: 11))
                            }
                            .foregroundStyle(Color.club.onSurfaceVariant)
                        }
                    }

                    Spacer()

                    if slot.isAvailable {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("$\(category.price)")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundStyle(isSelected ? Color.club.primary : Color.club.foreground)
                            Text("per player")
                                .font(.system(size: 10))
                                .foregroundStyle(Color.club.onSurfaceVariant)
                        }
                    }
                }
                .padding(isSelected ? EdgeInsets(top: 14, leading: 12, bottom: 14, trailing: 16) : EdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16))
                .background(
                    isSelected ? Color.club.accent :
                    !slot.isAvailable ? Color.club.surfaceContainerLow :
                    Color.club.surfaceContainerLowest,
                    in: RoundedRectangle(cornerRadius: 12)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            isSelected ? Color.club.primary.opacity(0.3) :
                            Color.club.outlineVariant.opacity(0.3),
                            lineWidth: 1
                        )
                )
            }
            .buttonStyle(.plain)
            .disabled(!slot.isAvailable)

            if !slot.isAvailable && !slot.onWaitlist {
                Button {
                    Task { await joinWaitlist(slot) }
                } label: {
                    HStack(spacing: 4) {
                        if joiningWaitlist == slot.startTime {
                            ProgressView().tint(Color.club.primary)
                                .controlSize(.small)
                        } else {
                            Text("Join Waitlist\(slot.waitlistCount > 0 ? " (\(slot.waitlistCount) ahead)" : "")")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Color.club.primary)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                }
                .disabled(joiningWaitlist == slot.startTime)
            }

            if !slot.isAvailable && slot.onWaitlist {
                Text("On Waitlist\(slot.waitlistCount > 0 ? " (#\(slot.waitlistCount))" : "")")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color(hex: "92400e"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color(hex: "fffbeb"), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    // MARK: - Confirm Bar

    private func confirmBar(slot: TeeTimeSlot) -> some View {
        let category = rateCategory(for: slot.startTime)
        let allIncludedOrNoRate = pricingResult?.players.allSatisfy { $0.included || $0.noRate } ?? false
        let displayTotal: String = {
            if let pricing = pricingResult {
                if allIncludedOrNoRate { return "Included" }
                return String(format: "$%.2f", pricing.total)
            }
            let fallback = category.price * partySize
            return "$\(fallback).00"
        }()

        return VStack(spacing: 0) {
            // Per-player breakdown
            if let pricing = pricingResult, !pricing.players.isEmpty {
                VStack(spacing: 0) {
                    ForEach(Array(pricing.players.enumerated()), id: \.offset) { _, p in
                        HStack {
                            Circle()
                                .fill(p.noRate ? Color.gray : p.playerType == "guest" ? Color.orange : Color.blue)
                                .frame(width: 6, height: 6)
                            Text(p.displayName)
                                .font(.system(size: 12))
                                .foregroundStyle(Color.club.foreground)
                                .lineLimit(1)

                            if let tier = p.tierName {
                                Text(tier)
                                    .font(.system(size: 10))
                                    .foregroundStyle(Color.club.onSurfaceVariant)
                            } else if p.playerType == "member" {
                                Text("No tier")
                                    .font(.system(size: 10))
                                    .foregroundStyle(.orange)
                            }

                            Spacer()

                            if p.noRate {
                                Text("No rate set")
                                    .font(.system(size: 11))
                                    .foregroundStyle(.orange)
                            } else if p.included {
                                Text("Included")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(Color.club.primary)
                            } else {
                                Text(String(format: "$%.2f", p.totalFee))
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundStyle(Color.club.foreground)
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 4)
                    }

                    if pricing.players.contains(where: { $0.noRate }) {
                        Text("Some players have no rate configured")
                            .font(.system(size: 10))
                            .foregroundStyle(.orange)
                            .padding(.horizontal, 20)
                            .padding(.bottom, 4)
                    }
                }
                .padding(.vertical, 8)
                .background(Color.club.surfaceContainerLow)
            }

            Divider()
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Total Estimate")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        if loadingPricing {
                            ProgressView()
                                .controlSize(.small)
                                .tint(Color.club.primary)
                        } else {
                            Text(displayTotal)
                                .font(.system(size: 22, weight: .bold))
                                .foregroundStyle(displayTotal == "Included" ? Color.club.primary : Color.club.foreground)
                        }
                        Text("for \(partySize) \(partySize == 1 ? "player" : "players")")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                }

                Spacer()

                Button {
                    Task { await bookTeeTime() }
                } label: {
                    Group {
                        if isBooking {
                            ProgressView().tint(.white)
                        } else {
                            Text("Confirm Booking")
                                .font(.system(size: 15, weight: .bold))
                        }
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 14)
                    .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 14))
                }
                .disabled(isBooking)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .background(.ultraThinMaterial)
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - API Calls
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func fetchBookings() async {
        loadingBookings = true
        defer { loadingBookings = false }

        do {
            let response: MyBookingsResponse = try await APIClient.shared.get("/bookings/my")
            bookings = response.bookings
        } catch {
            print("Failed to fetch bookings:", error)
        }
    }

    private func fetchFacilities() async {
        loadingFacilities = true
        facilitiesError = nil
        defer { loadingFacilities = false }

        do {
            let response: FacilitiesResponse = try await APIClient.shared.get("/facilities", query: ["type": "golf"])
            facilities = response.facilities
        } catch {
            facilitiesError = error.localizedDescription
        }
    }

    private func fetchSlots(facilityId: String, date: String) async {
        loadingSlots = true
        slots = []
        defer { loadingSlots = false }

        do {
            let response: TeeSlotsResponse = try await APIClient.shared.get(
                "/bookings/tee-times",
                query: ["facility_id": facilityId, "date": date]
            )
            slots = response.slots
        } catch {
            print("Failed to fetch slots:", error)
        }
    }

    private func bookTeeTime() async {
        guard let facility = selectedFacility,
              let slot = selectedSlot,
              !selectedDate.isEmpty else { return }

        isBooking = true
        defer { isBooking = false }

        struct BookRequest: Encodable {
            let facilityId: String
            let date: String
            let startTime: String
            let endTime: String
            let partySize: Int
            let players: [BookingPlayerPayload]?

            // No CodingKeys needed — APIClient uses .convertToSnakeCase for encoding
        }

        let playerPayloads: [BookingPlayerPayload]? = addedPlayers.isEmpty ? nil : addedPlayers.map { p in
            BookingPlayerPayload(
                playerType: p.type.rawValue,
                memberId: p.member?.id,
                guestName: p.guestName
            )
        }

        do {
            let _: BookingResponse = try await APIClient.shared.post("/bookings", body: BookRequest(
                facilityId: facility.id,
                date: selectedDate,
                startTime: slot.startTime,
                endTime: slot.endTime,
                partySize: partySize,
                players: playerPayloads
            ))
            showConfirmation = true
        } catch {
            bookingError = error.localizedDescription
        }
    }

    private func cancelBooking(_ booking: MyBooking) async {
        cancellingId = booking.id
        defer {
            cancellingId = nil
            bookingToCancel = nil
        }

        do {
            try await APIClient.shared.patch("/bookings/\(booking.id)/cancel")
            bookings.removeAll { $0.id == booking.id }
        } catch {
            bookingError = error.localizedDescription
        }
    }

    private func joinWaitlist(_ slot: TeeTimeSlot) async {
        guard let facility = selectedFacility, !selectedDate.isEmpty else { return }
        joiningWaitlist = slot.startTime
        defer { joiningWaitlist = nil }

        struct WaitlistRequest: Encodable {
            let facilityId: String
            let date: String
            let startTime: String
            let endTime: String
            let partySize: Int
        }

        do {
            try await APIClient.shared.post("/bookings/waitlist", body: WaitlistRequest(
                facilityId: facility.id,
                date: selectedDate,
                startTime: slot.startTime,
                endTime: slot.endTime,
                partySize: partySize
            ))
            await fetchSlots(facilityId: facility.id, date: selectedDate)
        } catch {
            bookingError = error.localizedDescription
        }
    }

    private func fetchPricing() async {
        guard let facility = selectedFacility,
              let slot = selectedSlot,
              !selectedDate.isEmpty else {
            pricingResult = nil
            return
        }

        loadingPricing = true
        defer { loadingPricing = false }

        let playerPayloads = addedPlayers.map { p in
            BookingPlayerPayload(
                playerType: p.type.rawValue,
                memberId: p.member?.id,
                guestName: p.guestName
            )
        }

        do {
            let response: RateLookupResponse = try await APIClient.shared.post(
                "/bookings/rate-lookup",
                body: RateLookupRequest(
                    facilityId: facility.id,
                    date: selectedDate,
                    startTime: slot.startTime,
                    holes: "18",
                    players: playerPayloads
                )
            )
            pricingResult = response
        } catch {
            pricingResult = nil
        }
    }

    private func searchMembers(query: String) async {
        guard query.count >= 2 else {
            memberSearchResults = []
            return
        }
        isSearching = true
        defer { isSearching = false }

        do {
            let response: MemberSearchResponse = try await APIClient.shared.get(
                "/members/search",
                query: ["q": query, "limit": "8"]
            )
            memberSearchResults = response.members
        } catch {
            memberSearchResults = []
        }
    }

    private func resetBookingFlow() {
        selectedFacility = nil
        selectedDate = ""
        selectedSlot = nil
        slots = []
        addedPlayers = []
        memberSearchText = ""
        memberSearchResults = []
        showGuestInput = false
        guestNameInput = ""
        transportMode = "cart"
        pricingResult = nil
    }
}
