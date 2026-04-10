import { useEffect, useState, useRef, useCallback } from "react";
import { AppState, Platform } from "react-native";

const CHECK_URL = "https://clients3.google.com/generate_204";
const CHECK_INTERVAL_MS = 30_000; // 30 seconds
const CHECK_TIMEOUT_MS = 5_000;

async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    const response = await fetch(CHECK_URL, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return response.status === 204 || response.ok;
  } catch {
    return false;
  }
}

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    setIsChecking(true);
    const connected = await checkConnectivity();
    setIsConnected(connected);
    setIsChecking(false);
    return connected;
  }, []);

  useEffect(() => {
    // Initial check
    check();

    // Periodic checks
    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);

    // Check when app returns to foreground
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        check();
      }
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      subscription.remove();
    };
  }, [check]);

  return { isConnected, isChecking, retry: check };
}
