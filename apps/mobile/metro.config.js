const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Find the monorepo root (two levels up from apps/mobile)
const monorepoRoot = path.resolve(__dirname, "../..");

const config = getDefaultConfig(__dirname);

// Watch the entire monorepo so Metro can see shared packages
config.watchFolders = [monorepoRoot];

// Resolve modules from both the mobile app's node_modules and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Ensure only one copy of React-related packages is used
config.resolver.extraNodeModules = {
  react: path.resolve(__dirname, "node_modules/react"),
  "react-native": path.resolve(__dirname, "node_modules/react-native"),
  "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
};

module.exports = config;
