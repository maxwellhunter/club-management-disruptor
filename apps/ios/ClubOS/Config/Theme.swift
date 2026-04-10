import SwiftUI

// MARK: - ClubOS Design System
// Ported from apps/mobile/constants/theme.ts

extension Color {

    // MARK: - Light Theme

    enum club {
        static let primary = Color(hex: "012d1d")
        static let primaryContainer = Color(hex: "1b4332")
        static let primaryForeground = Color.white

        static let background = Color(hex: "f9f9f8")
        static let foreground = Color(hex: "191c1c")

        static let surface = Color(hex: "f9f9f8")
        static let surfaceContainer = Color(hex: "edeeed")
        static let surfaceContainerHigh = Color(hex: "e7e8e7")
        static let surfaceContainerHighest = Color(hex: "e1e3e2")
        static let surfaceContainerLow = Color(hex: "f3f4f3")
        static let surfaceContainerLowest = Color.white

        static let muted = Color(hex: "f3f4f3")
        static let mutedForeground = Color(hex: "414844")

        static let border = Color(hex: "c1c8c2")
        static let outline = Color(hex: "717973")
        static let outlineVariant = Color(hex: "c1c8c2")

        static let destructive = Color(hex: "ba1a1a")
        static let accent = Color(hex: "c1ecd4")

        static let tertiary = Color(hex: "342300")
        static let tertiaryContainer = Color(hex: "4f3800")
        static let tertiaryFixed = Color(hex: "ffdea5")

        static let secondary = Color(hex: "536161")
        static let secondaryContainer = Color(hex: "d4e3e2")
        static let onSurfaceVariant = Color(hex: "414844")
    }

    // MARK: - Dark Theme

    enum clubDark {
        static let primary = Color(hex: "a5d0b9")
        static let primaryContainer = Color(hex: "274e3d")
        static let primaryForeground = Color(hex: "002114")

        static let background = Color(hex: "191c1c")
        static let foreground = Color(hex: "e1e3e2")

        static let surface = Color(hex: "191c1c")
        static let surfaceContainer = Color(hex: "2e3131")
        static let surfaceContainerHigh = Color(hex: "383b3b")
        static let surfaceContainerHighest = Color(hex: "434747")
        static let surfaceContainerLow = Color(hex: "1f2222")
        static let surfaceContainerLowest = Color(hex: "0e1111")

        static let muted = Color(hex: "2e3131")
        static let mutedForeground = Color(hex: "a3a3a3")

        static let border = Color(hex: "414844")
        static let outline = Color(hex: "8b9390")
        static let outlineVariant = Color(hex: "414844")

        static let destructive = Color(hex: "ffb4ab")
        static let accent = Color(hex: "052e16")

        static let tertiary = Color(hex: "e9c176")
        static let tertiaryContainer = Color(hex: "5d4201")
        static let tertiaryFixed = Color(hex: "ffdea5")

        static let secondary = Color(hex: "bbc9c9")
        static let secondaryContainer = Color(hex: "3c4949")
        static let onSurfaceVariant = Color(hex: "c1c8c2")
    }
}

// MARK: - Hex Color Initializer

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Typography

extension Font {
    static let clubHeadline = Font.custom("Georgia", size: 32).weight(.bold)
    static let clubTitle = Font.custom("Georgia", size: 24).weight(.semibold)
    static let clubTitle2 = Font.custom("Georgia", size: 20).weight(.semibold)
    static let clubBody = Font.system(size: 15)
    static let clubCaption = Font.system(size: 13)
    static let clubLabel = Font.system(size: 11, weight: .semibold)
}
