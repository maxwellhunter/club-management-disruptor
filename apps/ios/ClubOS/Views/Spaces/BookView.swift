import SwiftUI

// MARK: - Book tab container
// Switches between Golf (tee times) and Spaces (courts/cabanas/studios/etc.)

struct BookView: View {
    enum Mode: String, CaseIterable, Identifiable {
        case golf = "Golf"
        case spaces = "Spaces"
        var id: String { rawValue }
    }

    @State private var mode: Mode = .golf

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $mode) {
                ForEach(Mode.allCases) { m in
                    Text(m.rawValue).tag(m)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 4)
            .background(Color.club.background)

            switch mode {
            case .golf:
                GolfBookingView()
            case .spaces:
                SpacesView()
                    .navigationTitle("Spaces")
                    .navigationBarTitleDisplayMode(.inline)
            }
        }
        .background(Color.club.background)
    }
}
