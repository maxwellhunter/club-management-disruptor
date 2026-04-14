import SwiftUI

// MARK: - Models

struct Space: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let type: String
    let description: String?
    let capacity: Int?
    let maxPartySize: Int?
    let imageUrl: String?
    let isActive: Bool?
}

struct SpacesListResponse: Decodable {
    let facilities: [Space]
}

struct SpaceSlot: Decodable, Identifiable {
    var id: String { startTime }
    let startTime: String
    let endTime: String
    let maxBookings: Int
    let bookedCount: Int
    let isAvailable: Bool
    let myBookingId: String?
}

struct SpaceAvailabilityResponse: Decodable {
    let facility: Space
    let date: String
    let slots: [SpaceSlot]
}

private struct SpaceBookingDate: Identifiable {
    let id = UUID()
    let iso: String
    let label: String
    let sub: String
}

private func spaceBookingDates() -> [SpaceBookingDate] {
    let today = Calendar.current.startOfDay(for: Date())
    let isoFormatter = DateFormatter()
    isoFormatter.dateFormat = "yyyy-MM-dd"
    isoFormatter.calendar = Calendar(identifier: .gregorian)
    isoFormatter.timeZone = TimeZone.current

    let shortWeekday = DateFormatter()
    shortWeekday.dateFormat = "EEE"

    let monthDay = DateFormatter()
    monthDay.dateFormat = "MMM d"

    var out: [SpaceBookingDate] = []
    for i in 0..<14 {
        let d = Calendar.current.date(byAdding: .day, value: i, to: today)!
        let label: String
        switch i {
        case 0: label = "Today"
        case 1: label = "Tomorrow"
        default: label = shortWeekday.string(from: d)
        }
        out.append(.init(iso: isoFormatter.string(from: d), label: label, sub: monthDay.string(from: d)))
    }
    return out
}

private func formatSpaceTime(_ t: String) -> String {
    let parts = t.split(separator: ":")
    guard parts.count >= 2, let h = Int(parts[0]), let m = Int(parts[1]) else { return t }
    let hour12 = h % 12 == 0 ? 12 : h % 12
    let ampm = h < 12 ? "AM" : "PM"
    return String(format: "%d:%02d %@", hour12, m, ampm)
}

// MARK: - Main View

struct SpacesView: View {
    @State private var spaces: [Space] = []
    @State private var loadingSpaces = true
    @State private var hasLoadedSpacesOnce = false
    @State private var loadError: String?

    // Navigation path drives the idiomatic NavigationStack. Pushing a Space
    // onto the path triggers `.navigationDestination(for: Space.self)` and
    // shows the detail view with a system-provided back chevron.
    //
    // `selectedSpace` is still kept as mirrored state so existing helpers
    // (loadSlots / submitBooking / cancelBooking) can keep reading it
    // unchanged. The destination sets it via `.onAppear` when pushed, and we
    // reset it when popped back to root (path.isEmpty).
    @Binding var path: [Space]
    @State private var selectedSpace: Space?
    @State private var selectedDate: String = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }()

    @State private var slots: [SpaceSlot] = []
    @State private var loadingSlots = false

    @State private var bookingSlot: SpaceSlot?
    @State private var partySize: Int = 1
    @State private var notes: String = ""
    @State private var submitting = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    @State private var showCancelAlert = false
    @State private var bookingToCancelId: String?

    private let dates = spaceBookingDates()

    var body: some View {
        ZStack {
            Color.club.background.ignoresSafeArea()
            spacesListView
        }
        // NavigationStack lives in the parent (BookView) — a nested stack
        // inside a VStack sibling of a Picker caused top-of-scroll taps to
        // be eaten by an invisible UINavigationBar overlay.
        .navigationDestination(for: Space.self) { space in
            ZStack {
                Color.club.background.ignoresSafeArea()
                detailView(space)
            }
            .navigationTitle(space.name)
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                // Mirror the pushed space into @State so existing helpers
                // (loadSlots / submitBooking / cancelBooking) keep reading
                // `selectedSpace` unchanged.
                selectedSpace = space
                errorMessage = nil
                Task { await loadSlots(for: space) }
            }
        }
        .task { await loadSpaces() }
        .onChange(of: path) { _, newPath in
            // When popped to root, clear the mirrored state so stale values
            // don't bleed into the next navigation.
            if newPath.isEmpty { selectedSpace = nil }
        }
        .sheet(item: $bookingSlot) { slot in
            bookingSheet(slot)
        }
        .alert("Cancel Reservation?", isPresented: $showCancelAlert, presenting: bookingToCancelId) { id in
            Button("Keep It", role: .cancel) {}
            Button("Cancel", role: .destructive) {
                Task { await cancelBooking(id) }
            }
        } message: { _ in
            Text("This will free up the time slot for other members.")
        }
    }

    // MARK: - Space list

    private var spacesListView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let msg = successMessage {
                    banner(msg, color: .green)
                }
                if let msg = loadError {
                    banner(msg, color: .red)
                }

                if loadingSpaces && !hasLoadedSpacesOnce {
                    spacesSkeleton
                        .transition(.opacity)
                } else if spaces.isEmpty {
                    emptyState
                } else {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                        ForEach(spaces) { space in
                            NavigationLink(value: space) {
                                spaceCard(space)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(16)
            .animation(.easeInOut(duration: 0.25), value: loadingSpaces)
        }
    }

    private var spacesSkeleton: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            ForEach(0..<4, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 0) {
                    RoundedRectangle(cornerRadius: 0)
                        .fill(Color.club.surfaceContainerHigh)
                        .frame(height: 100)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Placeholder name")
                            .font(.system(size: 14, weight: .semibold))
                        Text("Type")
                            .font(.system(size: 11))
                        Text("Placeholder space description.")
                            .font(.system(size: 11))
                            .padding(.top, 2)
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(Color.club.outline.opacity(0.3), lineWidth: 1)
                )
            }
        }
        .redacted(reason: .placeholder)
        .allowsHitTesting(false)
    }

    private func spaceCard(_ space: Space) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack {
                Rectangle()
                    .fill(Color.club.surfaceContainerLow)
                    .frame(height: 100)
                if let url = space.imageUrl, let u = URL(string: url) {
                    AsyncImage(url: u) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable().scaledToFill()
                        default:
                            Image(systemName: iconFor(space.type))
                                .font(.system(size: 28))
                                .foregroundStyle(Color.club.onSurfaceVariant)
                        }
                    }
                    .frame(height: 100)
                    .clipped()
                } else {
                    Image(systemName: iconFor(space.type))
                        .font(.system(size: 28))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }
            }
            .frame(height: 100)
            .clipped()

            VStack(alignment: .leading, spacing: 4) {
                Text(space.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                    .lineLimit(1)
                Text(space.type.capitalized)
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                if let desc = space.description, !desc.isEmpty {
                    Text(desc)
                        .font(.system(size: 11))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .lineLimit(2)
                        .padding(.top, 2)
                }
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.club.outline.opacity(0.3), lineWidth: 1)
        )
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "mappin.and.ellipse")
                .font(.system(size: 32))
                .foregroundStyle(Color.club.onSurfaceVariant)
            Text("No spaces available")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.club.foreground)
            Text("Check back soon — the club hasn't published any bookable spaces yet.")
                .font(.system(size: 12))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(32)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Detail view

    private func detailView(_ space: Space) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // NavigationStack provides the back chevron automatically —
                // no manual "All Spaces" button needed here.
                VStack(alignment: .leading, spacing: 0) {
                    if let url = space.imageUrl, let u = URL(string: url) {
                        AsyncImage(url: u) { phase in
                            if let img = phase.image {
                                img.resizable().scaledToFill()
                            } else {
                                Color.club.surfaceContainerLow
                            }
                        }
                        .frame(height: 160)
                        .frame(maxWidth: .infinity)
                        .clipped()
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text(space.name).font(.system(size: 18, weight: .bold))
                            .foregroundStyle(Color.club.foreground)
                        HStack(spacing: 8) {
                            Text(space.type.capitalized)
                                .font(.system(size: 12, weight: .medium))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color.club.accent, in: Capsule())
                                .foregroundStyle(Color.club.primary)
                            if let cap = space.capacity {
                                Text("Capacity \(cap)")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.club.onSurfaceVariant)
                            }
                        }
                        if let desc = space.description, !desc.isEmpty {
                            Text(desc)
                                .font(.system(size: 13))
                                .foregroundStyle(Color.club.onSurfaceVariant)
                                .padding(.top, 4)
                        }
                    }
                    .padding(14)
                }
                .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))

                if let msg = errorMessage { banner(msg, color: .red) }
                if let msg = successMessage { banner(msg, color: .green) }

                // Date selector
                VStack(alignment: .leading, spacing: 8) {
                    Text("Pick a date")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(dates) { d in
                                Button {
                                    selectedDate = d.iso
                                    Task { await loadSlots(for: space) }
                                } label: {
                                    VStack(spacing: 2) {
                                        Text(d.label).font(.system(size: 12, weight: .semibold))
                                        Text(d.sub).font(.system(size: 10))
                                            .opacity(0.8)
                                    }
                                    .frame(width: 72, height: 50)
                                    .background(
                                        selectedDate == d.iso ? Color.club.primary : Color.club.surfaceContainerLowest,
                                        in: RoundedRectangle(cornerRadius: 10)
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .strokeBorder(Color.club.outline.opacity(0.3), lineWidth: 1)
                                    )
                                    .foregroundStyle(
                                        selectedDate == d.iso ? Color.white : Color.club.foreground
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                // Slots
                VStack(alignment: .leading, spacing: 8) {
                    Text("Available times")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)

                    if loadingSlots {
                        HStack { Spacer(); ProgressView(); Spacer() }.padding(.vertical, 24)
                    } else if slots.isEmpty {
                        Text("No times available on this day.")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 24)
                    } else {
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                            ForEach(slots) { slot in
                                slotButton(slot)
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private func slotButton(_ slot: SpaceSlot) -> some View {
        let mine = slot.myBookingId != nil
        let full = !slot.isAvailable && !mine
        return Button {
            if mine, let id = slot.myBookingId {
                bookingToCancelId = id
                showCancelAlert = true
            } else if !full {
                partySize = 1
                notes = ""
                bookingSlot = slot
            }
        } label: {
            VStack(spacing: 2) {
                Text(formatSpaceTime(slot.startTime))
                    .font(.system(size: 13, weight: .semibold))
                Text(mine ? "Booked" : (full ? "Full" : (slot.maxBookings > 1 ? "\(slot.bookedCount)/\(slot.maxBookings)" : "Open")))
                    .font(.system(size: 10))
                    .opacity(0.75)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                mine ? Color.club.accent :
                    (full ? Color.club.surfaceContainerLow : Color.club.surfaceContainerLowest),
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(
                        mine ? Color.club.primary : Color.club.outline.opacity(0.3),
                        lineWidth: mine ? 1.5 : 1
                    )
            )
            .foregroundStyle(
                mine ? Color.club.primary :
                    (full ? Color.club.onSurfaceVariant : Color.club.foreground)
            )
        }
        .disabled(full)
    }

    // MARK: - Booking sheet

    private func bookingSheet(_ slot: SpaceSlot) -> some View {
        NavigationStack {
            Form {
                Section {
                    if let space = selectedSpace {
                        LabeledContent("Space", value: space.name)
                    }
                    LabeledContent("Date", value: formatDateLong(selectedDate))
                    LabeledContent("Time", value: "\(formatSpaceTime(slot.startTime)) – \(formatSpaceTime(slot.endTime))")
                }

                Section("Party Size") {
                    Stepper(value: $partySize, in: 1...(selectedSpace?.maxPartySize ?? 20)) {
                        Text("\(partySize) \(partySize == 1 ? "person" : "people")")
                    }
                }

                Section("Notes (optional)") {
                    TextField("Any special requests", text: $notes, axis: .vertical)
                        .lineLimit(2...4)
                }

                if let msg = errorMessage {
                    Section {
                        Text(msg).foregroundStyle(.red).font(.system(size: 13))
                    }
                }
            }
            .navigationTitle("Confirm Reservation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { bookingSlot = nil }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await submitBooking(slot) }
                    } label: {
                        if submitting { ProgressView() } else { Text("Reserve") }
                    }
                    .disabled(submitting)
                }
            }
        }
        .presentationDetents([.medium])
    }

    // MARK: - Helpers

    private func banner(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundStyle(color)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
    }

    private func iconFor(_ type: String) -> String {
        switch type {
        case "tennis": return "tennis.racket"
        case "pool": return "drop.fill"
        case "fitness": return "figure.run"
        default: return "mappin.and.ellipse"
        }
    }

    private func formatDateLong(_ iso: String) -> String {
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd"
        guard let d = parser.date(from: iso) else { return iso }
        let out = DateFormatter()
        out.dateFormat = "EEEE, MMM d"
        return out.string(from: d)
    }

    // MARK: - API

    private func loadSpaces() async {
        loadingSpaces = true
        loadError = nil
        defer {
            loadingSpaces = false
            hasLoadedSpacesOnce = true
        }
        do {
            let res: SpacesListResponse = try await APIClient.shared.get(
                "/facilities",
                query: ["types": "tennis,pool,fitness,other"]
            )
            // Client-side safety net in case the server ignores the `types` filter
            // (e.g. older deployed API). Never show golf courses or dining rooms here.
            let excluded: Set<String> = ["golf", "dining"]
            spaces = res.facilities.filter { !excluded.contains($0.type.lowercased()) }
        } catch {
            // Preserve cached spaces on failure.
            loadError = error.localizedDescription
        }
    }

    private func loadSlots(for space: Space) async {
        loadingSlots = true
        defer { loadingSlots = false }
        do {
            let res: SpaceAvailabilityResponse = try await APIClient.shared.get(
                "/spaces/availability",
                query: ["facility_id": space.id, "date": selectedDate]
            )
            slots = res.slots
        } catch {
            slots = []
            errorMessage = error.localizedDescription
        }
    }

    private func submitBooking(_ slot: SpaceSlot) async {
        guard let space = selectedSpace else { return }
        submitting = true
        errorMessage = nil
        defer { submitting = false }

        struct BookRequest: Encodable {
            let facilityId: String
            let date: String
            let startTime: String
            let endTime: String
            let partySize: Int
            let notes: String?
        }

        struct BookResponse: Decodable {
            let booking: BookedItem
            struct BookedItem: Decodable { let id: String }
        }

        do {
            let _: BookResponse = try await APIClient.shared.post("/bookings", body: BookRequest(
                facilityId: space.id,
                date: selectedDate,
                startTime: slot.startTime,
                endTime: slot.endTime,
                partySize: partySize,
                notes: notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : notes
            ))
            bookingSlot = nil
            successMessage = "Reserved \(space.name) at \(formatSpaceTime(slot.startTime))"
            await loadSlots(for: space)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func cancelBooking(_ bookingId: String) async {
        do {
            try await APIClient.shared.patch("/bookings/\(bookingId)/cancel")
            if let space = selectedSpace {
                await loadSlots(for: space)
            }
            successMessage = "Reservation cancelled"
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
