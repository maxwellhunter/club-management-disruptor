import SwiftUI

// MARK: - Models

struct PlayerRateResponse: Decodable {
    let rates: [PlayerRate]
    let facilities: [RateFacility]
    let tiers: [RateTier]
    let role: String
}

struct PlayerRate: Decodable, Identifiable {
    let id: String
    let clubId: String
    let facilityId: String
    let name: String
    let tierId: String?
    let isGuest: Bool
    let dayType: String
    let timeType: String
    let holes: String
    let greensFee: Double
    let cartFee: Double
    let caddieFee: Double
    let isActive: Bool
    let facilityName: String
    let tierName: String?

    // No CodingKeys needed — APIClient uses .convertFromSnakeCase for decoding
}

struct RateFacility: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
}

struct RateTier: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let level: String
}

struct CreateRateBody: Encodable {
    let facilityId: String
    let name: String
    let tierId: String?
    let isGuest: Bool
    let dayType: String
    let timeType: String
    let holes: String
    let greensFee: Double
    let cartFee: Double
    let caddieFee: Double

    // No CodingKeys needed — APIClient uses .convertToSnakeCase for encoding
}

struct UpdateRateBody: Encodable {
    let id: String
    let greensFee: Double?
    let cartFee: Double?
    let caddieFee: Double?
    let isActive: Bool?

    // No CodingKeys needed — APIClient uses .convertToSnakeCase for encoding
}

struct RateActionResponse: Decodable {
    let rate: PlayerRate?
    let message: String?
}

// MARK: - Player Rates Admin View

struct PlayerRatesView: View {
    @State private var rates: [PlayerRate] = []
    @State private var facilities: [RateFacility] = []
    @State private var tiers: [RateTier] = []
    @State private var loading = true
    @State private var error: String?
    @State private var showAddSheet = false
    @State private var editingRate: PlayerRate?
    @State private var successMessage: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                if loading {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else if let error {
                    errorView(error)
                } else if rates.isEmpty {
                    emptyView
                } else {
                    ratesList
                }
            }
            .padding()
        }
        .navigationTitle("Player Rates")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showAddSheet = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(Color.club.primary)
                }
            }
        }
        .sheet(isPresented: $showAddSheet) {
            AddPlayerRateSheet(
                facilities: facilities,
                tiers: tiers,
                onSave: { body in
                    await createRate(body)
                }
            )
        }
        .sheet(item: $editingRate) { rate in
            EditPlayerRateSheet(
                rate: rate,
                onSave: { body in
                    await updateRate(body)
                },
                onDelete: {
                    await deleteRate(rate.id)
                }
            )
        }
        .overlay(alignment: .top) {
            if let msg = successMessage {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                    Text(msg)
                }
                .font(.caption)
                .fontWeight(.medium)
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.club.primary, in: Capsule())
                .transition(.move(edge: .top).combined(with: .opacity))
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        withAnimation { successMessage = nil }
                    }
                }
            }
        }
        .task { await fetchRates() }
    }

    // MARK: - Rate List

    private var ratesList: some View {
        let grouped = Dictionary(grouping: rates, by: \.facilityId)
        return ForEach(Array(grouped.keys.sorted()), id: \.self) { facilityId in
            let facilityRates = grouped[facilityId] ?? []
            let facilityName = facilityRates.first?.facilityName ?? "Course"
            let memberRates = facilityRates.filter { !$0.isGuest }
            let guestRates = facilityRates.filter { $0.isGuest }

            VStack(alignment: .leading, spacing: 16) {
                // Facility header
                Text(facilityName)
                    .font(.custom("Georgia", size: 18))
                    .fontWeight(.semibold)

                // Member rates
                if !memberRates.isEmpty {
                    sectionHeader(icon: "person.fill", title: "MEMBER RATES", color: Color.club.primary)
                    ForEach(memberRates) { rate in
                        rateCard(rate)
                    }
                }

                // Guest rates
                if !guestRates.isEmpty {
                    sectionHeader(icon: "person.badge.plus", title: "GUEST RATES", color: .orange)
                    ForEach(guestRates) { rate in
                        rateCard(rate)
                    }
                }
            }
            .padding()
            .background(Color(.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: .black.opacity(0.04), radius: 8, y: 4)
        }
    }

    private func sectionHeader(icon: String, title: String, color: Color) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(color)
            Text(title)
                .font(.caption)
                .fontWeight(.bold)
                .tracking(1)
                .foregroundStyle(.secondary)
        }
    }

    private func rateCard(_ rate: PlayerRate) -> some View {
        Button {
            editingRate = rate
        } label: {
            HStack(spacing: 0) {
                // Left: rate info
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        if let tier = rate.tierName {
                            Text(tier)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                        } else if rate.isGuest {
                            Text("Guest")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                        }

                        if !rate.isActive {
                            Text("Inactive")
                                .font(.caption2)
                                .fontWeight(.medium)
                                .foregroundStyle(.red)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.red.opacity(0.1), in: Capsule())
                        }
                    }

                    HStack(spacing: 8) {
                        dayBadge(rate.dayType)
                        timeBadge(rate.timeType)
                        Text(rate.holes == "18" ? "18H" : "9H")
                            .font(.caption2)
                            .fontWeight(.medium)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                // Right: fees
                VStack(alignment: .trailing, spacing: 2) {
                    if rate.greensFee == 0 {
                        Text("Included")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.club.primary)
                    } else {
                        Text(formatCurrency(rate.greensFee))
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        Text("greens fee")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }

                    if rate.cartFee > 0 {
                        Text("+\(formatCurrency(rate.cartFee)) cart")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    if rate.caddieFee > 0 {
                        Text("+\(formatCurrency(rate.caddieFee)) caddie")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.quaternary)
                    .padding(.leading, 8)
            }
            .padding(12)
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .opacity(rate.isActive ? 1 : 0.5)
        }
        .buttonStyle(.plain)
    }

    private func dayBadge(_ dayType: String) -> some View {
        Text(dayType == "weekend" ? "Wknd" : "Wkdy")
            .font(.caption2)
            .fontWeight(.medium)
            .foregroundStyle(dayType == "weekend" ? Color.blue : Color(.label))
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(
                dayType == "weekend"
                    ? Color.blue.opacity(0.1)
                    : Color(.systemGray5),
                in: Capsule()
            )
    }

    private func timeBadge(_ timeType: String) -> some View {
        let (label, color): (String, Color) = switch timeType {
        case "prime": ("Prime", .orange)
        case "twilight": ("Twilight", .purple)
        default: ("Afternoon", Color.club.primary)
        }
        return Text(label)
            .font(.caption2)
            .fontWeight(.medium)
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.1), in: Capsule())
    }

    // MARK: - States

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.title)
                .foregroundStyle(.orange)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Retry") { Task { await fetchRates() } }
                .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, minHeight: 200)
    }

    private var emptyView: some View {
        VStack(spacing: 12) {
            Image(systemName: "dollarsign.circle")
                .font(.system(size: 40))
                .foregroundStyle(Color.club.primary.opacity(0.5))
            Text("No Player Rates Configured")
                .font(.custom("Georgia", size: 17))
                .fontWeight(.semibold)
            Text("Tap + to set up per-tier pricing for your courses.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, minHeight: 200)
    }

    // MARK: - API

    private func fetchRates() async {
        loading = true
        error = nil
        do {
            let response: PlayerRateResponse = try await APIClient.shared.get("/api/bookings/admin/player-rates")
            rates = response.rates
            facilities = response.facilities
            tiers = response.tiers
            loading = false
        } catch {
            self.error = "Failed to load player rates"
            loading = false
        }
    }

    private func createRate(_ body: CreateRateBody) async {
        do {
            let _: RateActionResponse = try await APIClient.shared.post("/api/bookings/admin/player-rates", body: body)
            withAnimation { successMessage = "Rate created" }
            await fetchRates()
        } catch {
            self.error = "Failed to create rate"
        }
    }

    private func updateRate(_ body: UpdateRateBody) async {
        do {
            let _: RateActionResponse = try await APIClient.shared.patch("/api/bookings/admin/player-rates", body: body)
            withAnimation { successMessage = "Rate updated" }
            await fetchRates()
        } catch {
            self.error = "Failed to update rate"
        }
    }

    private func deleteRate(_ id: String) async {
        do {
            let _: RateActionResponse = try await APIClient.shared.delete("/api/bookings/admin/player-rates?id=\(id)")
            withAnimation { successMessage = "Rate deleted" }
            await fetchRates()
        } catch {
            self.error = "Failed to delete rate"
        }
    }

    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: amount)) ?? "$\(Int(amount))"
    }
}

// MARK: - Add Player Rate Sheet

struct AddPlayerRateSheet: View {
    @Environment(\.dismiss) private var dismiss
    let facilities: [RateFacility]
    let tiers: [RateTier]
    let onSave: (CreateRateBody) async -> Void

    @State private var isGuest = false
    @State private var selectedFacilityId: String = ""
    @State private var selectedTierId: String = ""
    @State private var name: String = ""
    @State private var dayType: String = "weekday"
    @State private var timeType: String = "prime"
    @State private var holes: String = "18"
    @State private var greensFee: String = "0"
    @State private var cartFee: String = "0"
    @State private var caddieFee: String = "0"
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                // Player type
                Section {
                    Picker("Rate For", selection: $isGuest) {
                        Text("Member Tier").tag(false)
                        Text("Guest").tag(true)
                    }
                    .pickerStyle(.segmented)
                }

                // Course + tier
                Section("Assignment") {
                    Picker("Course", selection: $selectedFacilityId) {
                        Text("Select...").tag("")
                        ForEach(facilities) { f in
                            Text(f.name).tag(f.id)
                        }
                    }

                    if !isGuest {
                        Picker("Membership Tier", selection: $selectedTierId) {
                            Text("Select...").tag("")
                            ForEach(tiers) { t in
                                Text("\(t.name) (\(t.level))").tag(t.id)
                            }
                        }
                    }
                }

                // Conditions
                Section("Conditions") {
                    Picker("Day", selection: $dayType) {
                        Text("Weekday (Mon-Fri)").tag("weekday")
                        Text("Weekend (Sat-Sun)").tag("weekend")
                    }

                    Picker("Time", selection: $timeType) {
                        Text("Prime (before 12pm)").tag("prime")
                        Text("Afternoon (12-4pm)").tag("afternoon")
                        Text("Twilight (after 4pm)").tag("twilight")
                    }

                    Picker("Holes", selection: $holes) {
                        Text("18 Holes").tag("18")
                        Text("9 Holes").tag("9")
                    }
                }

                // Pricing
                Section("Pricing") {
                    HStack {
                        Text("Greens Fee")
                        Spacer()
                        Text("$")
                            .foregroundStyle(.secondary)
                        TextField("0", text: $greensFee)
                            .keyboardType(.decimalPad)
                            .frame(width: 80)
                            .multilineTextAlignment(.trailing)
                    }

                    HStack {
                        Text("Cart Fee")
                        Spacer()
                        Text("$")
                            .foregroundStyle(.secondary)
                        TextField("0", text: $cartFee)
                            .keyboardType(.decimalPad)
                            .frame(width: 80)
                            .multilineTextAlignment(.trailing)
                    }

                    HStack {
                        Text("Caddie Fee")
                        Spacer()
                        Text("$")
                            .foregroundStyle(.secondary)
                        TextField("0", text: $caddieFee)
                            .keyboardType(.decimalPad)
                            .frame(width: 80)
                            .multilineTextAlignment(.trailing)
                    }
                }

                // Name (optional)
                Section("Rate Name (optional)") {
                    TextField("Auto-generated if blank", text: $name)
                }
            }
            .navigationTitle("Add Player Rate")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saving = true
                        Task {
                            let autoName = isGuest
                                ? "Guest \u{2014} \(dayLabel) \(timeLabel) \(holes)"
                                : "\(tiers.first { $0.id == selectedTierId }?.name ?? "Member") \u{2014} \(dayLabel) \(timeLabel) \(holes)"

                            await onSave(CreateRateBody(
                                facilityId: selectedFacilityId,
                                name: name.isEmpty ? autoName : name,
                                tierId: isGuest ? nil : (selectedTierId.isEmpty ? nil : selectedTierId),
                                isGuest: isGuest,
                                dayType: dayType,
                                timeType: timeType,
                                holes: holes,
                                greensFee: Double(greensFee) ?? 0,
                                cartFee: Double(cartFee) ?? 0,
                                caddieFee: Double(caddieFee) ?? 0
                            ))
                            saving = false
                            dismiss()
                        }
                    }
                    .disabled(saving || selectedFacilityId.isEmpty || (!isGuest && selectedTierId.isEmpty))
                    .fontWeight(.semibold)
                }
            }
            .onAppear {
                if selectedFacilityId.isEmpty, let first = facilities.first {
                    selectedFacilityId = first.id
                }
            }
        }
    }

    private var dayLabel: String {
        dayType == "weekend" ? "Weekend" : "Weekday"
    }

    private var timeLabel: String {
        switch timeType {
        case "prime": return "Prime"
        case "twilight": return "Twilight"
        default: return "Afternoon"
        }
    }
}

// MARK: - Edit Player Rate Sheet

struct EditPlayerRateSheet: View {
    @Environment(\.dismiss) private var dismiss
    let rate: PlayerRate
    let onSave: (UpdateRateBody) async -> Void
    let onDelete: () async -> Void

    @State private var greensFee: String
    @State private var cartFee: String
    @State private var caddieFee: String
    @State private var isActive: Bool
    @State private var saving = false
    @State private var showDeleteConfirm = false

    init(rate: PlayerRate, onSave: @escaping (UpdateRateBody) async -> Void, onDelete: @escaping () async -> Void) {
        self.rate = rate
        self.onSave = onSave
        self.onDelete = onDelete
        _greensFee = State(initialValue: String(format: "%.2f", rate.greensFee))
        _cartFee = State(initialValue: String(format: "%.2f", rate.cartFee))
        _caddieFee = State(initialValue: String(format: "%.2f", rate.caddieFee))
        _isActive = State(initialValue: rate.isActive)
    }

    var body: some View {
        NavigationStack {
            Form {
                // Read-only info
                Section("Rate Details") {
                    LabeledContent("Name", value: rate.name)
                    if let tier = rate.tierName {
                        LabeledContent("Tier", value: tier)
                    }
                    if rate.isGuest {
                        LabeledContent("Type", value: "Guest Rate")
                    }
                    LabeledContent("Day", value: rate.dayType == "weekend" ? "Weekend" : "Weekday")
                    LabeledContent("Time", value: rate.timeType.capitalized)
                    LabeledContent("Holes", value: "\(rate.holes) Holes")
                }

                // Editable fees
                Section("Pricing") {
                    HStack {
                        Text("Greens Fee")
                        Spacer()
                        Text("$")
                            .foregroundStyle(.secondary)
                        TextField("0", text: $greensFee)
                            .keyboardType(.decimalPad)
                            .frame(width: 80)
                            .multilineTextAlignment(.trailing)
                    }

                    HStack {
                        Text("Cart Fee")
                        Spacer()
                        Text("$")
                            .foregroundStyle(.secondary)
                        TextField("0", text: $cartFee)
                            .keyboardType(.decimalPad)
                            .frame(width: 80)
                            .multilineTextAlignment(.trailing)
                    }

                    HStack {
                        Text("Caddie Fee")
                        Spacer()
                        Text("$")
                            .foregroundStyle(.secondary)
                        TextField("0", text: $caddieFee)
                            .keyboardType(.decimalPad)
                            .frame(width: 80)
                            .multilineTextAlignment(.trailing)
                    }
                }

                Section {
                    Toggle("Active", isOn: $isActive)
                }

                // Delete
                Section {
                    Button(role: .destructive) {
                        showDeleteConfirm = true
                    } label: {
                        HStack {
                            Spacer()
                            Text("Delete Rate")
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Edit Rate")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saving = true
                        Task {
                            await onSave(UpdateRateBody(
                                id: rate.id,
                                greensFee: Double(greensFee) ?? rate.greensFee,
                                cartFee: Double(cartFee) ?? rate.cartFee,
                                caddieFee: Double(caddieFee) ?? rate.caddieFee,
                                isActive: isActive
                            ))
                            saving = false
                            dismiss()
                        }
                    }
                    .disabled(saving)
                    .fontWeight(.semibold)
                }
            }
            .alert("Delete Rate?", isPresented: $showDeleteConfirm) {
                Button("Cancel", role: .cancel) { }
                Button("Delete", role: .destructive) {
                    Task {
                        await onDelete()
                        dismiss()
                    }
                }
            } message: {
                Text("This will permanently remove \"\(rate.name)\". This action cannot be undone.")
            }
        }
    }
}
