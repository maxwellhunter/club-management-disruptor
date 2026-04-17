import SwiftUI
import Observation

// MARK: - Shared Error Banner
//
// Global, lightweight error-surfacing service so API failures can't be silently
// swallowed. Call `ErrorBanner.shared.show(error)` from any catch block.
//
// The banner auto-dismisses and ignores certain expected errors (e.g. the user
// hitting cancel). Unauthorized errors are suppressed here — auth state changes
// handle session expiry elsewhere.

@Observable
@MainActor
final class ErrorBanner {
    static let shared = ErrorBanner()

    var message: String?
    private var dismissTask: Task<Void, Never>?

    private init() {}

    func show(_ message: String, autoDismissAfter seconds: TimeInterval = 4) {
        self.message = message
        dismissTask?.cancel()
        dismissTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            guard !Task.isCancelled else { return }
            self?.message = nil
        }
    }

    func show(_ error: Error) {
        // Swallow session-expired — auth state change handles redirect.
        if case APIError.unauthorized = error { return }
        if (error as NSError).code == NSURLErrorCancelled { return }

        let text: String
        if let apiError = error as? APIError {
            text = apiError.errorDescription ?? "Something went wrong"
        } else {
            text = error.localizedDescription
        }
        show(text)
    }

    func dismiss() {
        dismissTask?.cancel()
        message = nil
    }
}

// MARK: - Banner View + Modifier

private struct ErrorBannerOverlay: View {
    @Bindable var banner: ErrorBanner

    var body: some View {
        VStack {
            if let msg = banner.message {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.top, 1)

                    Text(msg)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Button {
                        banner.dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white.opacity(0.9))
                            .padding(6)
                    }
                    .accessibilityLabel("Dismiss error")
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color.club.destructive, in: RoundedRectangle(cornerRadius: 12))
                .shadow(color: .black.opacity(0.15), radius: 8, y: 2)
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
            Spacer()
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: banner.message)
        .allowsHitTesting(banner.message != nil)
    }
}

struct ErrorBannerHost<Content: View>: View {
    @State private var banner = ErrorBanner.shared
    @ViewBuilder let content: () -> Content

    var body: some View {
        ZStack(alignment: .top) {
            content()
            ErrorBannerOverlay(banner: banner)
        }
    }
}

extension View {
    /// Attaches the shared error banner overlay. Place on the app root.
    func errorBannerHost() -> some View {
        ErrorBannerHost { self }
    }
}
