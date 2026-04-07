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
      infoPlist: {
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
    plugins: ["expo-router", "expo-secure-store"],
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
