import SwiftUI

// MARK: - Models

struct GolfFacility: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let type: String
    let description: String?
    let capacity: Int?
    let imageUrl: String?
}

struct FacilitiesResponse: Decodable {
    let facilities: [GolfFacility]
}

// MARK: - Navigation Routes
//
// Each case corresponds to a drill-down destination pushed onto the
// NavigationStack. This replaces the old `enum Screen` + `@State screen` +
// manual ZStack switch pattern with idiomatic SwiftUI navigation — the
// system back button, title animation, and swipe-back gesture all come for
// free. `GolfFacility` is carried directly through the route so the wizard
// destination doesn't need to read a parallel @State variable.
enum GolfRoute: Hashable {
    case courses
    case book(facility: GolfFacility)
    case scorecard
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
    let facilityImageUrl: String?
    let isOwner: Bool?
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

struct TimeCategory {
    let label: String
    let color: Color
}

private func timeCategory(for time: String) -> TimeCategory {
    let hour = Int(time.prefix(2)) ?? 0
    if hour < 8 {
        return TimeCategory(label: "Early Bird", color: Color(hex: "7c3aed"))
    } else if hour < 12 {
        return TimeCategory(label: "Prime Time", color: Color(hex: "ea580c"))
    } else if hour < 16 {
        return TimeCategory(label: "Afternoon", color: Color(hex: "0369a1"))
    } else {
        return TimeCategory(label: "Twilight", color: Color(hex: "0284c7"))
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

// MARK: - Request payloads
// Lifted to file scope because nested types aren't allowed inside generic
// functions, and GolfBookingView is now generic over its picker content.

struct GolfBookRequest: Encodable {
    let facilityId: String
    let date: String
    let startTime: String
    let endTime: String
    let partySize: Int
    let players: [BookingPlayerPayload]?
    // No CodingKeys needed — APIClient uses .convertToSnakeCase for encoding
}

struct GolfModifyRequest: Encodable {
    var date: String?
    var startTime: String?
    var endTime: String?
    var partySize: Int?
}

struct GolfWaitlistRequest: Encodable {
    let facilityId: String
    let date: String
    let startTime: String
    let endTime: String
    let partySize: Int
}

// MARK: - Golf Booking View

struct GolfBookingView<PickerContent: View>: View {
    // NavigationStack lives at the parent (BookView) so that a NavigationStack
    // isn't nested inside a VStack sibling of a Picker — that nesting causes
    // UIKit to install an invisible UINavigationBar gesture region at the top
    // of the child's content, making the first card/CTA unclickable. The path
    // is hoisted so we can still do programmatic nav (pop to root after
    // booking, push from Track Round, etc.).
    @Binding var path: [GolfRoute]

    // Mode picker (Golf/Spaces) injected from BookView and rendered just below
    // the BookingsHero — so the hero + picker scroll together (Dining pattern).
    @ViewBuilder let modePicker: () -> PickerContent

    // My bookings
    @State private var bookings: [MyBooking] = []
    @State private var loadingBookings = true
    @State private var hasLoadedBookingsOnce = false

    // Course selection
    @State private var facilities: [GolfFacility] = []
    @State private var loadingFacilities = true
    @State private var hasLoadedFacilitiesOnce = false
    @State private var facilitiesError: String?
    @State private var selectedFacility: GolfFacility?

    // Booking wizard
    @State private var selectedDate = ""
    @State private var slots: [TeeTimeSlot] = []
    @State private var loadingSlots = false
    @State private var slotsError: String?
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
    @State private var bookingError: String?
    // When non-nil, a floating success toast is shown at the top of the
    // bookings list. Used for both successful bookings ("Tee Time
    // Booked") and successful cancellations ("Tee Time Cancelled") —
    // same pill, different copy. Auto-dismisses after ~3.5s.
    @State private var toastMessage: String?

    // Cancel
    @State private var showCancelAlert = false
    @State private var bookingToCancel: MyBooking?

    // Waitlist
    @State private var joiningWaitlist: String?

    // Edit booking
    @State private var editingBooking: MyBooking?
    @State private var editDateStr: String = ""
    @State private var editSlots: [TeeTimeSlot] = []
    @State private var editLoadingSlots = false
    @State private var editSelectedSlot: TeeTimeSlot?
    @State private var editPartySize: Int = 1
    @State private var editSaving = false
    @State private var editError: String?
    @State private var showEditSuccess = false
    @State private var showCancelFromEditAlert = false

    private let bookableDates = generateBookableDates()

    var body: some View {
        myBookingsView
            .background(Color.club.background.ignoresSafeArea())
            .navigationDestination(for: GolfRoute.self) { route in
                switch route {
                case .courses:
                    courseSelectionView
                        .background(Color.club.background.ignoresSafeArea())
                        .navigationTitle("Select Course")
                        .navigationBarTitleDisplayMode(.inline)
                case .book(let facility):
                    bookingWizardView(for: facility)
                        .background(Color.club.background.ignoresSafeArea())
                        .navigationTitle("Book Tee Time")
                        .navigationBarTitleDisplayMode(.inline)
                        .onAppear { selectedFacility = facility }
                case .scorecard:
                    ScorecardView()
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
            .alert("Booking Error", isPresented: .constant(bookingError != nil)) {
                Button("OK") { bookingError = nil }
            } message: {
                Text(bookingError ?? "")
            }
            .alert("Cancel Booking", isPresented: $showCancelAlert) {
                Button("Keep", role: .cancel) { bookingToCancel = nil }
                Button("Cancel Booking", role: .destructive) {
                    if let booking = bookingToCancel {
                        cancelBooking(booking)
                    }
                }
            } message: {
                Text("Are you sure you want to cancel this tee time?")
            }
            .alert("Tee Time Updated", isPresented: $showEditSuccess) {
                Button("OK") { showEditSuccess = false }
            } message: {
                Text("Your reservation has been updated.")
            }
            .alert("Cancel Tee Time", isPresented: $showCancelFromEditAlert) {
                Button("Keep", role: .cancel) { }
                Button("Cancel Tee Time", role: .destructive) {
                    if let booking = editingBooking {
                        cancelBookingFromEdit(booking)
                    }
                }
            } message: {
                Text("Are you sure you want to cancel this tee time?")
            }
            .sheet(item: $editingBooking) { booking in
                editBookingSheet(booking)
            }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - My Bookings List
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Floating success toast shown at the top of the bookings list
    // after a successful tee-time mutation (book or cancel). Slides in
    // from the top and auto-hides after ~3.5s. Tappable to dismiss
    // early.
    private func successToast(_ message: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 20))
                .foregroundStyle(.white)
            Text(message)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 14))
        .shadow(color: Color.black.opacity(0.15), radius: 12, y: 4)
        .padding(.horizontal, 16)
        .transition(.move(edge: .top).combined(with: .opacity))
        .onTapGesture {
            withAnimation(.easeOut(duration: 0.2)) {
                toastMessage = nil
            }
        }
    }

    // Show a toast and schedule its auto-dismiss. Centralized so the
    // book-success and cancel-success paths share the same timing.
    private func showToast(_ message: String) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            toastMessage = message
        }
        Task {
            try? await Task.sleep(nanoseconds: 3_500_000_000)
            await MainActor.run {
                // Only dismiss if this toast is still the one showing —
                // prevents a newer toast from getting cut short by an
                // older auto-dismiss timer.
                if toastMessage == message {
                    withAnimation(.easeOut(duration: 0.25)) {
                        toastMessage = nil
                    }
                }
            }
        }
    }

    private var myBookingsView: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 20) {
                // Shared hero banner — same URL/cache as Spaces, mirrors
                // Dining/Events pattern. Picker sits below it so they
                // scroll together.
                VStack(spacing: 8) {
                    BookingsHero()
                    modePicker()
                }

                // Primary CTA — "Book a Tee Time" (top of screen)
                bookTeeTimeCTA
                    .padding(.horizontal, 20)

                if loadingBookings && !hasLoadedBookingsOnce {
                    bookingsSkeleton
                        .padding(.horizontal, 20)
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

                Spacer(minLength: 40)
            }
        }
        .ignoresSafeArea(edges: .top)
        .overlay(alignment: .top) {
            // Banner sits above the status bar inset so it reads as a
            // system toast rather than content. Only rendered when the
            // flag flips so the `.transition` animation fires correctly.
            if let message = toastMessage {
                successToast(message)
                    .padding(.top, 60) // clear the status bar / nav chrome
                    .zIndex(1)
            }
        }
    }

    private var bookTeeTimeCTA: some View {
        Button {
            path.append(.courses)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "calendar.badge.plus")
                    .font(.system(size: 15, weight: .semibold))
                Text("Book a Tee Time")
                    .font(.system(size: 16, weight: .semibold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 14))
            // HITTEST-FIX: match the visual pill shape for the hit region so
            // the implicit hit rect can't overflow into adjacent views.
            .contentShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
    }


    private func bookingCard(_ booking: MyBooking) -> some View {
        VStack(spacing: 0) {
            // Course header — image or gradient fallback
            ZStack(alignment: .topLeading) {
                if let imageUrl = booking.facilityImageUrl, let url = URL(string: imageUrl) {
                    CachedAsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(height: 100)
                                .clipped()
                                .overlay {
                                    LinearGradient(
                                        colors: [.clear, .black.opacity(0.3)],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                                }
                        default:
                            LinearGradient(
                                colors: [Color.club.primaryContainer, Color.club.primary],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                            .frame(height: 100)
                        }
                    }
                } else {
                    LinearGradient(
                        colors: [Color.club.primaryContainer, Color.club.primary],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .frame(height: 100)

                    HStack {
                        Spacer()
                        Image(systemName: "figure.golf")
                            .font(.system(size: 50))
                            .foregroundStyle(.white.opacity(0.1))
                            .offset(x: 10, y: 10)
                    }
                    .frame(height: 100)
                }

                Text(booking.facilityName)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(.ultraThinMaterial.opacity(0.6), in: Capsule())
                    .padding(12)
            }
            .frame(height: 100)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 16, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 16))
            // HITTEST-FIX: the CachedAsyncImage inside uses .resizable()
            // + .aspectRatio(.fill) + .frame(height: 100) + .clipped(), which
            // clips VISUALS but not the hit-test region. The underlying image
            // view overflows the 100pt frame and projects a hit-eating zone
            // above the card. Force the hit shape to match the visual bounds.
            .contentShape(Rectangle())

            // Card body
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(formatDate(booking.date))
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(Color.club.foreground)

                    HStack(spacing: 12) {
                        HStack(spacing: 4) {
                            Image(systemName: "clock")
                                .font(.system(size: 11))
                            Text(formatTime(booking.startTime))
                                .font(.system(size: 13))
                        }

                        HStack(spacing: 4) {
                            Image(systemName: booking.partySize > 2 ? "person.2.fill" : "person.fill")
                                .font(.system(size: 11))
                            Text("\(booking.partySize) \(booking.partySize == 1 ? "Player" : "Players")")
                                .font(.system(size: 13))
                        }
                    }
                    .foregroundStyle(Color.club.onSurfaceVariant)

                    // Scorecard entry — primary style for today's booking,
                    // accent for any other upcoming booking.
                    let eligible = isStartRoundEligible(booking)
                    Button {
                        path.append(.scorecard)
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: eligible ? "flag.fill" : "square.and.pencil")
                                .font(.system(size: 11))
                            Text(eligible ? "Start Round" : "Track Round")
                                .font(.system(size: 12, weight: .bold))
                        }
                        .foregroundStyle(eligible ? .white : Color.club.primary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(
                            eligible ? Color.club.primary : Color.club.accent,
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 4)
                }

                Spacer()

                VStack(spacing: 6) {
                    if booking.isOwner == false {
                        Text("Invited")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Color.club.surfaceContainerLow, in: Capsule())
                    }

                    if booking.isOwner != false {
                        Button {
                            openEditBooking(booking)
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "pencil")
                                    .font(.system(size: 10, weight: .semibold))
                                Text("Edit")
                                    .font(.system(size: 12, weight: .semibold))
                            }
                            .foregroundStyle(Color.club.primary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Color.club.accent, in: Capsule())
                        }
                        .buttonStyle(.plain)

                        Button {
                            bookingToCancel = booking
                            showCancelAlert = true
                        } label: {
                            // No spinner needed — cancelBooking() is
                            // optimistic and the row animates out the
                            // instant the user confirms.
                            Text("Cancel")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Color.club.outline)
                        }
                        .buttonStyle(.plain)
                    }
                }
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
                path.append(.courses)
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
            .buttonStyle(.plain)
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
                // NavigationStack provides back automatically; no manual chevron.
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

                if loadingFacilities && !hasLoadedFacilitiesOnce {
                    coursesSkeleton
                        .padding(.horizontal, 20)
                        .transition(.opacity)
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
            .animation(.easeInOut(duration: 0.25), value: loadingFacilities)
        }
    }

    // Gradient + glyph fallback for the courseCard image header —
    // shown when a facility has no image_url or the async load hasn't
    // resolved yet. Extracted so both branches of the if/else can
    // share it without duplication.
    private var courseHeaderFallback: some View {
        ZStack {
            LinearGradient(
                colors: [Color.club.primaryContainer, Color.club.primary],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
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
        }
        .frame(height: 140)
    }

    private func courseCard(_ facility: GolfFacility, isPremier: Bool) -> some View {
        NavigationLink(value: GolfRoute.book(facility: facility)) {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .topLeading) {
                    // Image header — falls back to a green gradient with the
                    // golfer glyph if the facility has no image_url or the
                    // fetch is still loading/failed.
                    if let imageUrl = facility.imageUrl, let url = URL(string: imageUrl) {
                        CachedAsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(height: 140)
                                    .clipped()
                                    .overlay {
                                        LinearGradient(
                                            colors: [.clear, .black.opacity(0.25)],
                                            startPoint: .top,
                                            endPoint: .bottom
                                        )
                                    }
                            default:
                                courseHeaderFallback
                            }
                        }
                    } else {
                        courseHeaderFallback
                    }

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
                .frame(height: 140)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                // HITTEST-FIX (see CLAUDE.md): .resizable() + .aspectRatio(.fill)
                // + .clipped() clips visuals but not hit-test. Force the hit
                // shape to match the visible rounded rect so taps/buttons
                // above and below the card still work.
                .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

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

    private func bookingWizardView(for facility: GolfFacility) -> some View {
        ZStack(alignment: .bottom) {
            ScrollView(showsIndicators: false) {
                VStack(spacing: 24) {
                    wizardHeader(for: facility)
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

    // NavigationStack provides the back chevron automatically via toolbar.
    // The header here is purely a section label showing which course is being
    // booked — the facility is passed in via the route, not read from @State.
    private func wizardHeader(for facility: GolfFacility) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("BOOK TEE TIME")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1)
                    .foregroundStyle(Color.club.outline)
                Text(facility.name)
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
            } else if let error = slotsError {
                VStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 24))
                        .foregroundStyle(.orange)
                    Text(error)
                        .font(.system(size: 14))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .multilineTextAlignment(.center)
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
        let category = timeCategory(for: slot.startTime)

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

                            if slot.isAvailable {
                                HStack(spacing: 3) {
                                    Image(systemName: "person.2.fill")
                                        .font(.system(size: 10))
                                    Text("Up to 4 players")
                                        .font(.system(size: 11))
                                }
                                .foregroundStyle(Color.club.onSurfaceVariant)
                            }
                        }
                    }

                    Spacer()

                    if !slot.isAvailable {
                        Text("Booked")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.red.opacity(0.7))
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
        let allIncludedOrNoRate = pricingResult?.players.allSatisfy { $0.included || $0.noRate } ?? false
        let displayTotal: String = {
            if let pricing = pricingResult {
                if allIncludedOrNoRate { return "Included" }
                return String(format: "$%.2f", pricing.total)
            }
            return "—"
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
    // MARK: - Helpers
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /// Check if a booking is eligible for "Start Round" — same day, within 30 min before through 4 hours after tee time
    private func isStartRoundEligible(_ booking: MyBooking) -> Bool {
        guard booking.facilityType == "golf" else { return false }

        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        let today = df.string(from: Date())
        guard booking.date == today else { return false }

        let parts = booking.startTime.split(separator: ":").compactMap { Int($0) }
        guard parts.count >= 2 else { return false }

        let calendar = Calendar.current
        var components = calendar.dateComponents([.year, .month, .day], from: Date())
        components.hour = parts[0]
        components.minute = parts[1]
        guard let teeTime = calendar.date(from: components) else { return false }

        let earliest = teeTime.addingTimeInterval(-30 * 60)       // 30 min before
        let latest = teeTime.addingTimeInterval(4 * 60 * 60)      // 4 hours after
        let now = Date()
        return now >= earliest && now <= latest
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Skeletons
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var bookingsSkeleton: some View {
        VStack(spacing: 12) {
            ForEach(0..<2, id: \.self) { _ in
                VStack(spacing: 0) {
                    RoundedRectangle(cornerRadius: 0)
                        .fill(Color.club.surfaceContainerHigh)
                        .frame(height: 100)
                        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 16, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 16))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Placeholder date")
                            .font(.system(size: 16, weight: .bold))
                        HStack(spacing: 12) {
                            Label("0:00 AM", systemImage: "clock")
                            Label("0 Players", systemImage: "person.fill")
                        }
                        .font(.system(size: 13))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                }
                .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            }
        }
        .redacted(reason: .placeholder)
        .allowsHitTesting(false)
    }

    private var coursesSkeleton: some View {
        VStack(spacing: 16) {
            ForEach(0..<2, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 0) {
                    RoundedRectangle(cornerRadius: 0)
                        .fill(Color.club.surfaceContainerHigh)
                        .frame(height: 140)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Placeholder course name")
                            .font(.custom("Georgia", size: 18).weight(.semibold))
                        HStack(spacing: 16) {
                            Label("18 Holes", systemImage: "flag.fill").font(.system(size: 11))
                            Label("Par 72", systemImage: "scope").font(.system(size: 11))
                            Label("7,100 yds", systemImage: "ruler").font(.system(size: 11))
                        }
                        Text("Placeholder course description that mirrors the real course card layout.")
                            .font(.system(size: 13))
                        Text("Book Tee Time")
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - API Calls
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func fetchBookings() async {
        loadingBookings = true
        defer {
            loadingBookings = false
            hasLoadedBookingsOnce = true
        }

        do {
            let response: MyBookingsResponse = try await APIClient.shared.get("/bookings/my", query: ["type": "golf"])
            bookings = response.bookings
        } catch {
            // Preserve cached bookings on failure.
            print("Failed to fetch bookings:", error)
        }
    }

    private func fetchFacilities() async {
        loadingFacilities = true
        facilitiesError = nil
        defer {
            loadingFacilities = false
            hasLoadedFacilitiesOnce = true
        }

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
        slotsError = nil
        defer { loadingSlots = false }

        do {
            let response: TeeSlotsResponse = try await APIClient.shared.get(
                "/bookings/tee-times",
                query: ["facility_id": facilityId, "date": date]
            )
            slots = response.slots
        } catch {
            print("Failed to fetch slots:", error)
            slotsError = error.localizedDescription
        }
    }

    private func bookTeeTime() async {
        guard let facility = selectedFacility,
              let slot = selectedSlot,
              !selectedDate.isEmpty else { return }

        isBooking = true
        defer { isBooking = false }

        let playerPayloads: [BookingPlayerPayload]? = addedPlayers.isEmpty ? nil : addedPlayers.map { p in
            BookingPlayerPayload(
                playerType: p.type.rawValue,
                memberId: p.member?.id,
                guestName: p.guestName
            )
        }

        do {
            let _: BookingResponse = try await APIClient.shared.post("/bookings", body: GolfBookRequest(
                facilityId: facility.id,
                date: selectedDate,
                startTime: slot.startTime,
                endTime: slot.endTime,
                partySize: partySize,
                players: playerPayloads
            ))

            // Success UX: instead of blocking with an alert on the slot
            // screen, pop back to the bookings list, refresh it, and
            // show a non-blocking success banner there. This matches
            // platform patterns (Mail send, Calendar add, etc.) —
            // confirmation lives on the destination you end up on.
            await MainActor.run {
                resetBookingFlow()
                path.removeAll()
                showToast("Tee Time Booked")
            }

            // Refresh the bookings list in the background so the new
            // booking shows up under "Upcoming" by the time the user's
            // eyes settle there.
            Task { await fetchBookings() }
        } catch {
            bookingError = error.localizedDescription
        }
    }

    private func cancelBooking(_ booking: MyBooking) {
        // Optimistic update — the SwiftUI-native pattern: remove the row
        // immediately (with animation so we get the native list-removal
        // transition) and fire the API call in the background. If the
        // server rejects, reinsert the booking at its original index and
        // surface the error. This avoids the "confirm → frozen UI →
        // abrupt disappearance" sequence the old code produced while
        // awaiting the network call.
        guard let originalIndex = bookings.firstIndex(where: { $0.id == booking.id }) else {
            bookingToCancel = nil
            return
        }
        let removedBooking = bookings[originalIndex]

        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            bookings.remove(at: originalIndex)
        }
        bookingToCancel = nil
        showToast("Tee Time Cancelled")

        Task {
            do {
                try await APIClient.shared.patch("/bookings/\(booking.id)/cancel")
            } catch {
                await MainActor.run {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                        // Clamp in case other state changed while we were waiting.
                        let insertAt = min(originalIndex, bookings.count)
                        bookings.insert(removedBooking, at: insertAt)
                    }
                    // Server rejected — clear the premature success toast
                    // and surface the error.
                    toastMessage = nil
                    bookingError = error.localizedDescription
                }
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Edit Booking
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func openEditBooking(_ booking: MyBooking) {
        editPartySize = booking.partySize
        editDateStr = booking.date
        editSelectedSlot = nil
        editSlots = []
        editError = nil
        editingBooking = booking
        Task { await fetchEditSlots(facilityId: booking.facilityId, date: booking.date) }
    }

    private func fetchEditSlots(facilityId: String, date: String) async {
        editLoadingSlots = true
        editSelectedSlot = nil
        defer { editLoadingSlots = false }

        do {
            let response: TeeSlotsResponse = try await APIClient.shared.get(
                "/bookings/tee-times",
                query: ["facility_id": facilityId, "date": date]
            )
            editSlots = response.slots
        } catch {
            editSlots = []
        }
    }

    private func saveBookingEdit(_ booking: MyBooking) async {
        editSaving = true
        defer { editSaving = false }

        var changes = GolfModifyRequest()
        var hasChanges = false

        if editDateStr != booking.date {
            changes.date = editDateStr
            hasChanges = true
        }

        if let slot = editSelectedSlot {
            let currentTime = String(booking.startTime.prefix(5))
            let newTime = String(slot.startTime.prefix(5))
            if newTime != currentTime || editDateStr != booking.date {
                changes.startTime = newTime
                changes.endTime = String(slot.endTime.prefix(5))
                hasChanges = true
            }
        }

        if editPartySize != booking.partySize {
            changes.partySize = editPartySize
            hasChanges = true
        }

        guard hasChanges else {
            editingBooking = nil
            return
        }

        do {
            try await APIClient.shared.patch("/bookings/\(booking.id)/modify", body: changes)
            editingBooking = nil
            showEditSuccess = true
            await fetchBookings()
        } catch {
            editError = error.localizedDescription
        }
    }

    private func cancelBookingFromEdit(_ booking: MyBooking) {
        // Optimistic — same pattern as cancelBooking(). Dismiss the edit
        // sheet immediately, animate the row out of the list, then fire
        // the API call in the background. Reinsert on failure.
        let originalIndex = bookings.firstIndex(where: { $0.id == booking.id })
        let removedBooking = originalIndex.map { bookings[$0] }

        editingBooking = nil
        if let idx = originalIndex {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                bookings.remove(at: idx)
            }
        }
        showToast("Tee Time Cancelled")

        Task {
            do {
                try await APIClient.shared.patch("/bookings/\(booking.id)/cancel")
            } catch {
                await MainActor.run {
                    if let idx = originalIndex, let restored = removedBooking {
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                            let insertAt = min(idx, bookings.count)
                            bookings.insert(restored, at: insertAt)
                        }
                    }
                    toastMessage = nil
                    bookingError = error.localizedDescription
                }
            }
        }
    }

    @ViewBuilder
    private func editBookingSheet(_ booking: MyBooking) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Header
                    VStack(alignment: .leading, spacing: 6) {
                        Text(booking.facilityName)
                            .font(.custom("Georgia", size: 22).weight(.bold))
                            .foregroundStyle(Color.club.foreground)
                        HStack(spacing: 6) {
                            Image(systemName: "calendar.badge.clock")
                                .font(.system(size: 13))
                            Text("Edit Tee Time")
                                .font(.system(size: 14))
                        }
                        .foregroundStyle(Color.club.onSurfaceVariant)
                    }

                    if let error = editError {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.destructive)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.club.destructive.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                    }

                    // Date strip
                    VStack(alignment: .leading, spacing: 10) {
                        Text("DATE")
                            .font(.system(size: 11, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Color.club.outline)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(bookableDates) { d in
                                    let isSelected = editDateStr == d.dateString
                                    Button {
                                        editDateStr = d.dateString
                                        editSelectedSlot = nil
                                        Task { await fetchEditSlots(facilityId: booking.facilityId, date: d.dateString) }
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
                        } else {
                            let availableSlots = editSlots.filter(\.isAvailable)
                            if availableSlots.isEmpty {
                                Text("No available times for this date")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Color.club.onSurfaceVariant)
                                    .padding(.vertical, 12)
                            } else {
                                let columns = [GridItem(.adaptive(minimum: 90), spacing: 8)]
                                LazyVGrid(columns: columns, spacing: 8) {
                                    ForEach(availableSlots, id: \.startTime) { slot in
                                        let isSelected = editSelectedSlot?.startTime == slot.startTime
                                        Button {
                                            editSelectedSlot = slot
                                        } label: {
                                            Text(formatTime(slot.startTime))
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
                                if editPartySize < 4 { editPartySize += 1 }
                            } label: {
                                Image(systemName: "plus.circle.fill")
                                    .font(.system(size: 28))
                                    .foregroundStyle(editPartySize < 4 ? Color.club.primary : Color.club.outlineVariant)
                            }
                            .disabled(editPartySize >= 4)

                            Spacer()

                            Text(editPartySize == 1 ? "Player" : "Players")
                                .font(.system(size: 14))
                                .foregroundStyle(Color.club.onSurfaceVariant)
                        }
                        .padding(16)
                        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))
                    }

                    // Save button
                    Button {
                        Task { await saveBookingEdit(booking) }
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

                    // Cancel reservation — optimistic: the sheet
                    // dismisses and the row animates out immediately on
                    // confirmation, so no spinner/disabled state.
                    Button {
                        showCancelFromEditAlert = true
                    } label: {
                        Text("Cancel Tee Time")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.club.destructive)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(Color.club.destructive.opacity(0.25), lineWidth: 1)
                            )
                    }
                }
                .padding(20)
            }
            .background(Color.club.background)
            .navigationTitle("Edit Tee Time")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { editingBooking = nil }
                }
            }
        }
        .presentationDetents([.large])
    }

    private func joinWaitlist(_ slot: TeeTimeSlot) async {
        guard let facility = selectedFacility, !selectedDate.isEmpty else { return }
        joiningWaitlist = slot.startTime
        defer { joiningWaitlist = nil }

        do {
            try await APIClient.shared.post("/bookings/waitlist", body: GolfWaitlistRequest(
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
