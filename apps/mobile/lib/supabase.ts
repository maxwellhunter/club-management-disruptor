import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

// Secure token storage — use SecureStore on native, localStorage on web
let ExpoSecureStoreAdapter: {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};

if (Platform.OS === "web") {
  ExpoSecureStoreAdapter = {
    getItem: (key: string) =>
      typeof window !== "undefined" ? localStorage.getItem(key) : null,
    setItem: (key: string, value: string) => {
      if (typeof window !== "undefined") localStorage.setItem(key, value);
    },
    removeItem: (key: string) => {
      if (typeof window !== "undefined") localStorage.removeItem(key);
    },
  };
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SecureStore = require("expo-secure-store");
  ExpoSecureStoreAdapter = {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) =>
      SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  };
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for React Native
  },
});
