import SwiftUI

// MARK: - AdminHubView
//
// Dedicated page for staff tools, reachable from Profile when the
// current user's role is `admin`. Right now it only hosts the
// member-scanner entry point, but it's structured so future staff
// tools (manual check-in, guest verify, POS charge, etc.) can slot
// in as additional rows without restructuring the navigation.

struct AdminHubView: View {
    @State private var showScanner = false
    @State private var recentScans: [ScannedMember] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Primary CTA card — intentionally oversized so it's
                // the obvious action when staff open this page mid-
                // shift with one hand on a phone.
                Button { showScanner = true } label: {
                    VStack(alignment: .leading, spacing: 14) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 14)
                                .fill(Color.white.opacity(0.15))
                                .frame(width: 56, height: 56)
                            Image(systemName: "qrcode.viewfinder")
                                .font(.system(size: 26, weight: .semibold))
                                .foregroundStyle(.white)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Scan Member Card")
                                .font(.system(size: 22, weight: .bold))
                                .foregroundStyle(.white)
                            Text("Verify a member at any contact point — check-in, pro shop, dining, guest lookup.")
                                .font(.system(size: 13))
                                .foregroundStyle(.white.opacity(0.85))
                                .multilineTextAlignment(.leading)
                        }

                        HStack(spacing: 6) {
                            Text("Start scanning")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.white)
                            Image(systemName: "arrow.right")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                        }
                        .padding(.top, 4)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .background(
                        LinearGradient(
                            colors: [Color.club.primary, Color(hex: "0d3b24")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        in: RoundedRectangle(cornerRadius: 20)
                    )
                    .contentShape(RoundedRectangle(cornerRadius: 20))
                }
                .buttonStyle(.plain)

                // Recent scans history — tiny log so staff can
                // confirm the last few verifications without
                // re-scanning.
                if !recentScans.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("RECENT SCANS")
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(1.2)
                            .foregroundStyle(Color.club.onSurfaceVariant)

                        VStack(spacing: 8) {
                            ForEach(recentScans) { scan in
                                recentScanRow(scan)
                            }
                        }
                    }
                } else {
                    VStack(spacing: 10) {
                        Image(systemName: "clock.arrow.circlepath")
                            .font(.system(size: 28))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                        Text("No scans yet")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                        Text("Scanned members will appear here.")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.club.onSurfaceVariant)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 28)
                    .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
                }
            }
            .padding(20)
        }
        .background(Color.club.background)
        .navigationTitle("Staff Tools")
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(isPresented: $showScanner) {
            MemberScannerView(tapType: "check_in", location: "Staff Device") { scanned in
                // Prepend so the newest scan is at the top. Cap at 10
                // so the page stays short without a nested scroll view.
                var next = [scanned] + recentScans.filter { $0.id != scanned.id }
                if next.count > 10 { next = Array(next.prefix(10)) }
                recentScans = next
            }
        }
    }

    private func recentScanRow(_ scan: ScannedMember) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.club.primary.opacity(0.15))
                    .frame(width: 36, height: 36)
                Image(systemName: "checkmark")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.club.primary)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(scan.memberName ?? "Unknown member")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                if let number = scan.memberNumber {
                    Text("#\(number)")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                }
            }

            Spacer()

            Text(shortRelativeTime(scan.timestamp))
                .font(.system(size: 11))
                .foregroundStyle(Color.club.onSurfaceVariant)
        }
        .padding(14)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 14))
    }

    private func shortRelativeTime(_ iso: String?) -> String {
        guard let iso, let date = DateUtilities.parseISODate(iso) else { return "just now" }
        let rf = RelativeDateTimeFormatter()
        rf.unitsStyle = .abbreviated
        return rf.localizedString(for: date, relativeTo: Date())
    }
}
