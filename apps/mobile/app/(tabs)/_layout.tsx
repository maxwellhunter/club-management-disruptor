import { Platform, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { useTheme } from "@/lib/theme-context";

export default function TabLayout() {
  const { colors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: Platform.OS === "ios"
          ? {
              position: "absolute",
              borderTopColor: "transparent",
              backgroundColor: "transparent",
              height: 84,
              paddingBottom: 28,
              paddingTop: 8,
              elevation: 0,
            }
          : {
              borderTopColor: colors.border,
              backgroundColor: colors.background,
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
            },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "systemChromeMaterial"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: "Concierge",
          headerTitle: "The Lakes",
          headerTitleStyle: {
            fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
            fontSize: 18,
            fontWeight: "400",
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="sparkles-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Golf",
          headerTitle: "The Lakes",
          headerTitleStyle: {
            fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
            fontSize: 18,
            fontWeight: "400",
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="golf-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dining"
        options={{
          title: "Dining",
          headerTitle: "The Lakes",
          headerTitleStyle: {
            fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
            fontSize: 18,
            fontWeight: "400",
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          headerTitle: "The Lakes",
          headerTitleStyle: {
            fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
            fontSize: 18,
            fontWeight: "400",
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          href: null,
          title: "Members",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
