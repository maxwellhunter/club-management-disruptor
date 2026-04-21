import SwiftUI

// MARK: - Shared response types

private struct EventResponse: Decodable { let event: ClubEvent }

// MARK: - Event Composer (create + edit)

struct EventComposerSheet: View {
    let existing: ClubEvent?
    let onSuccess: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var description: String
    @State private var location: String
    @State private var startDate: Date
    @State private var hasEndDate: Bool
    @State private var endDate: Date
    @State private var hasCapacity: Bool
    @State private var capacity: Int
    @State private var isFree: Bool
    @State private var price: Double
    @State private var imageUrl: String

    @State private var submitting = false
    @State private var errorMessage: String?

    init(existing: ClubEvent?, onSuccess: @escaping () -> Void) {
        self.existing = existing
        self.onSuccess = onSuccess

        let start = existing.flatMap { DateUtilities.parseISODate($0.startDate) } ?? Date().addingTimeInterval(60 * 60 * 24)
        let end = existing?.endDate.flatMap { DateUtilities.parseISODate($0) } ?? start.addingTimeInterval(60 * 60 * 2)

        _title = State(initialValue: existing?.title ?? "")
        _description = State(initialValue: existing?.description ?? "")
        _location = State(initialValue: existing?.location ?? "")
        _startDate = State(initialValue: start)
        _hasEndDate = State(initialValue: existing?.endDate != nil)
        _endDate = State(initialValue: end)
        _hasCapacity = State(initialValue: existing?.capacity != nil)
        _capacity = State(initialValue: existing?.capacity ?? 50)
        let existingPrice = existing?.priceValue ?? 0
        _isFree = State(initialValue: existingPrice == 0)
        _price = State(initialValue: existingPrice)
        _imageUrl = State(initialValue: existing?.imageUrl ?? "")
    }

    private var canSubmit: Bool {
        !submitting && !title.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var isEditing: Bool { existing != nil }

    var body: some View {
        NavigationStack {
            Form {
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.destructive)
                    }
                }

                Section("Basics") {
                    TextField("Title", text: $title)
                        .font(.system(size: 16, weight: .semibold))
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...8)
                    TextField("Location", text: $location)
                }

                Section("Schedule") {
                    DatePicker("Start", selection: $startDate)
                    Toggle("End time", isOn: $hasEndDate)
                    if hasEndDate {
                        DatePicker("End", selection: $endDate)
                    }
                }

                Section("Capacity") {
                    Toggle("Limit capacity", isOn: $hasCapacity)
                    if hasCapacity {
                        Stepper("Max \(capacity) attendees", value: $capacity, in: 1...10_000, step: 5)
                    }
                }

                Section("Pricing") {
                    Toggle("Free event", isOn: $isFree)
                    if !isFree {
                        HStack {
                            Text("Price")
                            Spacer()
                            TextField("0.00", value: $price, format: .number.precision(.fractionLength(2)))
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                        }
                    }
                }

                Section {
                    TextField("Image URL (optional)", text: $imageUrl)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                } header: {
                    Text("Image")
                } footer: {
                    Text("A banner image hosted publicly (Supabase Storage, CDN, etc.)")
                        .font(.system(size: 11))
                }

                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        HStack {
                            if submitting {
                                ProgressView().tint(.white)
                            } else {
                                Image(systemName: isEditing ? "checkmark" : "square.and.arrow.down")
                            }
                            Text(submitting ? "Saving…" : (isEditing ? "Save Changes" : "Save Draft"))
                                .font(.system(size: 15, weight: .semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .foregroundStyle(.white)
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(canSubmit ? Color.club.primary : Color.club.primary.opacity(0.5))
                    .disabled(!canSubmit)
                } footer: {
                    if !isEditing {
                        Text("New events are created as drafts. Publish from the event's detail view when ready.")
                            .font(.system(size: 11))
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit Event" : "New Event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func submit() async {
        submitting = true
        errorMessage = nil
        defer { submitting = false }

        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]

        let payload = EventPayload(
            title: title.trimmingCharacters(in: .whitespaces),
            description: description.isEmpty ? nil : description,
            location: location.isEmpty ? nil : location,
            startDate: iso.string(from: startDate),
            endDate: hasEndDate ? iso.string(from: endDate) : nil,
            capacity: hasCapacity ? capacity : nil,
            price: isFree ? 0 : price,
            imageUrl: imageUrl.isEmpty ? nil : imageUrl
        )

        do {
            if let existing {
                let _: EventResponse = try await APIClient.shared.put(
                    "/events/admin/\(existing.id)",
                    body: payload
                )
            } else {
                let _: EventResponse = try await APIClient.shared.post(
                    "/events/admin",
                    body: payload
                )
            }
            onSuccess()
            dismiss()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            ErrorBanner.shared.show(error)
        }
    }

    private struct EventPayload: Encodable {
        let title: String
        let description: String?
        let location: String?
        let startDate: String
        let endDate: String?
        let capacity: Int?
        let price: Double?
        let imageUrl: String?
    }
}

// MARK: - Event Admin Detail Sheet

struct EventAdminDetailSheet: View {
    let event: ClubEvent
    let onChange: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var currentStatus: EventStatus
    @State private var showEditor = false
    @State private var showAttendees = false
    @State private var working: ActionKind?
    @State private var errorMessage: String?
    @State private var confirmDelete = false
    @State private var confirmCancel = false

    private enum ActionKind: Equatable { case publish, unpublish, cancel, delete }

    init(event: ClubEvent, onChange: @escaping () -> Void) {
        self.event = event
        self.onChange = onChange
        _currentStatus = State(initialValue: event.status ?? .draft)
    }

    private var isPublished: Bool { currentStatus == .published }
    private var isCancelled: Bool { currentStatus == .cancelled }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        statusPill(currentStatus)
                        Spacer()
                        Text(eventDateLabel(event.startDate))
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }

                    Text(event.title)
                        .font(.custom("Georgia", size: 20).weight(.bold))
                        .foregroundStyle(Color.club.foreground)

                    if let desc = event.description, !desc.isEmpty {
                        Text(desc)
                            .font(.system(size: 14))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                }

                Section("Details") {
                    if let loc = event.location, !loc.isEmpty {
                        LabeledContent("Location", value: loc)
                    }
                    LabeledContent("Starts", value: eventDateTimeLabel(event.startDate))
                    if let end = event.endDate, !end.isEmpty {
                        LabeledContent("Ends", value: eventDateTimeLabel(end))
                    }
                    if let cap = event.capacity {
                        LabeledContent("Capacity", value: "\(cap)")
                    }
                    let price = event.priceValue ?? 0
                    LabeledContent("Price", value: price == 0 ? "Free" : formatCurrency(price))
                    LabeledContent("RSVPs", value: "\(event.rsvpCount) attending")
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.destructive)
                    }
                }

                Section("Actions") {
                    Button {
                        showEditor = true
                    } label: {
                        Label("Edit event", systemImage: "pencil")
                    }
                    .disabled(working != nil)

                    Button {
                        showAttendees = true
                    } label: {
                        HStack {
                            Label("Attendees", systemImage: "person.3.fill")
                            Spacer()
                            Text("\(event.rsvpCount)")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.club.onSurfaceVariant)
                        }
                    }
                    .disabled(working != nil)

                    if !isPublished && !isCancelled {
                        Button {
                            Task { await update(status: .published, kind: .publish) }
                        } label: {
                            HStack {
                                Label("Publish", systemImage: "paperplane.fill")
                                    .foregroundStyle(Color.club.primary)
                                Spacer()
                                if working == .publish { ProgressView() }
                            }
                        }
                        .disabled(working != nil)
                    } else if isPublished {
                        Button {
                            Task { await update(status: .draft, kind: .unpublish) }
                        } label: {
                            HStack {
                                Label("Revert to draft", systemImage: "arrow.uturn.backward")
                                Spacer()
                                if working == .unpublish { ProgressView() }
                            }
                        }
                        .disabled(working != nil)
                    }

                    if !isCancelled {
                        Button(role: .destructive) {
                            confirmCancel = true
                        } label: {
                            HStack {
                                Label("Cancel event", systemImage: "xmark.octagon")
                                Spacer()
                                if working == .cancel { ProgressView() }
                            }
                        }
                        .disabled(working != nil)
                    }

                    Button(role: .destructive) {
                        confirmDelete = true
                    } label: {
                        HStack {
                            Label("Delete", systemImage: "trash")
                            Spacer()
                            if working == .delete { ProgressView() }
                        }
                    }
                    .disabled(working != nil)
                }
            }
            .navigationTitle("Event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(isPresented: $showEditor) {
                EventComposerSheet(existing: event) {
                    onChange()
                    dismiss()
                }
            }
            .sheet(isPresented: $showAttendees) {
                EventAttendeesSheet(eventId: event.id, eventTitle: event.title) {
                    onChange()
                }
            }
            .confirmationDialog(
                "Cancel this event?",
                isPresented: $confirmCancel,
                titleVisibility: .visible
            ) {
                Button("Cancel Event", role: .destructive) {
                    Task { await update(status: .cancelled, kind: .cancel) }
                }
                Button("Keep", role: .cancel) {}
            } message: {
                Text("All RSVPs stay, but the event will show as cancelled.")
            }
            .confirmationDialog(
                "Delete this event?",
                isPresented: $confirmDelete,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    Task { await performDelete() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("The event and all its RSVPs will be permanently removed.")
            }
        }
    }

    // MARK: - Helpers

    private func statusPill(_ status: EventStatus) -> some View {
        let cfg: (label: String, bg: Color, fg: Color) = {
            switch status {
            case .draft: return ("DRAFT", Color(hex: "f3f4f6"), Color(hex: "6b7280"))
            case .published: return ("PUBLISHED", Color.club.accent, Color.club.primary)
            case .cancelled: return ("CANCELLED", Color(hex: "fee2e2"), Color.club.destructive)
            case .completed: return ("COMPLETED", Color(hex: "dbeafe"), Color(hex: "2563eb"))
            }
        }()
        return HStack(spacing: 6) {
            Circle().fill(cfg.fg).frame(width: 6, height: 6)
            Text(cfg.label)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(cfg.fg)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(cfg.bg, in: RoundedRectangle(cornerRadius: 8))
    }

    private func eventDateLabel(_ iso: String) -> String {
        guard let date = DateUtilities.parseISODate(iso) else { return iso }
        let df = DateFormatter()
        df.dateFormat = "MMM d"
        return df.string(from: date)
    }

    private func eventDateTimeLabel(_ iso: String) -> String {
        guard let date = DateUtilities.parseISODate(iso) else { return iso }
        let df = DateFormatter()
        df.dateStyle = .medium
        df.timeStyle = .short
        return df.string(from: date)
    }

    private func formatCurrency(_ value: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        return f.string(from: NSNumber(value: value)) ?? "$\(value)"
    }

    // MARK: - Actions

    private func update(status: EventStatus, kind: ActionKind) async {
        working = kind
        errorMessage = nil
        defer { working = nil }

        struct StatusBody: Encodable { let status: EventStatus }

        do {
            let _: EventResponse = try await APIClient.shared.put(
                "/events/admin/\(event.id)",
                body: StatusBody(status: status)
            )
            currentStatus = status
            onChange()
            if kind == .cancel { dismiss() }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            ErrorBanner.shared.show(error)
        }
    }

    private func performDelete() async {
        working = .delete
        errorMessage = nil
        defer { working = nil }

        do {
            try await APIClient.shared.delete("/events/admin/\(event.id)")
            onChange()
            dismiss()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            ErrorBanner.shared.show(error)
        }
    }
}

// MARK: - Event Attendees Sheet

struct EventAttendeesSheet: View {
    let eventId: String
    let eventTitle: String
    let onChange: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var attendees: [EventAttendee] = []
    @State private var totalGuests = 0
    @State private var loading = true
    @State private var errorMessage: String?
    @State private var removing: String?

    var body: some View {
        NavigationStack {
            Group {
                if loading && attendees.isEmpty {
                    ProgressView().tint(Color.club.primary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if attendees.isEmpty {
                    emptyState
                } else {
                    List {
                        Section {
                            HStack {
                                Label("\(totalGuests) total", systemImage: "person.3.fill")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Color.club.primary)
                                Spacer()
                                Text("\(attendees.filter { $0.status == .attending }.count) attending")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Color.club.onSurfaceVariant)
                            }
                            .listRowBackground(Color.club.accent)
                        }

                        ForEach(attendees) { attendee in
                            attendeeRow(attendee)
                                .swipeActions {
                                    Button(role: .destructive) {
                                        Task { await remove(attendee) }
                                    } label: {
                                        Label("Remove", systemImage: "trash")
                                    }
                                }
                        }
                    }
                }
            }
            .navigationTitle("Attendees")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await load() }
            .refreshable { await load() }
            .alert("Error", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private func attendeeRow(_ attendee: EventAttendee) -> some View {
        HStack(spacing: 12) {
            Text(attendee.initials)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(Color.club.primary, in: Circle())

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text("\(attendee.firstName) \(attendee.lastName)")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)
                    statusDot(attendee.status)
                }
                Text(attendee.email)
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                if attendee.guestCount > 0 {
                    Text("+ \(attendee.guestCount) guest\(attendee.guestCount == 1 ? "" : "s")")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.club.primary)
                }
            }

            Spacer()

            if removing == attendee.rsvpId {
                ProgressView()
            }
        }
    }

    private func statusDot(_ status: RsvpStatus) -> some View {
        let color: Color = switch status {
        case .attending: Color.club.primary
        case .declined: Color.club.destructive
        case .waitlisted: Color(hex: "d97706")
        }
        return Text(status.label)
            .font(.system(size: 9, weight: .bold))
            .tracking(0.5)
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.12), in: Capsule())
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "person.3")
                .font(.system(size: 40))
                .foregroundStyle(Color.club.outlineVariant)
            Text("No RSVPs yet")
                .font(.custom("Georgia", size: 17).weight(.semibold))
                .foregroundStyle(Color.club.foreground)
            Text("Attendees will appear here once members RSVP.")
                .font(.system(size: 13))
                .foregroundStyle(Color.club.onSurfaceVariant)
        }
        .padding(.horizontal, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Fetch / remove

    private func load() async {
        struct Response: Decodable {
            let attendees: [EventAttendee]
            let totalGuests: Int
        }

        loading = true
        defer { loading = false }

        do {
            let response: Response = try await APIClient.shared.get("/events/admin/\(eventId)/attendees")
            attendees = response.attendees
            totalGuests = response.totalGuests
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            ErrorBanner.shared.show(error)
        }
    }

    private func remove(_ attendee: EventAttendee) async {
        removing = attendee.rsvpId
        defer { removing = nil }

        struct RemoveBody: Encodable { let rsvpId: String }

        do {
            try await APIClient.shared.delete(
                "/events/admin/\(eventId)/attendees",
                body: RemoveBody(rsvpId: attendee.rsvpId)
            )
            attendees.removeAll { $0.rsvpId == attendee.rsvpId }
            onChange()
            await load()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            ErrorBanner.shared.show(error)
        }
    }
}

// MARK: - Attendee model

struct EventAttendee: Decodable, Identifiable, Hashable {
    let rsvpId: String
    let memberId: String
    let firstName: String
    let lastName: String
    let email: String
    let status: RsvpStatus
    let guestCount: Int
    let rsvpCreatedAt: String?

    var id: String { rsvpId }

    var initials: String {
        let f = firstName.prefix(1)
        let l = lastName.prefix(1)
        return "\(f)\(l)".uppercased()
    }
}
