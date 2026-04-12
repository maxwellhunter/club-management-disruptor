import Foundation
import SwiftUI

// MARK: - App-Level Cache Service
// Caches API responses and image data. Cleared on sign-out.

actor AppCacheService {
    static let shared = AppCacheService()

    private let defaults = UserDefaults.standard
    private let imageCache = NSCache<NSString, NSData>()
    private let prefix = "clubos_cache_"

    private init() {
        imageCache.countLimit = 50          // max 50 images
        imageCache.totalCostLimit = 50_000_000  // ~50 MB
    }

    // MARK: - String Value Cache (API responses like hero URLs)

    func getString(_ key: String) -> String? {
        defaults.string(forKey: prefix + key)
    }

    func setString(_ value: String?, forKey key: String) {
        if let value {
            defaults.set(value, forKey: prefix + key)
        } else {
            defaults.removeObject(forKey: prefix + key)
        }
    }

    // MARK: - Image Data Cache

    nonisolated func getCachedImageData(for url: URL) -> Data? {
        imageCache.object(forKey: url.absoluteString as NSString) as Data?
    }

    nonisolated func cacheImageData(_ data: Data, for url: URL) {
        imageCache.setObject(data as NSData, forKey: url.absoluteString as NSString, cost: data.count)
    }

    // MARK: - Clear All (call on sign-out)

    func clearAll() {
        imageCache.removeAllObjects()

        // Remove all clubos_cache_ keys from UserDefaults
        let allKeys = defaults.dictionaryRepresentation().keys
        for key in allKeys where key.hasPrefix(prefix) {
            defaults.removeObject(forKey: key)
        }

        // Also clear URLCache for image requests
        URLCache.shared.removeAllCachedResponses()
    }
}

// MARK: - Cached AsyncImage

/// A drop-in replacement for AsyncImage that uses NSCache for fast repeat loads.
struct CachedAsyncImage<Content: View>: View {
    let url: URL?
    @ViewBuilder let content: (AsyncImagePhase) -> Content

    @State private var phase: AsyncImagePhase = .empty

    var body: some View {
        content(phase)
            .task(id: url) {
                await loadImage()
            }
    }

    private func loadImage() async {
        guard let url else {
            phase = .empty
            return
        }

        // Check memory cache first
        if let cached = AppCacheService.shared.getCachedImageData(for: url),
           let uiImage = UIImage(data: cached) {
            phase = .success(Image(uiImage: uiImage))
            return
        }

        // Download
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            if let uiImage = UIImage(data: data) {
                AppCacheService.shared.cacheImageData(data, for: url)
                phase = .success(Image(uiImage: uiImage))
            } else {
                phase = .failure(URLError(.cannotDecodeContentData))
            }
        } catch {
            phase = .failure(error)
        }
    }
}

// MARK: - Shimmer Loading Effect

struct ShimmerView: View {
    @State private var phase: CGFloat = -1

    var body: some View {
        GeometryReader { geo in
            Color.club.surfaceContainer
                .overlay {
                    LinearGradient(
                        colors: [
                            .clear,
                            Color.white.opacity(0.12),
                            Color.white.opacity(0.2),
                            Color.white.opacity(0.12),
                            .clear,
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geo.size.width * 0.6)
                    .offset(x: geo.size.width * phase)
                }
                .clipped()
        }
        .onAppear {
            withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                phase = 1.5
            }
        }
    }
}
