const path = require("path");

module.exports = {
  expo: {
    name: "ClubOS",
    slug: "clubos",
    version: "0.1.0",
    orientation: "portrait",
    icon: path.resolve(__dirname, "assets/icon.png"),
    scheme: "clubos",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      backgroundColor: "#16a34a",
      resizeMode: "contain",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.clubos.app",
      icon: path.resolve(__dirname, "assets/icon.png"),
      usesAppleSignIn: true,
      entitlements: {
        "com.apple.developer.nfc.readersession.formats": ["NDEF", "TAG"],
      },
      infoPlist: {
        NFCReaderUsageDescription:
          "ClubOS uses NFC to check you in at club facilities.",
        NSAppTransportSecurity: {
          NSAllowsLocalNetworking: true,
          NSExceptionDomains: {
            "iicwnlruopqhrzkgjsmu.supabase.co": {
              NSExceptionAllowsInsecureHTTPLoads: false,
              NSIncludesSubdomains: true,
            },
          },
        },
        ITSAppUsesNonExemptEncryption: false,
        NSFaceIDUsageDescription:
          "Use Face ID to quickly sign in to your ClubOS account.",
        NSCalendarsFullAccessUsageDescription:
          "Add tee times, dining reservations, and club events to your calendar.",
        NSCalendarsWriteOnlyAccessUsageDescription:
          "Add tee times, dining reservations, and club events to your calendar.",
        NSCameraUsageDescription:
          "Take a photo for your member profile.",
        NSPhotoLibraryUsageDescription:
          "Choose a photo from your library for your member profile.",
        NSLocationWhenInUseUsageDescription:
          "See nearby club facilities and get directions.",
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#16a34a",
      },
      package: "com.clubos.app",
    },
    web: {
      bundler: "metro",
      output: "static",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#16a34a",
        },
      ],
      "expo-apple-authentication",
      [
        "expo-local-authentication",
        { faceIDPermission: "Use Face ID to quickly sign in to your ClubOS account." },
      ],
      [
        "expo-calendar",
        { calendarPermission: "Add tee times, reservations, and events to your calendar." },
      ],
      [
        "expo-image-picker",
        { photosPermission: "Choose a photo for your member profile.", cameraPermission: "Take a photo for your member profile." },
      ],
      [
        "expo-location",
        { locationWhenInUsePermission: "See nearby club facilities and get directions." },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "8c63d479-1325-4425-bf0f-30b9855349a8",
      },
    },
    owner: "maxphunter",
  },
};
