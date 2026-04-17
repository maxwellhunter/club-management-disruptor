import SwiftUI

// MARK: - Register Guest Visit Sheet

struct RegisterGuestVisitSheet: View {
    let existingGuests: [Guest]
    let onSuccess: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode = .newGuest
    @State private var selectedGuestId: String = ""

    // New guest fields
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var phone = ""

    // Visit details
    @State private var visitDate: Date = Date()
    @State private var facility: GuestFacilityType? = nil
    @State private var notes = ""

    @State private var submitting = false
    @State private var errorMessage: String?

    @State private var result: VisitResult?

    private enum Mode: String, CaseIterable, Identifiable {
        case newGuest, existingGuest
        var id: String { rawValue }
        var label: String { self == .newGuest ? "New Guest" : "Existing Guest" }
    }

    private struct VisitResult: Decodable {
        let guestFee: Double?
    }

    private var canSubmit: Bool {
        guard !submitting else { return false }
        switch mode {
        case .newGuest:
            return !firstName.trimmingCharacters(in: .whitespaces).isEmpty
                && !lastName.trimmingCharacters(in: .whitespaces).isEmpty
        case .existingGuest:
            return !selectedGuestId.isEmpty
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if let result {
                    successView(result: result)
                } else {
                    formView
                }
            }
            .background(Color.club.background)
            .navigationTitle(result == nil ? "Register Guest" : "Registered")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { finish() }
                }
            }
        }
    }

    // MARK: - Form

    private var formView: some View {
        Form {
            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.club.destructive)
                }
            }

            Section {
                Picker("", selection: $mode) {
                    ForEach(Mode.allCases) { m in
                        Text(m.label).tag(m)
                    }
                }
                .pickerStyle(.segmented)
                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
            }

            switch mode {
            case .newGuest:
                Section("Guest") {
                    TextField("First name", text: $firstName)
                        .textContentType(.givenName)
                    TextField("Last name", text: $lastName)
                        .textContentType(.familyName)
                    TextField("Email (optional)", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    TextField("Phone (optional)", text: $phone)
                        .keyboardType(.phonePad)
                }
            case .existingGuest:
                Section("Guest") {
                    if existingGuests.isEmpty {
                        Text("No guests on file yet. Switch to 'New Guest' to register one.")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    } else {
                        Picker("Select guest", selection: $selectedGuestId) {
                            Text("— Select —").tag("")
                            ForEach(existingGuests.filter { !$0.isBlocked }) { guest in
                                Text(guest.fullName).tag(guest.id)
                            }
                        }
                    }
                }
            }

            Section("Visit Details") {
                DatePicker("Visit date", selection: $visitDate, displayedComponents: .date)

                Picker("Facility", selection: $facility) {
                    Text("Any / Not specified").tag(GuestFacilityType?.none)
                    ForEach(GuestFacilityType.allCases) { f in
                        Text(f.label).tag(GuestFacilityType?.some(f))
                    }
                }
            }

            Section("Notes") {
                TextField("Notes (optional)", text: $notes, axis: .vertical)
                    .lineLimit(2...4)
            }

            Section {
                Button {
                    Task { await submit() }
                } label: {
                    HStack {
                        if submitting {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "person.badge.plus.fill")
                        }
                        Text(submitting ? "Registering…" : "Register Visit")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .foregroundStyle(.white)
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(canSubmit ? Color.club.primary : Color.club.primary.opacity(0.5))
                .disabled(!canSubmit)
            }
        }
    }

    // MARK: - Success

    private func successView(result: VisitResult) -> some View {
        VStack(spacing: 20) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 56))
                .foregroundStyle(Color.club.primary)
                .padding(.top, 32)

            Text("Visit Registered")
                .font(.custom("Georgia", size: 22).weight(.bold))
                .foregroundStyle(Color.club.foreground)

            VStack(spacing: 4) {
                Text(visitSummary)
                    .font(.system(size: 14))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                    .multilineTextAlignment(.center)

                if let fee = result.guestFee, fee > 0 {
                    Text("Guest fee: \(fee.asCurrency)")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.club.primary)
                        .padding(.top, 8)
                }
            }
            .padding(.horizontal, 24)

            Spacer()

            Button {
                finish()
            } label: {
                Text("Done")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 14))
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 20)
        }
    }

    private var visitSummary: String {
        let name: String
        switch mode {
        case .newGuest:
            name = "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
        case .existingGuest:
            name = existingGuests.first(where: { $0.id == selectedGuestId })?.fullName ?? "Guest"
        }
        let df = DateFormatter()
        df.dateStyle = .medium
        let dateStr = df.string(from: visitDate)
        return "\(name) — \(dateStr)\(facility.map { " · \($0.label)" } ?? "")"
    }

    // MARK: - Submit

    private func submit() async {
        submitting = true
        errorMessage = nil
        defer { submitting = false }

        struct InlineGuest: Encodable {
            let firstName: String
            let lastName: String
            let email: String?
            let phone: String?
        }

        struct VisitRequest: Encodable {
            let guestId: String?
            let guest: InlineGuest?
            let visitDate: String
            let facilityType: String?
            let notes: String?
        }

        struct VisitResponse: Decodable {
            let guestFee: Double?
        }

        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        df.timeZone = TimeZone.current
        let dateStr = df.string(from: visitDate)

        let body: VisitRequest = {
            switch mode {
            case .newGuest:
                return VisitRequest(
                    guestId: nil,
                    guest: InlineGuest(
                        firstName: firstName.trimmingCharacters(in: .whitespaces),
                        lastName: lastName.trimmingCharacters(in: .whitespaces),
                        email: email.isEmpty ? nil : email,
                        phone: phone.isEmpty ? nil : phone
                    ),
                    visitDate: dateStr,
                    facilityType: facility?.rawValue,
                    notes: notes.isEmpty ? nil : notes
                )
            case .existingGuest:
                return VisitRequest(
                    guestId: selectedGuestId,
                    guest: nil,
                    visitDate: dateStr,
                    facilityType: facility?.rawValue,
                    notes: notes.isEmpty ? nil : notes
                )
            }
        }()

        do {
            let response: VisitResponse = try await APIClient.shared.post("/guests/visits", body: body)
            result = VisitResult(guestFee: response.guestFee)
            onSuccess()
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            ErrorBanner.shared.show(error)
        }
    }

    private func finish() {
        dismiss()
    }
}

// MARK: - Guest Detail Sheet (per-guest drill-in)

struct GuestDetailSheet: View {
    let guest: Guest
    let visits: [GuestVisit]
    let onChange: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Contact") {
                    if let email = guest.email { LabeledContent("Email", value: email) }
                    if let phone = guest.phone { LabeledContent("Phone", value: phone) }
                    LabeledContent("Total visits", value: "\(guest.totalVisits)")
                    if let last = guest.lastVisitDate {
                        LabeledContent("Last visit", value: last)
                    }
                }

                if guest.isBlocked {
                    Section("Blocked") {
                        if let reason = guest.blockReason {
                            Text(reason)
                                .font(.system(size: 13))
                                .foregroundStyle(Color.club.destructive)
                        } else {
                            Text("This guest is blocked from future visits.")
                                .font(.system(size: 13))
                                .foregroundStyle(Color.club.destructive)
                        }
                    }
                }

                if let notes = guest.notes, !notes.isEmpty {
                    Section("Notes") {
                        Text(notes)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                }

                if !visits.isEmpty {
                    Section("Recent Visits") {
                        ForEach(visits) { visit in
                            VStack(alignment: .leading, spacing: 2) {
                                HStack {
                                    Text(visit.visitDate)
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundStyle(Color.club.foreground)
                                    Spacer()
                                    Text(visit.status.replacingOccurrences(of: "_", with: " ").capitalized)
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(Color.club.onSurfaceVariant)
                                }
                                HStack(spacing: 8) {
                                    if let facility = visit.facilityType {
                                        Text(facility.capitalized)
                                            .font(.system(size: 11))
                                            .foregroundStyle(Color.club.onSurfaceVariant)
                                    }
                                    if visit.guestFee > 0 {
                                        Text(visit.guestFee.asCurrency)
                                            .font(.system(size: 11, weight: .semibold))
                                            .foregroundStyle(Color.club.primary)
                                    }
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .navigationTitle(guest.fullName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Guest Visit Action Sheet (check-in / cancel)

struct GuestVisitActionSheet: View {
    let visit: GuestVisit
    let onChange: () -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var currentStatus: String
    @State private var working: String?
    @State private var errorMessage: String?
    @State private var confirmCancel = false

    init(visit: GuestVisit, onChange: @escaping () -> Void) {
        self.visit = visit
        self.onChange = onChange
        _currentStatus = State(initialValue: visit.status)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Visit") {
                    LabeledContent("Guest", value: visit.guestName)
                    LabeledContent("Host", value: visit.hostName)
                    LabeledContent("Date", value: visit.visitDate)
                    if let facility = visit.facilityType {
                        LabeledContent("Facility", value: facility.capitalized)
                    }
                    if visit.guestFee > 0 {
                        LabeledContent("Fee", value: visit.guestFee.asCurrency)
                    }
                    LabeledContent("Status", value: currentStatus.replacingOccurrences(of: "_", with: " ").capitalized)
                    if visit.feeInvoiced {
                        LabeledContent("Fee invoiced", value: "Yes")
                    }
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.destructive)
                    }
                }

                if let notes = visit.notes, !notes.isEmpty {
                    Section("Notes") {
                        Text(notes)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                }

                Section("Actions") {
                    if currentStatus == "registered" {
                        actionRow(
                            "Check In",
                            icon: "checkmark.circle.fill",
                            color: Color.club.primary,
                            target: "checked_in"
                        )
                    }
                    if currentStatus == "checked_in" {
                        actionRow(
                            "Check Out",
                            icon: "arrow.right.circle.fill",
                            color: Color(hex: "2563eb"),
                            target: "checked_out"
                        )
                    }
                    if currentStatus == "registered" {
                        actionRow(
                            "Mark No-Show",
                            icon: "xmark.octagon.fill",
                            color: Color.club.destructive,
                            target: "no_show"
                        )
                    }
                    if currentStatus == "registered" || currentStatus == "checked_in" {
                        Button(role: .destructive) {
                            confirmCancel = true
                        } label: {
                            HStack {
                                Image(systemName: "trash.fill")
                                Text("Cancel Visit")
                                Spacer()
                                if working == "cancelled" { ProgressView() }
                            }
                        }
                        .disabled(working != nil)
                    }
                }
            }
            .navigationTitle("Guest Visit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog(
                "Cancel this visit?",
                isPresented: $confirmCancel,
                titleVisibility: .visible
            ) {
                Button("Cancel Visit", role: .destructive) {
                    Task { await updateStatus(to: "cancelled") }
                }
                Button("Keep", role: .cancel) {}
            } message: {
                Text("The guest record stays, but this visit will be marked cancelled.")
            }
        }
    }

    private func actionRow(_ label: String, icon: String, color: Color, target: String) -> some View {
        Button {
            Task { await updateStatus(to: target) }
        } label: {
            HStack {
                Image(systemName: icon).foregroundStyle(color)
                Text(label).foregroundStyle(Color.club.foreground)
                Spacer()
                if working == target { ProgressView() }
            }
        }
        .disabled(working != nil)
    }

    private func updateStatus(to newStatus: String) async {
        working = newStatus
        errorMessage = nil
        defer { working = nil }

        struct StatusBody: Encodable { let status: String }
        struct StatusResponse: Decodable { let success: Bool? }

        do {
            let _: StatusResponse = try await APIClient.shared.patch(
                "/guests/visits",
                query: ["id": visit.id],
                body: StatusBody(status: newStatus)
            )
            currentStatus = newStatus
            onChange()
            if newStatus == "cancelled" {
                dismiss()
            }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
            ErrorBanner.shared.show(error)
        }
    }
}
