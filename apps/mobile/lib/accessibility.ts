/**
 * iOS Accessibility Utilities
 *
 * Provides hooks and helpers for Dynamic Type (font scaling),
 * reduced motion, VoiceOver detection, bold text, grayscale,
 * and accessibility announcements.
 */
import { AccessibilityInfo, PixelRatio, Platform } from "react-native";
import { useEffect, useState } from "react";

// ─── Dynamic Type (font scaling) ────────────────────────────────────

/**
 * Returns the current font scale factor from system accessibility settings.
 * On iOS, this reflects the user's Dynamic Type preference.
 */
export function useAccessibleFontScale(): number {
  const [fontScale, setFontScale] = useState(PixelRatio.getFontScale());

  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener(
      "screenReaderChanged" as any,
      () => {
        setFontScale(PixelRatio.getFontScale());
      }
    );
    return () => sub.remove();
  }, []);

  return fontScale;
}

/**
 * Clamps a font size so it scales with Dynamic Type but never
 * exceeds a reasonable maximum (prevents layout breakage).
 */
export function scaledFontSize(
  baseSizePt: number,
  maxScale: number = 1.5
): number {
  const scale = Math.min(PixelRatio.getFontScale(), maxScale);
  return Math.round(baseSizePt * scale);
}

// ─── Reduced Motion ─────────────────────────────────────────────────

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

// ─── Bold Text ──────────────────────────────────────────────────────

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

// ─── VoiceOver / Screen Reader ──────────────────────────────────────

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

// ─── Grayscale ──────────────────────────────────────────────────────

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

// ─── Accessibility Announcement ─────────────────────────────────────

/**
 * Post an announcement to VoiceOver / TalkBack.
 * Use for dynamic content changes that aren't focus-driven.
 */
export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}

/** Alias for backwards compatibility */
export const announceForAccessibility = announce;
