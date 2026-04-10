import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useColorScheme, Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Colors } from "@/constants/theme";

const THEME_PREF_KEY = "clubos_theme_preference";

export type ThemePreference = "system" | "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  isDark: boolean;
  colors: typeof Colors.light;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  isDark: false,
  colors: Colors.light,
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    SecureStore.getItemAsync(THEME_PREF_KEY).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreferenceState(stored);
      }
    });
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    SecureStore.setItemAsync(THEME_PREF_KEY, pref);
    if (pref === "system") {
      Appearance.setColorScheme(null);
    } else {
      Appearance.setColorScheme(pref);
    }
  }, []);

  const isDark =
    preference === "system" ? systemScheme === "dark" : preference === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider value={{ preference, isDark, colors, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
