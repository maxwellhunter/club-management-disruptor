import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useNetworkStatus } from "@/lib/connectivity";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function OfflineBanner() {
  const { isConnected, retry } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isConnected) {
      wasOffline.current = true;
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else if (wasOffline.current) {
      // Show "Back online" briefly then hide
      setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -60,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          wasOffline.current = false;
        });
      }, 2000);
    }
  }, [isConnected, slideAnim]);

  if (isConnected && !wasOffline.current) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 4,
          transform: [{ translateY: slideAnim }],
          backgroundColor: isConnected ? "#16a34a" : "#dc2626",
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={isConnected ? "checkmark-circle" : "cloud-offline"}
          size={16}
          color="#ffffff"
        />
        <Text style={styles.text}>
          {isConnected ? "Back online" : "No internet connection"}
        </Text>
        {!isConnected && (
          <TouchableOpacity onPress={retry} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginLeft: 4,
  },
  retryText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
});
