import { AccessibilityInfo, Platform } from "react-native";
import { useEffect, useState } from "react";

/**
 * Hook to detect if the user has enabled Reduce Motion in iOS Settings.
 * When true, skip animations and transitions for a calmer experience.
 */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);

    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );
    return () => sub.remove();
  }, []);

  return reduceMotion;
}

/**
 * Hook to detect if Bold Text is enabled (iOS accessibility setting).
 */
export function useBoldText(): boolean {
  const [boldText, setBoldText] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AccessibilityInfo.isBoldTextEnabled().then(setBoldText);

      const sub = AccessibilityInfo.addEventListener(
        "boldTextChanged",
        setBoldText
      );
      return () => sub.remove();
    }
  }, []);

  return boldText;
}

/**
 * Hook to detect if a screen reader (VoiceOver/TalkBack) is active.
 */
export function useScreenReader(): boolean {
  const [screenReader, setScreenReader] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);

    const sub = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setScreenReader
    );
    return () => sub.remove();
  }, []);

  return screenReader;
}

/**
 * Hook to detect if Grayscale mode is enabled.
 */
export function useGrayscale(): boolean {
  const [grayscale, setGrayscale] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AccessibilityInfo.isGrayscaleEnabled().then(setGrayscale);

      const sub = AccessibilityInfo.addEventListener(
        "grayscaleChanged",
        setGrayscale
      );
      return () => sub.remove();
    }
  }, []);

  return grayscale;
}

/**
 * Post an announcement to VoiceOver / TalkBack.
 * Use for dynamic content changes that aren't focus-driven.
 */
export function announceForAccessibility(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}
