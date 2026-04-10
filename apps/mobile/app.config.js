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
      associatedDomains: [
        "applinks:app.clubos.com",
        "webcredentials:app.clubos.com",
      ],
      entitlements: {
        "com.apple.developer.nfc.readersession.formats": ["NDEF", "TAG"],
        "com.apple.developer.associated-domains": [
          "applinks:app.clubos.com",
          "activitycontinuation:app.clubos.com",
        ],
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
        UIApplicationShortcutItems: [
          {
            UIApplicationShortcutItemType: "com.clubos.app.book-tee-time",
            UIApplicationShortcutItemTitle: "Book Tee Time",
            UIApplicationShortcutItemSubtitle: "Reserve your next round",
            UIApplicationShortcutItemIconType: "UIApplicationShortcutIconTypeCompose",
          },
          {
            UIApplicationShortcutItemType: "com.clubos.app.check-in",
            UIApplicationShortcutItemTitle: "Check In",
            UIApplicationShortcutItemSubtitle: "Tap to check in at the club",
            UIApplicationShortcutItemIconType: "UIApplicationShortcutIconTypeConfirmation",
          },
          {
            UIApplicationShortcutItemType: "com.clubos.app.concierge",
            UIApplicationShortcutItemTitle: "AI Concierge",
            UIApplicationShortcutItemSubtitle: "Ask The Lakes anything",
            UIApplicationShortcutItemIconType: "UIApplicationShortcutIconTypeSearch",
          },
          {
            UIApplicationShortcutItemType: "com.clubos.app.events",
            UIApplicationShortcutItemTitle: "Events",
            UIApplicationShortcutItemSubtitle: "Browse upcoming events",
            UIApplicationShortcutItemIconType: "UIApplicationShortcutIconTypeDate",
          },
        ],
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
        UIBackgroundModes: ["fetch", "remote-notification"],
      },
      privacyManifests: {
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
            NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
          },
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
            NSPrivacyAccessedAPITypeReasons: ["E174.1"],
          },
        ],
        NSPrivacyCollectedDataTypes: [
          {
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress",
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: [
              "NSPrivacyCollectedDataTypePurposeAppFunctionality",
            ],
          },
          {
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName",
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: [
              "NSPrivacyCollectedDataTypePurposeAppFunctionality",
            ],
          },
          {
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePreciseLocation",
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: [
              "NSPrivacyCollectedDataTypePurposeAppFunctionality",
            ],
          },
          {
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeDeviceID",
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: [
              "NSPrivacyCollectedDataTypePurposeAppFunctionality",
            ],
          },
        ],
        NSPrivacyTracking: false,
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
      "expo-clipboard",
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
