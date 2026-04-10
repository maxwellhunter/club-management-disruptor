import { useEffect, useRef, useCallback } from "react";
import { AppState, type AppStateStatus } from "react-native";

type AppStateCallback = () => void;

/**
 * Runs a callback when the app transitions from background → foreground.
 * Useful for refreshing data when the user returns to the app.
 */
export function useOnForeground(callback: AppStateCallback) {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        savedCallback.current();
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);
}

/**
 * Tracks time spent in the app for the current session.
 * Returns elapsed seconds since the app was last foregrounded.
 */
export function useSessionDuration() {
  const startTime = useRef(Date.now());

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        startTime.current = Date.now();
      }
    });

    return () => subscription.remove();
  }, []);

  const getElapsedSeconds = useCallback(() => {
    return Math.floor((Date.now() - startTime.current) / 1000);
  }, []);

  return { getElapsedSeconds };
}
