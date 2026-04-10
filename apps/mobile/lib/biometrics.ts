import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BIOMETRIC_ENABLED_KEY = "clubos_biometric_enabled";
const BIOMETRIC_EMAIL_KEY = "clubos_biometric_email";
const BIOMETRIC_TOKEN_KEY = "clubos_biometric_token";

export type BiometricType = "fingerprint" | "facial" | "iris" | "none";

/** Check if the device has biometric hardware */
export async function hasBiometricHardware(): Promise<boolean> {
  return LocalAuthentication.hasHardwareAsync();
}

/** Check if biometrics are enrolled (Face ID / Touch ID set up) */
export async function isBiometricEnrolled(): Promise<boolean> {
  return LocalAuthentication.isEnrolledAsync();
}

/** Get the type of biometric available */
export async function getBiometricType(): Promise<BiometricType> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return "facial";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "fingerprint";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "iris";
  }
  return "none";
}

/** Get a friendly name for the biometric type */
export function getBiometricLabel(type: BiometricType): string {
  if (Platform.OS === "ios") {
    return type === "facial" ? "Face ID" : type === "fingerprint" ? "Touch ID" : "Biometrics";
  }
  return type === "facial" ? "Face Recognition" : type === "fingerprint" ? "Fingerprint" : "Biometrics";
}

/** Prompt the user for biometric authentication */
export async function authenticateWithBiometrics(
  reason = "Verify your identity to sign in"
): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
    fallbackLabel: "Use password",
  });
  return result.success;
}

/** Check if biometric login is enabled in settings */
export async function isBiometricLoginEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  return value === "true";
}

/** Enable biometric login and store credentials securely */
export async function enableBiometricLogin(email: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
  await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email);
  await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, refreshToken);
}

/** Disable biometric login and clear stored credentials */
export async function disableBiometricLogin(): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "false");
  await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
}

/** Get stored credentials for biometric login */
export async function getBiometricCredentials(): Promise<{
  email: string;
  refreshToken: string;
} | null> {
  const email = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
  const token = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
  if (email && token) {
    return { email, refreshToken: token };
  }
  return null;
}
