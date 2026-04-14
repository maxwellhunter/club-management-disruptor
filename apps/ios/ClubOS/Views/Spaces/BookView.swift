import SwiftUI

// MARK: - Book tab container
// Switches between Golf (tee times) and Spaces (courts/cabanas/studios/etc.)
//
// Structure is important here. Previously we had:
//   VStack { Picker; NavigationStack { child } }
// That nested NavigationStack-as-VStack-sibling-of-Picker caused UIKit to
// install an invisible UINavigationBar gesture region over the top of the
// child's scroll content, making the first card + CTA unclickable.
//
// Fix: NavigationStack is the OUTERMOST view and the Picker lives INSIDE its
// root (above the child). The NavigationStack gets a real toolbar area so it
// takes its space cleanly — content starts below it, no ghost gesture layer.

struct BookView: View {
    enum Mode: String, CaseIterable, Identifiable {
        case golf = "Golf"
        case spaces = "Spaces"
        var id: String { rawValue }
    }

    @State private var mode: Mode = .golf
    @State private var golfPath: [GolfRoute] = []
    @State private var spacesPath: [Space] = []

    var body: some View {
        // One NavigationStack per mode. Switching modes tears down and
        // rebuilds the stack (acceptable — each mode's drill-down state is
        // independent).
        switch mode {
        case .golf:
            NavigationStack(path: $golfPath) {
                VStack(spacing: 0) {
                    modePicker
                    GolfBookingView(path: $golfPath)
                }
                .background(Color.club.background)
                .navigationTitle("Book")
                .navigationBarTitleDisplayMode(.inline)
            }
        case .spaces:
            NavigationStack(path: $spacesPath) {
                VStack(spacing: 0) {
                    modePicker
                    SpacesView(path: $spacesPath)
                }
                .background(Color.club.background)
                .navigationTitle("Book")
                .navigationBarTitleDisplayMode(.inline)
            }
        }
    }

    private var modePicker: some View {
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
    }
}
