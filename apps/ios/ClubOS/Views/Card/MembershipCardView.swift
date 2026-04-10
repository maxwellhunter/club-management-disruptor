import SwiftUI
import CoreImage.CIFilterBuiltins
import PassKit

// MARK: - Models

private struct WalletPassesResponse: Decodable {
    let passes: [DigitalPass]
    let recentTaps: [NfcTap]
}

private struct DigitalPass: Decodable, Identifiable {
    let id: String
    let platform: String
    let status: String
    let barcodePayload: String?
    let installedAt: String?
    let createdAt: String?
}

private struct NfcTap: Decodable, Identifiable {
    let id: String
    let tapType: String
    let location: String?
    let createdAt: String
}

private struct GeneratePassResponse: Decodable {
    let passUrl: String?
    let platform: String
    let serial: String?
    let barcodePayload: String?
}

private struct MemberCardInfo: Decodable {
    let id: String
    let firstName: String
    let lastName: String
    let email: String?
    let memberNumber: String?
    let tierName: String?
    let joinDate: String?
}

private struct MembersResponse: Decodable {
    let members: [MemberCardInfo]
}

// MARK: - View

struct MembershipCardView: View {
    @Environment(AuthViewModel.self) private var auth

    // Member info
    @State private var memberName = ""
    @State private var memberNumber = ""
    @State private var tierName = "Member"
    @State private var memberSince = ""
    @State private var memberId = ""

    // Passes & taps
    @State private var passes: [DigitalPass] = []
    @State private var recentTaps: [NfcTap] = []
    @State private var loading = true

    // Actions
    @State private var addingWallet: String?
    @State private var showWalletSuccess = false
    @State private var walletError: String?
    @State private var checkingIn = false
    @State private var showCheckinSuccess = false
    @State private var checkinResult: String?

    var body: some View {
        ZStack {
            Color.club.background.ignoresSafeArea()

            if loading {
                ProgressView()
                    .tint(Color.club.primary)
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 24) {
                        // The Card
                        membershipCard
                            .padding(.horizontal, 20)
                            .padding(.top, 8)

                        // Quick actions
                        actionButtons
                            .padding(.horizontal, 20)

                        // Barcode
                        barcodeSection
                            .padding(.horizontal, 20)

                        // Wallet passes
                        walletSection
                            .padding(.horizontal, 20)

                        // Recent check-ins
                        if !recentTaps.isEmpty {
                            recentTapsSection
                                .padding(.horizontal, 20)
                        }

                        Spacer(minLength: 32)
                    }
                }
            }
        }
        .navigationTitle("Membership Card")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadData() }
        .alert("Checked In!", isPresented: $showCheckinSuccess) {
            Button("OK") {}
        } message: {
            Text(checkinResult ?? "Your check-in has been recorded.")
        }
        .alert("Pass Generated", isPresented: $showWalletSuccess) {
            Button("OK") {}
        } message: {
            Text("Your digital pass has been registered. Use the QR code below to check in at the club.")
        }
        .alert("Error", isPresented: .constant(walletError != nil)) {
            Button("OK") { walletError = nil }
        } message: {
            Text(walletError ?? "")
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Membership Card
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var membershipCard: some View {
        VStack(spacing: 0) {
            // Card front
            ZStack {
                // Background gradient
                LinearGradient(
                    colors: [Color(hex: "0d5c2e"), Color(hex: "0a3d1e"), Color(hex: "061f10")],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

                // Subtle pattern overlay
                GeometryReader { geo in
                    Path { path in
                        for i in stride(from: 0, to: geo.size.width, by: 30) {
                            path.move(to: CGPoint(x: i, y: 0))
                            path.addLine(to: CGPoint(x: i + geo.size.height, y: geo.size.height))
                        }
                    }
                    .stroke(.white.opacity(0.02), lineWidth: 1)
                }

                VStack(alignment: .leading, spacing: 0) {
                    // Top row: logo + tier
                    HStack {
                        HStack(spacing: 8) {
                            Image(systemName: "leaf.fill")
                                .font(.system(size: 16))
                                .foregroundStyle(Color(hex: "4ade80"))
                            Text("ClubOS")
                                .font(.custom("Georgia", size: 16).weight(.bold))
                                .foregroundStyle(.white)
                        }

                        Spacer()

                        Text(tierName.uppercased())
                            .font(.system(size: 9, weight: .bold))
                            .tracking(1.5)
                            .foregroundStyle(Color(hex: "4ade80"))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(.white.opacity(0.1), in: Capsule())
                    }

                    Spacer()

                    // Member name
                    Text(memberName)
                        .font(.custom("Georgia", size: 22).weight(.bold))
                        .foregroundStyle(.white)

                    Spacer().frame(height: 16)

                    // Bottom row: number + since
                    HStack(alignment: .bottom) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("MEMBER NO.")
                                .font(.system(size: 8, weight: .bold))
                                .tracking(1)
                                .foregroundStyle(.white.opacity(0.5))
                            Text(memberNumber.isEmpty ? "---" : memberNumber)
                                .font(.system(size: 15, weight: .semibold).monospacedDigit())
                                .foregroundStyle(.white)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: 4) {
                            Text("MEMBER SINCE")
                                .font(.system(size: 8, weight: .bold))
                                .tracking(1)
                                .foregroundStyle(.white.opacity(0.5))
                            Text(memberSince)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(.white)
                        }
                    }

                    Spacer().frame(height: 12)

                    // NFC indicator
                    HStack(spacing: 6) {
                        Image(systemName: "wave.3.right")
                            .font(.system(size: 10))
                            .foregroundStyle(Color(hex: "4ade80"))
                        Text("NFC Enabled")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.white.opacity(0.6))

                        Spacer()

                        // Active indicator
                        HStack(spacing: 4) {
                            Circle()
                                .fill(Color(hex: "4ade80"))
                                .frame(width: 6, height: 6)
                            Text("ACTIVE")
                                .font(.system(size: 9, weight: .bold))
                                .tracking(0.5)
                                .foregroundStyle(Color(hex: "4ade80"))
                        }
                    }
                }
                .padding(24)
            }
            .frame(height: 210)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .shadow(color: Color(hex: "0d5c2e").opacity(0.4), radius: 16, y: 8)
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Quick Actions
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var actionButtons: some View {
        HStack(spacing: 12) {
            // Check In
            Button {
                Task { await performCheckIn() }
            } label: {
                VStack(spacing: 8) {
                    Group {
                        if checkingIn {
                            ProgressView().tint(Color.club.primary)
                        } else {
                            Image(systemName: "wave.3.right")
                                .font(.system(size: 18))
                        }
                    }
                    .frame(height: 20)
                    Text("Check In")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(Color.club.primary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 14))
            }
            .disabled(checkingIn)

            // Show QR
            Button {
                // Scroll to barcode - already visible below
            } label: {
                VStack(spacing: 8) {
                    Image(systemName: "qrcode")
                        .font(.system(size: 18))
                        .frame(height: 20)
                    Text("QR Code")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(Color.club.foreground)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(Color.club.outlineVariant.opacity(0.3), lineWidth: 1)
                )
            }

            // Share
            Button {} label: {
                VStack(spacing: 8) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 18))
                        .frame(height: 20)
                    Text("Share")
                        .font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(Color.club.foreground)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(Color.club.outlineVariant.opacity(0.3), lineWidth: 1)
                )
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Barcode Section
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var barcodeSection: some View {
        VStack(spacing: 12) {
            Text("SCAN TO VERIFY")
                .font(.system(size: 10, weight: .bold))
                .tracking(1)
                .foregroundStyle(Color.club.outline)

            // QR Code
            if let qrImage = generateQRCode(from: barcodePayload) {
                Image(uiImage: qrImage)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 160, height: 160)
                    .padding(16)
                    .background(.white, in: RoundedRectangle(cornerRadius: 16))
                    .shadow(color: Color.club.foreground.opacity(0.06), radius: 8, y: 2)
            }

            Text(barcodePayload)
                .font(.system(size: 11, weight: .medium).monospacedDigit())
                .foregroundStyle(Color.club.outline)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
    }

    private var barcodePayload: String {
        // Use barcode from a pass if available, otherwise generate from member info
        if let pass = passes.first(where: { $0.status == "active" }), let barcode = pass.barcodePayload {
            return barcode
        }
        return "CLUBOS-\(memberId.prefix(8).uppercased())"
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Wallet Section
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var walletSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("DIGITAL WALLET")
                .font(.system(size: 10, weight: .bold))
                .tracking(1)
                .foregroundStyle(Color.club.outline)

            // Always show the Add to Wallet button — Apple handles dedup natively
            if addingWallet == "apple" {
                HStack {
                    Spacer()
                    ProgressView()
                        .tint(Color.club.primary)
                    Text("Generating pass...")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                    Spacer()
                }
                .padding(.vertical, 8)
            } else {
                AppleWalletButton {
                    Task { await addToWallet(platform: "apple") }
                }
                .frame(height: 48)
                .frame(maxWidth: .infinity)
            }
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Recent Taps
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private var recentTapsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("RECENT CHECK-INS")
                .font(.system(size: 10, weight: .bold))
                .tracking(1)
                .foregroundStyle(Color.club.outline)

            VStack(spacing: 8) {
                ForEach(recentTaps.prefix(5)) { tap in
                    HStack(spacing: 12) {
                        Image(systemName: tapIcon(tap.tapType))
                            .font(.system(size: 13))
                            .foregroundStyle(Color.club.primary)
                            .frame(width: 28, height: 28)
                            .background(Color.club.accent, in: Circle())

                        VStack(alignment: .leading, spacing: 2) {
                            Text(tapLabel(tap.tapType))
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Color.club.foreground)
                            Text(tap.location ?? "Main Entrance")
                                .font(.system(size: 11))
                                .foregroundStyle(Color.club.onSurfaceVariant)
                        }

                        Spacer()

                        Text(formatTapTime(tap.createdAt))
                            .font(.system(size: 11))
                            .foregroundStyle(Color.club.outline)
                    }
                    .padding(.vertical, 6)
                }
            }
            .padding(14)
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - Helpers
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func tapIcon(_ type: String) -> String {
        switch type {
        case "nfc": return "wave.3.right"
        case "qr": return "qrcode"
        case "manual": return "hand.tap"
        default: return "checkmark.circle"
        }
    }

    private func tapLabel(_ type: String) -> String {
        switch type {
        case "nfc": return "NFC Tap"
        case "qr": return "QR Scan"
        case "manual": return "Manual Check-in"
        default: return "Check-in"
        }
    }

    private func formatTapTime(_ iso: String) -> String {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = fmt.date(from: iso)
        if date == nil {
            fmt.formatOptions = [.withInternetDateTime]
            date = fmt.date(from: iso)
        }
        guard let d = date else { return iso }

        let cal = Calendar.current
        if cal.isDateInToday(d) {
            let df = DateFormatter()
            df.dateFormat = "h:mm a"
            return df.string(from: d)
        } else {
            let df = DateFormatter()
            df.dateFormat = "MMM d, h:mm a"
            return df.string(from: d)
        }
    }

    private func generateQRCode(from string: String) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"

        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
        guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MARK: - API
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    private func loadData() async {
        loading = true
        defer { loading = false }

        // Load member info
        do {
            let response: MembersResponse = try await APIClient.shared.get("/members")
            let userEmail = auth.user?.email
            if let me = response.members.first(where: { $0.email == userEmail }) {
                memberId = me.id
                memberName = "\(me.firstName) \(me.lastName)"
                memberNumber = me.memberNumber ?? ""
                tierName = me.tierName ?? "Member"
                if let jd = me.joinDate {
                    let parts = jd.prefix(4)
                    memberSince = String(parts)
                }
            }
        } catch {
            memberName = auth.user?.email ?? "Member"
        }

        // Load passes & taps
        do {
            let response: WalletPassesResponse = try await APIClient.shared.get("/wallet/passes")
            passes = response.passes
            recentTaps = response.recentTaps
        } catch {
            // Wallet data optional
        }
    }

    private func performCheckIn() async {
        checkingIn = true
        defer { checkingIn = false }

        struct TapRequest: Encodable {
            let tapType: String
            let location: String
        }

        do {
            let request = try APIClient.shared.buildRequest(
                path: "/wallet/nfc",
                method: "POST",
                body: TapRequest(tapType: "manual", location: "Mobile App")
            )
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let http = response as? HTTPURLResponse, http.statusCode < 400 else {
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let err = json["error"] as? String {
                    walletError = err
                } else {
                    walletError = "Check-in failed"
                }
                return
            }

            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let name = json["member_name"] as? String {
                checkinResult = "Welcome, \(name)! You're checked in."
            }
            showCheckinSuccess = true

            // Refresh taps
            if let updated: WalletPassesResponse = try? await APIClient.shared.get("/wallet/passes") {
                recentTaps = updated.recentTaps
            }
        } catch {
            walletError = error.localizedDescription
        }
    }

    private func addToWallet(platform: String) async {
        addingWallet = platform
        defer { addingWallet = nil }

        struct PassRequest: Encodable {
            let platform: String
        }

        do {
            // Step 1: Provision the pass on the server
            let request = try APIClient.shared.buildRequest(
                path: "/wallet/passes",
                method: "POST",
                body: PassRequest(platform: platform)
            )
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let http = response as? HTTPURLResponse, http.statusCode < 400 else {
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let err = json["error"] as? String {
                    walletError = err
                } else {
                    walletError = "Failed to generate pass"
                }
                return
            }

            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let passUrl = json?["pass_url"] as? String

            if platform == "apple", let passUrl, let downloadUrl = URL(string: passUrl) {
                // Try to download the signed .pkpass and present the native sheet
                do {
                    let (pkpassData, dlResponse) = try await URLSession.shared.data(from: downloadUrl)
                    if let dlHttp = dlResponse as? HTTPURLResponse, dlHttp.statusCode == 200 {
                        let pass = try PKPass(data: pkpassData)
                        await presentAddPass(pass)
                        return
                    }
                } catch {
                    // .pkpass download/parse failed — fall through to success message
                }
            }

            // Pass was provisioned in DB. Show success — the QR code is the real check-in method.
            // Once Apple Pass certificates are configured, the native Wallet sheet will appear automatically.
            showWalletSuccess = true

            // Refresh passes
            if let updated: WalletPassesResponse = try? await APIClient.shared.get("/wallet/passes") {
                passes = updated.passes
            }
        } catch {
            walletError = error.localizedDescription
        }
    }

    @MainActor
    private func presentAddPass(_ pass: PKPass) {
        guard let controller = PKAddPassesViewController(pass: pass) else {
            walletError = "Unable to present Apple Wallet"
            return
        }

        // Find the top-most view controller to present from
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootVC = windowScene.windows.first?.rootViewController else {
            walletError = "Unable to present Apple Wallet"
            return
        }

        var topVC = rootVC
        while let presented = topVC.presentedViewController {
            topVC = presented
        }
        topVC.present(controller, animated: true)
    }
}

// MARK: - Official Apple "Add to Wallet" Button

struct AppleWalletButton: UIViewRepresentable {
    let action: () -> Void

    func makeUIView(context: Context) -> PKAddPassButton {
        let button = PKAddPassButton(addPassButtonStyle: .black)
        button.addTarget(context.coordinator, action: #selector(Coordinator.tapped), for: .touchUpInside)
        return button
    }

    func updateUIView(_ uiView: PKAddPassButton, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(action: action)
    }

    class Coordinator: NSObject {
        let action: () -> Void
        init(action: @escaping () -> Void) { self.action = action }
        @objc func tapped() { action() }
    }
}
