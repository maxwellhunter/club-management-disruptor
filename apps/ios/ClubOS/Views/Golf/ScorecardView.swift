import SwiftUI

// MARK: - Scorecard Models

struct GolfRound: Decodable, Identifiable {
    let id: String
    let facilityId: String
    let facilityName: String
    let bookingId: String?
    let playedAt: String
    let teeSet: String
    let holesPlayed: Int
    let totalScore: Int?
    let totalPutts: Int?
    let totalFairwaysHit: Int?
    let totalGreensInRegulation: Int?
    let weather: String?
    let status: String
    let scoreToPar: Int?
    let coursePar: Int?
    let memberFirstName: String?
    let memberLastName: String?
}

struct RoundsResponse: Decodable {
    let rounds: [GolfRound]
    let facilities: [ScorecardFacility]
    let role: String?
}

struct ScorecardFacility: Decodable, Identifiable {
    let id: String
    let name: String
}

struct CourseHole: Decodable, Identifiable {
    var id: String { "\(facilityId ?? "")_\(holeNumber)" }
    let facilityId: String?
    let holeNumber: Int
    let par: Int
    let yardageBack: Int
    let yardageMiddle: Int?
    let yardageForward: Int?
    let handicapIndex: Int

    // No CodingKeys needed — APIClient uses .convertFromSnakeCase
}

struct RoundDetailResponse: Decodable {
    let round: GolfRound
    let scores: [HoleScore]
    let holes: [CourseHole]
}

struct HoleScore: Decodable {
    let holeNumber: Int
    let strokes: Int?
    let putts: Int?
    let fairwayHit: Bool?
    let greenInRegulation: Bool?
    let penaltyStrokes: Int
}

struct CreateRoundResponse: Decodable {
    let round: GolfRound
}

struct CourseLayoutResponse: Decodable {
    let facility: ScorecardFacility
    let holes: [CourseHole]
    let totalPar: Int
    let totalYardage: CourseYardage
}

struct CourseYardage: Decodable {
    let back: Int
    let middle: Int
    let forward: Int
}

// MARK: - Editable Score (local state)

struct EditableScore {
    var strokes: Int?
    var putts: Int?
    var fairwayHit: Bool?
    var greenInRegulation: Bool?
    var penaltyStrokes: Int = 0
}

struct CreateRoundRequest: Encodable {
    let facilityId: String
    let playedAt: String
    let teeSet: String
    let holesPlayed: Int
    let weather: String?
    let bookingId: String?
}

struct TodayBookingInfo: Decodable, Identifiable {
    let id: String
    let facilityId: String
    let facilityName: String
    let facilityType: String
    let date: String
    let startTime: String
    let partySize: Int
    let status: String
    let isOwner: Bool?
}

struct TodayBookingsResponse: Decodable {
    let bookings: [TodayBookingInfo]
}

// MARK: - Scorecard View

struct ScorecardView: View {
    enum Screen { case history, newRound, scoring, courseSetup }

    @State private var screen: Screen = .history
    @State private var userRole = "member"

    // History
    @State private var rounds: [GolfRound] = []
    @State private var facilities: [ScorecardFacility] = []
    @State private var loading = true

    // New round form
    @State private var selectedFacilityId = ""
    @State private var teeSet = "middle"
    @State private var holesPlayed = 18
    @State private var weather = ""
    @State private var creating = false

    // Active scoring
    @State private var activeRoundId: String?
    @State private var activeRound: GolfRound?
    @State private var courseHoles: [CourseHole] = []
    @State private var scores: [Int: EditableScore] = [:]
    @State private var activeHole = 1
    @State private var saving = false

    // Today's bookings (for "Start Round from Booking")
    @State private var todayBookings: [TodayBookingInfo] = []
    @State private var pendingBookingId: String?
    @State private var startingFromBooking = false

    // Course setup (admin)
    @State private var setupFacilityId = ""
    @State private var setupHoles: [EditableCourseHole] = []
    @State private var loadingCourse = false
    @State private var savingCourse = false
    @State private var courseError: String?
    @State private var showCourseSaved = false

    private let teeSets = [("back", "Back"), ("middle", "Middle"), ("forward", "Forward")]
    private let weatherOptions = [
        ("", "None"), ("sunny", "Sunny"), ("cloudy", "Cloudy"),
        ("windy", "Windy"), ("rainy", "Rainy"), ("cold", "Cold"),
    ]
    private let weatherIcons: [String: String] = [
        "sunny": "sun.max.fill", "cloudy": "cloud.fill",
        "windy": "wind", "rainy": "cloud.rain.fill", "cold": "snowflake",
    ]

    var body: some View {
        ZStack {
            Color.club.background.ignoresSafeArea()

            switch screen {
            case .history:
                historyView
            case .newRound:
                newRoundView
            case .scoring:
                scoringView
            case .courseSetup:
                courseSetupView
            }
        }
        .navigationTitle(screen == .history ? "Scorecard" : "")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            async let r: () = fetchRounds()
            async let b: () = fetchTodayBookings()
            _ = await (r, b)
        }
        .alert("Course Saved!", isPresented: $showCourseSaved) {
            Button("OK") { screen = .history }
        } message: {
            Text("The course layout has been updated successfully.")
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Round History
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var historyView: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 20) {
                // Hero
                VStack(spacing: 8) {
                    Image(systemName: "flag.fill")
                        .font(.system(size: 36))
                        .foregroundStyle(Color.club.primary)
                        .frame(width: 64, height: 64)
                        .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 18))

                    Text("My Scorecard")
                        .font(.custom("Georgia", size: 22).weight(.bold))
                        .foregroundStyle(Color.club.foreground)

                    Text("Track your rounds and watch your game improve.")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
                .padding(.top, 16)
                .padding(.bottom, 4)

                // Action buttons
                VStack(spacing: 10) {
                    Button {
                        if !facilities.isEmpty && selectedFacilityId.isEmpty {
                            selectedFacilityId = facilities.first?.id ?? ""
                        }
                        pendingBookingId = nil
                        screen = .newRound
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "plus")
                                .font(.system(size: 14, weight: .bold))
                            Text("Log Practice Round")
                                .font(.system(size: 14, weight: .semibold))
                        }
                        .foregroundStyle(Color.club.primary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.club.primary.opacity(0.3), lineWidth: 1)
                        )
                    }


                }
                .padding(.horizontal, 20)

                // ── Ready to Play (today's bookings without rounds) ──
                if !eligibleBookings.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("READY TO PLAY")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Color.club.outline)
                            .padding(.horizontal, 20)

                        ForEach(eligibleBookings) { booking in
                            readyToPlayCard(booking)
                        }
                    }
                }

                // ── Active Rounds (in progress) ──
                let activeRounds = rounds.filter { $0.status == "in_progress" }
                if !activeRounds.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("IN PROGRESS")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Color.club.outline)
                            .padding(.horizontal, 20)

                        ForEach(activeRounds) { round in
                            activeRoundCard(round)
                        }
                    }
                }

                // Stats summary (if rounds exist)
                if !rounds.isEmpty {
                    statsSummary
                }

                // Past round list
                let pastRounds = rounds.filter { $0.status != "in_progress" }
                if loading {
                    ProgressView()
                        .tint(Color.club.primary)
                        .padding(.top, 40)
                } else if rounds.isEmpty && eligibleBookings.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "figure.golf")
                            .font(.system(size: 32))
                            .foregroundStyle(Color.club.outlineVariant)
                        Text("No rounds yet")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                        Text("Book a tee time to get started")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.outline)
                    }
                    .padding(.top, 32)
                } else if !pastRounds.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("PAST ROUNDS")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Color.club.outline)
                            .padding(.horizontal, 20)

                        ForEach(pastRounds) { round in
                            roundCard(round)
                        }
                    }
                }

                Spacer(minLength: 32)
            }
        }
        .refreshable { await fetchRounds() }
    }

    private var statsSummary: some View {
        let completed = rounds.filter { $0.status == "completed" }
        let avgScore: Double? = {
            let scores = completed.compactMap(\.totalScore)
            guard !scores.isEmpty else { return nil }
            return Double(scores.reduce(0, +)) / Double(scores.count)
        }()
        let bestScore = completed.compactMap(\.totalScore).min()
        let avgPutts: Double? = {
            let putts = completed.compactMap(\.totalPutts)
            guard !putts.isEmpty else { return nil }
            return Double(putts.reduce(0, +)) / Double(putts.count)
        }()

        return HStack(spacing: 0) {
            statBox(label: "Rounds", value: "\(completed.count)", icon: "flag.fill")
            Divider().frame(height: 40)
            statBox(label: "Best", value: bestScore.map { "\($0)" } ?? "—", icon: "trophy.fill")
            Divider().frame(height: 40)
            statBox(label: "Avg Score", value: avgScore.map { String(format: "%.1f", $0) } ?? "—", icon: "chart.line.uptrend.xyaxis")
            Divider().frame(height: 40)
            statBox(label: "Avg Putts", value: avgPutts.map { String(format: "%.1f", $0) } ?? "—", icon: "circle.circle")
        }
        .padding(.vertical, 16)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 20)
    }

    private func statBox(label: String, value: String, icon: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(Color.club.primary)
            Text(value)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Color.club.foreground)
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(Color.club.outline)
        }
        .frame(maxWidth: .infinity)
    }

    // ── Ready to Play card (today's booking, no round started) ──

    private func readyToPlayCard(_ booking: TodayBookingInfo) -> some View {
        HStack(spacing: 14) {
            Image(systemName: "flag.fill")
                .font(.system(size: 20))
                .foregroundStyle(.white)
                .frame(width: 48, height: 48)
                .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 14))

            VStack(alignment: .leading, spacing: 4) {
                Text(booking.facilityName)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.club.foreground)

                Text("Today at \(formatTime(booking.startTime)) \u{00B7} \(booking.partySize) \(booking.partySize == 1 ? "player" : "players")")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }

            Spacer()

            Button {
                Task { await startRoundFromBooking(booking) }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "flag.fill")
                        .font(.system(size: 11))
                    Text("Start")
                        .font(.system(size: 13, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color.club.primary, in: RoundedRectangle(cornerRadius: 10))
            }
            .disabled(startingFromBooking)
            .opacity(startingFromBooking ? 0.6 : 1.0)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.club.accent.opacity(0.3))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.club.primary.opacity(0.3), lineWidth: 1.5)
        )
        .padding(.horizontal, 20)
    }

    // ── Active round card (in progress, tappable to continue) ──

    private func activeRoundCard(_ round: GolfRound) -> some View {
        Button {
            Task { await loadRoundForScoring(round.id) }
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "clock.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(.orange)
                    .frame(width: 48, height: 48)
                    .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))

                VStack(alignment: .leading, spacing: 4) {
                    Text(round.facilityName)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.club.foreground)

                    Text("\(round.holesPlayed)H \u{00B7} \(round.teeSet.capitalized) tees \u{00B7} \(formatDate(round.playedAt))")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }

                Spacer()

                HStack(spacing: 4) {
                    Text("Continue")
                        .font(.system(size: 13, weight: .semibold))
                    Image(systemName: "arrow.right")
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(.orange)
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.orange.opacity(0.06))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.orange.opacity(0.25), lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20)
    }

    // ── Past round card ──

    private func roundCard(_ round: GolfRound) -> some View {
        Button {
            if round.status == "in_progress" {
                Task { await loadRoundForScoring(round.id) }
            }
        } label: {
            HStack(spacing: 14) {
                // Score circle
                ZStack {
                    Circle()
                        .fill(scoreColor(round.scoreToPar).opacity(0.12))
                        .frame(width: 52, height: 52)
                    if let score = round.totalScore {
                        Text("\(score)")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(scoreColor(round.scoreToPar))
                    } else {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 16))
                            .foregroundStyle(Color.club.outline)
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(round.facilityName)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.club.foreground)
                            .lineLimit(1)
                        Spacer()
                        statusBadge(round.status)
                    }

                    HStack(spacing: 12) {
                        HStack(spacing: 4) {
                            Image(systemName: "calendar")
                                .font(.system(size: 10))
                            Text(formatDate(round.playedAt))
                                .font(.system(size: 12))
                        }
                        .foregroundStyle(Color.club.onSurfaceVariant)

                        if let par = round.coursePar, let score = round.totalScore {
                            let diff = score - par
                            Text(diff == 0 ? "E" : diff > 0 ? "+\(diff)" : "\(diff)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(scoreColor(round.scoreToPar))
                        }

                        HStack(spacing: 4) {
                            Image(systemName: "figure.golf")
                                .font(.system(size: 10))
                            Text("\(round.holesPlayed)H · \(round.teeSet.capitalized)")
                                .font(.system(size: 11))
                        }
                        .foregroundStyle(Color.club.outline)
                    }

                    // Mini stats row
                    if round.status == "completed" {
                        HStack(spacing: 10) {
                            if let putts = round.totalPutts {
                                miniStat(icon: "circle.circle", label: "\(putts) putts")
                            }
                            if let fh = round.totalFairwaysHit {
                                miniStat(icon: "arrow.up.right", label: "\(fh) FW")
                            }
                            if let gir = round.totalGreensInRegulation {
                                miniStat(icon: "flag", label: "\(gir) GIR")
                            }
                            if let w = round.weather, let icon = weatherIcons[w] {
                                miniStat(icon: icon, label: w.capitalized)
                            }
                        }
                    }
                }
            }
            .padding(14)
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))
            .shadow(color: Color.club.foreground.opacity(0.03), radius: 8, y: 2)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 20)
    }

    private func miniStat(icon: String, label: String) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 9))
            Text(label)
                .font(.system(size: 10))
        }
        .foregroundStyle(Color.club.onSurfaceVariant)
    }

    private func statusBadge(_ status: String) -> some View {
        let (text, color): (String, Color) = {
            switch status {
            case "in_progress": return ("In Progress", .orange)
            case "completed": return ("Complete", Color.club.primary)
            case "verified": return ("Verified", Color(hex: "0284c7"))
            default: return (status.capitalized, Color.club.outline)
            }
        }()

        return Text(text)
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.1), in: Capsule())
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - New Round
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var newRoundView: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 24) {
                screenHeader(
                    title: pendingBookingId != nil ? "Start Round" : "Log Practice Round",
                    subtitle: pendingBookingId != nil ? "Starting round from your booking" : "Set up your round details",
                    backAction: { pendingBookingId = nil; screen = .history }
                )

                // Course picker
                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("COURSE")

                    ForEach(facilities) { fac in
                        let isSelected = selectedFacilityId == fac.id
                        Button { selectedFacilityId = fac.id } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "figure.golf")
                                    .font(.system(size: 16))
                                    .foregroundStyle(isSelected ? .white : Color.club.primary)
                                    .frame(width: 36, height: 36)
                                    .background(
                                        isSelected ? Color.club.primary : Color.club.accent,
                                        in: RoundedRectangle(cornerRadius: 10)
                                    )
                                Text(fac.name)
                                    .font(.system(size: 15, weight: .medium))
                                    .foregroundStyle(Color.club.foreground)
                                Spacer()
                                if isSelected {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.system(size: 18))
                                        .foregroundStyle(Color.club.primary)
                                }
                            }
                            .padding(12)
                            .background(
                                isSelected ? Color.club.accent.opacity(0.3) : Color.club.surfaceContainerLowest,
                                in: RoundedRectangle(cornerRadius: 12)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(isSelected ? Color.club.primary.opacity(0.4) : Color.club.outlineVariant.opacity(0.3), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)

                // Tee set
                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("TEE SET")

                    HStack(spacing: 8) {
                        ForEach(teeSets, id: \.0) { key, label in
                            let isSelected = teeSet == key
                            let teeColor: Color = key == "back" ? Color(hex: "1e293b") :
                                key == "middle" ? Color(hex: "f8fafc") : Color(hex: "dc2626")

                            Button { teeSet = key } label: {
                                HStack(spacing: 8) {
                                    Circle()
                                        .fill(teeColor)
                                        .frame(width: 14, height: 14)
                                        .overlay(Circle().stroke(Color.club.outline.opacity(0.3), lineWidth: 1))
                                    Text(label)
                                        .font(.system(size: 14, weight: .medium))
                                }
                                .foregroundStyle(isSelected ? .white : Color.club.foreground)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
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
                .padding(.horizontal, 20)

                // Holes
                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("HOLES")

                    HStack(spacing: 10) {
                        ForEach([18, 9], id: \.self) { count in
                            let isSelected = holesPlayed == count
                            Button { holesPlayed = count } label: {
                                Text("\(count) Holes")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(isSelected ? .white : Color.club.foreground)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
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
                .padding(.horizontal, 20)

                // Weather
                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("WEATHER (OPTIONAL)")

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(weatherOptions, id: \.0) { key, label in
                                let isSelected = weather == key
                                Button { weather = key } label: {
                                    HStack(spacing: 5) {
                                        if let icon = weatherIcons[key] {
                                            Image(systemName: icon)
                                                .font(.system(size: 12))
                                        }
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
                        .padding(.horizontal, 20)
                    }
                }

                // Start round button
                Button {
                    Task { await createRound() }
                } label: {
                    Group {
                        if creating {
                            ProgressView().tint(.white)
                        } else {
                            HStack(spacing: 8) {
                                Image(systemName: "flag.checkered")
                                    .font(.system(size: 14))
                                Text("Start Round")
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
                            startPoint: .leading, endPoint: .trailing
                        ),
                        in: RoundedRectangle(cornerRadius: 14)
                    )
                }
                .disabled(creating || selectedFacilityId.isEmpty)
                .padding(.horizontal, 20)

                Spacer(minLength: 32)
            }
            .padding(.top, 8)
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Hole-by-Hole Scoring
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var scoringView: some View {
        let holeCount = activeRound?.holesPlayed ?? 18
        let currentHoleData = courseHoles.first(where: { $0.holeNumber == activeHole })
        let currentScore = scores[activeHole] ?? EditableScore()

        return VStack(spacing: 0) {
            // Top bar
            HStack {
                Button {
                    Task {
                        await saveScores()
                        screen = .history
                        await fetchRounds()
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 13, weight: .semibold))
                        Text("Save & Exit")
                            .font(.system(size: 13, weight: .medium))
                    }
                    .foregroundStyle(Color.club.onSurfaceVariant)
                }

                Spacer()

                // Running total
                let totalStrokes = scores.values.compactMap(\.strokes).reduce(0, +)
                let totalPar = courseHoles.prefix(holeCount).reduce(0) { $0 + $1.par }
                let diff = totalStrokes - totalPar
                HStack(spacing: 6) {
                    Text("\(totalStrokes)")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Color.club.foreground)
                    if totalStrokes > 0 {
                        Text(diff == 0 ? "E" : diff > 0 ? "+\(diff)" : "\(diff)")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(scoreColor(diff))
                    }
                }

                Spacer()

                if saving {
                    ProgressView()
                        .tint(Color.club.primary)
                        .scaleEffect(0.8)
                } else {
                    Button {
                        Task { await completeRound() }
                    } label: {
                        Text("Finish")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 7)
                            .background(Color.club.primary, in: Capsule())
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)

            // Hole selector strip
            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(1...holeCount, id: \.self) { hole in
                            let hasScore = scores[hole]?.strokes != nil
                            let isActive = activeHole == hole
                            Button {
                                withAnimation(.easeInOut(duration: 0.15)) { activeHole = hole }
                            } label: {
                                VStack(spacing: 2) {
                                    Text("\(hole)")
                                        .font(.system(size: 14, weight: isActive ? .bold : .medium))
                                    if hasScore, let s = scores[hole]?.strokes {
                                        Text("\(s)")
                                            .font(.system(size: 10, weight: .bold))
                                    } else {
                                        Text("·")
                                            .font(.system(size: 10))
                                    }
                                }
                                .foregroundStyle(
                                    isActive ? .white :
                                    hasScore ? Color.club.foreground : Color.club.outline
                                )
                                .frame(width: 36, height: 44)
                                .background(
                                    isActive ? Color.club.primary :
                                    hasScore ? Color.club.accent.opacity(0.4) : Color.club.surfaceContainerHigh,
                                    in: RoundedRectangle(cornerRadius: 10)
                                )
                            }
                            .buttonStyle(.plain)
                            .id(hole)
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .onChange(of: activeHole) { _, newVal in
                    withAnimation { proxy.scrollTo(newVal, anchor: .center) }
                }
            }
            .padding(.vertical, 8)

            Divider()

            // Hole detail scoring
            ScrollView(showsIndicators: false) {
                VStack(spacing: 24) {
                    // Hole header
                    VStack(spacing: 8) {
                        Text("Hole \(activeHole)")
                            .font(.custom("Georgia", size: 28).weight(.bold))
                            .foregroundStyle(Color.club.foreground)

                        if let holeData = currentHoleData {
                            HStack(spacing: 16) {
                                holeMeta(label: "Par", value: "\(holeData.par)")
                                holeMeta(label: "Yds", value: yardageForTee(holeData))
                                holeMeta(label: "HCP", value: "\(holeData.handicapIndex)")
                            }
                        }
                    }
                    .padding(.top, 16)

                    // Strokes
                    VStack(spacing: 10) {
                        Text("STROKES")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Color.club.outline)

                        let par = currentHoleData?.par ?? 4
                        HStack(spacing: 8) {
                            ForEach(max(1, par - 2)...par + 4, id: \.self) { num in
                                let isSelected = currentScore.strokes == num
                                Button {
                                    scores[activeHole, default: EditableScore()].strokes = num
                                } label: {
                                    Text("\(num)")
                                        .font(.system(size: 18, weight: .bold))
                                        .foregroundStyle(isSelected ? .white : strokeColor(num, par: par))
                                        .frame(width: 44, height: 44)
                                        .background(
                                            isSelected ? strokeColor(num, par: par) : strokeColor(num, par: par).opacity(0.08),
                                            in: RoundedRectangle(cornerRadius: 12)
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        if let strokes = currentScore.strokes, let par = currentHoleData?.par {
                            Text(strokeLabel(strokes, par: par))
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(strokeColor(strokes, par: par))
                        }
                    }

                    // Putts
                    VStack(spacing: 10) {
                        Text("PUTTS")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Color.club.outline)

                        HStack(spacing: 8) {
                            ForEach(0...5, id: \.self) { num in
                                let isSelected = currentScore.putts == num
                                Button {
                                    scores[activeHole, default: EditableScore()].putts = num
                                } label: {
                                    Text("\(num)")
                                        .font(.system(size: 16, weight: .semibold))
                                        .foregroundStyle(isSelected ? .white : Color.club.foreground)
                                        .frame(width: 40, height: 40)
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

                    // Fairway hit (skip for par 3s)
                    if currentHoleData?.par != 3 {
                        VStack(spacing: 10) {
                            Text("FAIRWAY")
                                .font(.system(size: 10, weight: .bold))
                                .tracking(1)
                                .foregroundStyle(Color.club.outline)

                            HStack(spacing: 12) {
                                fairwayButton(label: "Hit", icon: "checkmark", value: true, current: currentScore.fairwayHit)
                                fairwayButton(label: "Missed", icon: "xmark", value: false, current: currentScore.fairwayHit)
                            }
                        }
                    }

                    // GIR
                    VStack(spacing: 10) {
                        Text("GREEN IN REGULATION")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(Color.club.outline)

                        HStack(spacing: 12) {
                            fairwayButton(label: "Yes", icon: "flag.fill", value: true, current: currentScore.greenInRegulation, isGir: true)
                            fairwayButton(label: "No", icon: "flag", value: false, current: currentScore.greenInRegulation, isGir: true)
                        }
                    }

                    Spacer(minLength: 80)
                }
            }

            // Navigation footer
            HStack(spacing: 16) {
                Button {
                    if activeHole > 1 {
                        withAnimation { activeHole -= 1 }
                    }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(activeHole > 1 ? Color.club.foreground : Color.club.outline)
                        .frame(width: 44, height: 44)
                        .background(Color.club.surfaceContainerHigh, in: Circle())
                }
                .disabled(activeHole <= 1)

                Spacer()

                // Auto-save indicator
                Text("Auto-saves as you score")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.club.outline)

                Spacer()

                Button {
                    // Save current hole and advance
                    Task { await saveScores() }
                    if activeHole < holeCount {
                        withAnimation { activeHole += 1 }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(activeHole < holeCount ? "Next" : "Done")
                            .font(.system(size: 14, weight: .bold))
                        Image(systemName: activeHole < holeCount ? "chevron.right" : "checkmark")
                            .font(.system(size: 13, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(Color.club.primary, in: Capsule())
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial)
        }
    }

    private func holeMeta(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(Color.club.outline)
            Text(value)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Color.club.foreground)
        }
        .frame(width: 56)
        .padding(.vertical, 8)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 10))
    }

    private func fairwayButton(label: String, icon: String, value: Bool, current: Bool?, isGir: Bool = false) -> some View {
        let isSelected = current == value
        return Button {
            if isGir {
                scores[activeHole, default: EditableScore()].greenInRegulation = value
            } else {
                scores[activeHole, default: EditableScore()].fairwayHit = value
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 13))
                Text(label)
                    .font(.system(size: 14, weight: .medium))
            }
            .foregroundStyle(isSelected ? .white : Color.club.foreground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(
                isSelected
                    ? (value ? Color.club.primary : Color(hex: "dc2626"))
                    : Color.club.surfaceContainerLowest,
                in: RoundedRectangle(cornerRadius: 12)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.clear : Color.club.outlineVariant.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Admin Course Setup
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var courseSetupView: some View {
        VStack(spacing: 0) {
            screenHeader(
                title: "Course Setup",
                subtitle: "Set pars, yardage & handicap for each hole",
                backAction: { screen = .history }
            )

            // Facility picker
            if facilities.count > 1 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(facilities) { fac in
                            let isSelected = setupFacilityId == fac.id
                            Button {
                                setupFacilityId = fac.id
                                Task { await loadCourseForSetup() }
                            } label: {
                                Text(fac.name)
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
                                            .stroke(isSelected ? Color.clear : Color.club.outlineVariant.opacity(0.3), lineWidth: 1)
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 8)
                }
            }

            if loadingCourse {
                Spacer()
                ProgressView().tint(Color.club.primary)
                Spacer()
            } else {
                // Column headers
                HStack(spacing: 0) {
                    Text("Hole")
                        .frame(width: 42, alignment: .leading)
                    Text("Par")
                        .frame(width: 56)
                    Text("Back")
                        .frame(width: 62)
                    Text("Mid")
                        .frame(width: 62)
                    Text("Fwd")
                        .frame(width: 62)
                    Text("HCP")
                        .frame(width: 44)
                }
                .font(.system(size: 10, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Color.club.outline)
                .padding(.horizontal, 20)
                .padding(.vertical, 8)

                Divider().padding(.horizontal, 20)

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 2) {
                        ForEach(setupHoles.indices, id: \.self) { index in
                            courseHoleRow(index: index)
                        }

                        // Totals row
                        if !setupHoles.isEmpty {
                            Divider().padding(.horizontal, 20).padding(.top, 4)
                            HStack(spacing: 0) {
                                Text("Total")
                                    .font(.system(size: 12, weight: .bold))
                                    .frame(width: 42, alignment: .leading)
                                Text("\(setupHoles.reduce(0) { $0 + $1.par })")
                                    .font(.system(size: 12, weight: .bold))
                                    .frame(width: 56)
                                Text("\(setupHoles.reduce(0) { $0 + $1.yardageBack })")
                                    .font(.system(size: 12, weight: .bold))
                                    .frame(width: 62)
                                Text("\(setupHoles.reduce(0) { $0 + $1.yardageMiddle })")
                                    .font(.system(size: 12, weight: .bold))
                                    .frame(width: 62)
                                Text("\(setupHoles.reduce(0) { $0 + $1.yardageForward })")
                                    .font(.system(size: 12, weight: .bold))
                                    .frame(width: 62)
                                Text("")
                                    .frame(width: 44)
                            }
                            .foregroundStyle(Color.club.foreground)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 8)
                        }

                        // Add hole button
                        if setupHoles.count < 18 {
                            Button {
                                let nextNum = setupHoles.count + 1
                                let nextHcp = setupHoles.count + 1
                                setupHoles.append(EditableCourseHole(
                                    holeNumber: nextNum, par: 4,
                                    yardageBack: 350, yardageMiddle: 325, yardageForward: 290,
                                    handicapIndex: nextHcp
                                ))
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "plus.circle.fill")
                                        .font(.system(size: 14))
                                    Text("Add Hole \(setupHoles.count + 1)")
                                        .font(.system(size: 13, weight: .semibold))
                                }
                                .foregroundStyle(Color.club.primary)
                                .padding(.vertical, 12)
                                .frame(maxWidth: .infinity)
                                .background(Color.club.accent.opacity(0.3), in: RoundedRectangle(cornerRadius: 10))
                            }
                            .padding(.horizontal, 20)
                            .padding(.top, 8)
                        }

                        if let error = courseError {
                            Text(error)
                                .font(.system(size: 12))
                                .foregroundStyle(Color.club.destructive)
                                .padding(.horizontal, 20)
                                .padding(.top, 8)
                        }

                        Spacer(minLength: 100)
                    }
                }
            }

            // Save button
            VStack(spacing: 8) {
                Divider()
                Button {
                    Task { await saveCourseLayout() }
                } label: {
                    Group {
                        if savingCourse {
                            ProgressView().tint(.white)
                        } else {
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 16))
                                Text("Save Course Layout")
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
                            startPoint: .leading, endPoint: .trailing
                        ),
                        in: RoundedRectangle(cornerRadius: 14)
                    )
                }
                .disabled(savingCourse || setupHoles.isEmpty)
                .padding(.horizontal, 20)
                .padding(.bottom, 8)
            }
            .background(.ultraThinMaterial)
        }
    }

    private func courseHoleRow(index: Int) -> some View {
        let isEven = index % 2 == 0
        let isFront9Break = index == 9

        return VStack(spacing: 0) {
            if isFront9Break {
                HStack {
                    Text("BACK 9")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(1)
                        .foregroundStyle(Color.club.primary)
                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 6)
                .background(Color.club.accent.opacity(0.3))
            }

            HStack(spacing: 0) {
                // Hole number
                Text("\(setupHoles[index].holeNumber)")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.club.primary)
                    .frame(width: 42, alignment: .leading)

                // Par stepper
                Stepper("", value: $setupHoles[index].par, in: 3...6)
                    .labelsHidden()
                    .frame(width: 56)
                    .overlay {
                        Text("\(setupHoles[index].par)")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Color.club.foreground)
                            .allowsHitTesting(false)
                    }

                // Yardage fields
                compactNumberField(value: $setupHoles[index].yardageBack)
                    .frame(width: 62)
                compactNumberField(value: $setupHoles[index].yardageMiddle)
                    .frame(width: 62)
                compactNumberField(value: $setupHoles[index].yardageForward)
                    .frame(width: 62)

                // HCP stepper
                Stepper("", value: $setupHoles[index].handicapIndex, in: 1...18)
                    .labelsHidden()
                    .frame(width: 44)
                    .overlay {
                        Text("\(setupHoles[index].handicapIndex)")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color.club.foreground)
                            .allowsHitTesting(false)
                    }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 6)
            .background(isEven ? Color.clear : Color.club.surfaceContainerLow.opacity(0.5))
        }
    }

    private func compactNumberField(value: Binding<Int>) -> some View {
        TextField("", value: value, format: .number)
            .font(.system(size: 13))
            .foregroundStyle(Color.club.foreground)
            .multilineTextAlignment(.center)
            .keyboardType(.numberPad)
            .padding(.vertical, 6)
            .padding(.horizontal, 4)
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 6))
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Color.club.outlineVariant.opacity(0.3), lineWidth: 1)
            )
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Shared Components
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

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .bold))
            .tracking(1)
            .foregroundStyle(Color.club.outline)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Scoring Helpers
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func scoreColor(_ scoreToPar: Int?) -> Color {
        guard let stp = scoreToPar else { return Color.club.outline }
        if stp <= -2 { return Color(hex: "7c3aed") } // eagle+
        if stp == -1 { return Color(hex: "0284c7") } // birdie
        if stp == 0 { return Color.club.primary }     // par
        if stp == 1 { return Color(hex: "ea580c") }   // bogey
        return Color(hex: "dc2626")                    // double+
    }

    private func strokeColor(_ strokes: Int, par: Int) -> Color {
        scoreColor(strokes - par)
    }

    private func strokeLabel(_ strokes: Int, par: Int) -> String {
        let diff = strokes - par
        switch diff {
        case ...(-3): return "Albatross!"
        case -2: return "Eagle!"
        case -1: return "Birdie"
        case 0: return "Par"
        case 1: return "Bogey"
        case 2: return "Double Bogey"
        case 3: return "Triple Bogey"
        default: return "+\(diff)"
        }
    }

    private func yardageForTee(_ hole: CourseHole) -> String {
        switch teeSet {
        case "back": return "\(hole.yardageBack)"
        case "forward": return "\(hole.yardageForward ?? hole.yardageBack)"
        default: return "\(hole.yardageMiddle ?? hole.yardageBack)"
        }
    }

    private func formatDate(_ dateStr: String) -> String {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        guard let date = df.date(from: dateStr) else { return dateStr }
        df.dateFormat = "MMM d, yyyy"
        return df.string(from: date)
    }

    private func formatTime(_ time: String) -> String {
        let parts = time.split(separator: ":")
        guard parts.count >= 2, let hour = Int(parts[0]) else { return time }
        let minute = parts[1]
        let ampm = hour >= 12 ? "PM" : "AM"
        let display = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour)
        return "\(display):\(minute) \(ampm)"
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - API Calls
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func fetchRounds() async {
        loading = true
        defer { loading = false }

        do {
            let response: RoundsResponse = try await APIClient.shared.get("/scorecards")
            rounds = response.rounds
            facilities = response.facilities
            userRole = response.role ?? "member"
            if !facilities.isEmpty && selectedFacilityId.isEmpty {
                selectedFacilityId = facilities.first?.id ?? ""
            }
            if !facilities.isEmpty && setupFacilityId.isEmpty {
                setupFacilityId = facilities.first?.id ?? ""
            }
        } catch {
            ErrorBanner.shared.show(error)
        }
    }

    private func fetchTodayBookings() async {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        let today = df.string(from: Date())

        do {
            let response: TodayBookingsResponse = try await APIClient.shared.get("/bookings/my")
            // Filter to today's golf bookings only
            todayBookings = response.bookings.filter { $0.date == today && $0.facilityType == "golf" }
        } catch {
            ErrorBanner.shared.show(error)
        }
    }

    /// Bookings that don't already have a round started
    private var eligibleBookings: [TodayBookingInfo] {
        todayBookings.filter { booking in
            !rounds.contains { $0.bookingId == booking.id }
        }
    }

    private func startRoundFromBooking(_ booking: TodayBookingInfo) async {
        startingFromBooking = true
        defer { startingFromBooking = false }

        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"

        do {
            let response: CreateRoundResponse = try await APIClient.shared.post("/scorecards", body: CreateRoundRequest(
                facilityId: booking.facilityId,
                playedAt: booking.date,
                teeSet: "middle",
                holesPlayed: 18,
                weather: nil,
                bookingId: booking.id
            ))
            await fetchTodayBookings()
            await loadRoundForScoring(response.round.id)
        } catch {
            ErrorBanner.shared.show(error)
        }
    }

    private func createRound() async {
        guard !selectedFacilityId.isEmpty else { return }
        creating = true
        defer { creating = false }

        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"

        do {
            let response: CreateRoundResponse = try await APIClient.shared.post("/scorecards", body: CreateRoundRequest(
                facilityId: selectedFacilityId,
                playedAt: df.string(from: Date()),
                teeSet: teeSet,
                holesPlayed: holesPlayed,
                weather: weather.isEmpty ? nil : weather,
                bookingId: pendingBookingId
            ))
            pendingBookingId = nil
            await loadRoundForScoring(response.round.id)
        } catch {
            ErrorBanner.shared.show(error)
        }
    }

    private func loadRoundForScoring(_ roundId: String) async {
        do {
            let response: RoundDetailResponse = try await APIClient.shared.get("/scorecards/\(roundId)")
            activeRound = response.round
            activeRoundId = roundId
            courseHoles = response.holes
            teeSet = response.round.teeSet

            var map: [Int: EditableScore] = [:]
            let holeCount = response.round.holesPlayed
            for i in 1...holeCount {
                if let existing = response.scores.first(where: { $0.holeNumber == i }) {
                    map[i] = EditableScore(
                        strokes: existing.strokes,
                        putts: existing.putts,
                        fairwayHit: existing.fairwayHit,
                        greenInRegulation: existing.greenInRegulation,
                        penaltyStrokes: existing.penaltyStrokes
                    )
                } else {
                    map[i] = EditableScore()
                }
            }
            scores = map
            activeHole = 1
            screen = .scoring
        } catch {
            ErrorBanner.shared.show(error)
        }
    }

    private func saveScores() async {
        guard let roundId = activeRoundId else { return }
        saving = true
        defer { saving = false }

        struct ScoreEntry: Encodable {
            let holeNumber: Int
            let strokes: Int?
            let putts: Int?
            let fairwayHit: Bool?
            let greenInRegulation: Bool?
            let penaltyStrokes: Int
        }

        struct ScoresPayload: Encodable {
            let scores: [ScoreEntry]
        }

        let toSave = scores.compactMap { hole, score -> ScoreEntry? in
            guard score.strokes != nil else { return nil }
            return ScoreEntry(
                holeNumber: hole,
                strokes: score.strokes,
                putts: score.putts,
                fairwayHit: score.fairwayHit,
                greenInRegulation: score.greenInRegulation,
                penaltyStrokes: score.penaltyStrokes
            )
        }
        guard !toSave.isEmpty else { return }

        do {
            try await APIClient.shared.patch("/scorecards/\(roundId)", body: ScoresPayload(scores: toSave))
        } catch {
            ErrorBanner.shared.show(error)
        }
    }

    private func completeRound() async {
        await saveScores()
        guard let roundId = activeRoundId else { return }

        struct ActionPayload: Encodable {
            let action: String
        }

        do {
            try await APIClient.shared.patch("/scorecards/\(roundId)", body: ActionPayload(action: "complete"))
            screen = .history
            await fetchRounds()
        } catch {
            ErrorBanner.shared.show(error)
        }
    }

    // ── Admin Course Setup API ──

    private func loadCourseForSetup() async {
        guard !setupFacilityId.isEmpty else { return }
        loadingCourse = true
        courseError = nil
        defer { loadingCourse = false }

        do {
            let response: CourseLayoutResponse = try await APIClient.shared.get(
                "/scorecards/course",
                query: ["facility_id": setupFacilityId]
            )
            setupHoles = response.holes.map { hole in
                EditableCourseHole(
                    holeNumber: hole.holeNumber,
                    par: hole.par,
                    yardageBack: hole.yardageBack,
                    yardageMiddle: hole.yardageMiddle ?? 0,
                    yardageForward: hole.yardageForward ?? 0,
                    handicapIndex: hole.handicapIndex
                )
            }
            // If no holes exist, seed 9 defaults
            if setupHoles.isEmpty {
                setupHoles = (1...9).map { num in
                    EditableCourseHole(
                        holeNumber: num, par: 4,
                        yardageBack: 350, yardageMiddle: 325, yardageForward: 290,
                        handicapIndex: num
                    )
                }
            }
        } catch {
            ErrorBanner.shared.show(error)
            // Seed defaults on error
            setupHoles = (1...9).map { num in
                EditableCourseHole(
                    holeNumber: num, par: 4,
                    yardageBack: 350, yardageMiddle: 325, yardageForward: 290,
                    handicapIndex: num
                )
            }
        }
    }

    private func saveCourseLayout() async {
        guard !setupFacilityId.isEmpty, !setupHoles.isEmpty else { return }
        savingCourse = true
        courseError = nil
        defer { savingCourse = false }

        struct HolePayload: Encodable {
            let holeNumber: Int
            let par: Int
            let yardageBack: Int
            let yardageMiddle: Int?
            let yardageForward: Int?
            let handicapIndex: Int
        }

        struct CoursePayload: Encodable {
            let facilityId: String
            let holes: [HolePayload]
        }

        let payload = CoursePayload(
            facilityId: setupFacilityId,
            holes: setupHoles.map { hole in
                HolePayload(
                    holeNumber: hole.holeNumber,
                    par: hole.par,
                    yardageBack: hole.yardageBack,
                    yardageMiddle: hole.yardageMiddle > 0 ? hole.yardageMiddle : nil,
                    yardageForward: hole.yardageForward > 0 ? hole.yardageForward : nil,
                    handicapIndex: hole.handicapIndex
                )
            }
        )

        do {
            let _: CourseLayoutResponse = try await APIClient.shared.put("/scorecards/course", body: payload)
            showCourseSaved = true
        } catch let error as APIError {
            courseError = error.localizedDescription
        } catch {
            courseError = "Failed to save course layout"
        }
    }
}

// MARK: - Editable Course Hole (admin form state)

struct EditableCourseHole {
    let holeNumber: Int
    var par: Int
    var yardageBack: Int
    var yardageMiddle: Int
    var yardageForward: Int
    var handicapIndex: Int
}
