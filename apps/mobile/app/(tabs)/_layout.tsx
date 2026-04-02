import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: Colors.light.mutedForeground,
        tabBarStyle: {
          borderTopColor: Colors.light.border,
          height: Platform.OS === "ios" ? 84 : 60,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
          paddingTop: 8,
        },
        headerStyle: { backgroundColor: Colors.light.background },
        headerTintColor: Colors.light.foreground,
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
