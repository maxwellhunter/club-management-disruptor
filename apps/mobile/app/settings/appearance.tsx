import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type ThemePreference } from "@/lib/theme-context";
import { haptics } from "@/lib/haptics";

const THEME_OPTIONS: { id: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
  { id: "system", label: "System", icon: "phone-portrait-outline", description: "Match your device settings" },
  { id: "light", label: "Light", icon: "sunny-outline", description: "Always use light mode" },
  { id: "dark", label: "Dark", icon: "moon-outline", description: "Always use dark mode" },
];

export default function AppearanceScreen() {
  const { preference, setPreference, colors, isDark } = useTheme();
  const router = useRouter();

  function handleSelect(pref: ThemePreference) {
    haptics.selection();
    setPreference(pref);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "Appearance",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerShadowVisible: false,
        }}
      />

      <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>
        THEME
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
        {THEME_OPTIONS.map((option, index) => {
          const isSelected = preference === option.id;
          return (
            <View key={option.id}>
              {index > 0 && (
                <View style={[styles.divider, { backgroundColor: colors.surfaceContainerLow }]} />
              )}
              <TouchableOpacity
                style={styles.row}
                onPress={() => handleSelect(option.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, { backgroundColor: colors.surfaceContainerLow }]}>
                  <Ionicons name={option.icon} size={20} color={colors.onSurfaceVariant} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.rowSubtitle, { color: colors.onSurfaceVariant }]}>
                    {option.description}
                  </Text>
                </View>
                <Ionicons
                  name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={isSelected ? colors.primary : colors.outlineVariant}
                />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Preview */}
      <Text style={[styles.sectionLabel, { color: colors.onSurfaceVariant }]}>
        PREVIEW
      </Text>
      <View style={[styles.previewCard, { backgroundColor: colors.surfaceContainerLowest }]}>
        <View style={[styles.previewHeader, { backgroundColor: colors.primary }]}>
          <Ionicons name="diamond" size={14} color={isDark ? colors.primaryForeground : "#ffffff"} />
          <Text style={[styles.previewBrand, { color: isDark ? colors.primaryForeground : "#ffffff" }]}>
            THE LAKES
          </Text>
        </View>
        <View style={styles.previewBody}>
          <Text style={[styles.previewTitle, { color: colors.foreground }]}>
            Good afternoon
          </Text>
          <Text style={[styles.previewSubtitle, { color: colors.onSurfaceVariant }]}>
            Your tee time is at 2:30 PM
          </Text>
          <View style={[styles.previewChip, { backgroundColor: colors.accent }]}>
            <Text style={[styles.previewChipText, { color: colors.primary }]}>
              Championship Course
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.footnote, { color: colors.outline }]}>
        {preference === "system"
          ? `Currently using ${isDark ? "dark" : "light"} mode based on your device settings.`
          : `Theme set to ${preference} mode.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginLeft: 38,
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    marginHorizontal: 24,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  rowSubtitle: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },

  // Preview
  previewCard: {
    marginHorizontal: 24,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  previewBrand: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2,
  },
  previewBody: {
    padding: 16,
    gap: 6,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  previewSubtitle: {
    fontSize: 13,
  },
  previewChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 4,
  },
  previewChipText: {
    fontSize: 11,
    fontWeight: "600",
  },

  footnote: {
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 18,
  },
});
