import { Platform } from "react-native";
import { useEffect, useRef } from "react";

let Brightness: typeof import("expo-brightness") | null = null;

// Lazy-load expo-brightness (optional dependency)
try {
  Brightness = require("expo-brightness");
} catch {
  // expo-brightness not installed — brightness boost disabled
}

/**
 * Hook that boosts screen brightness to maximum when the component mounts
 * and restores the original brightness on unmount.
 * Used for QR code / membership card display.
 */
export function useMaxBrightness() {
  const originalBrightness = useRef<number | null>(null);

  useEffect(() => {
    if (!Brightness || Platform.OS !== "ios") return;

    let mounted = true;

    (async () => {
      try {
        const current = await Brightness.getBrightnessAsync();
        if (mounted) {
          originalBrightness.current = current;
          await Brightness.setBrightnessAsync(1.0);
        }
      } catch {
        // Brightness API unavailable — no-op
      }
    })();

    return () => {
      mounted = false;
      if (originalBrightness.current !== null && Brightness) {
        Brightness.setBrightnessAsync(originalBrightness.current).catch(() => {});
      }
    };
  }, []);
}
