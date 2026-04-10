import * as Location from "expo-location";
import { Alert } from "react-native";

export interface UserLocation {
  latitude: number;
  longitude: number;
}

/** Request location permissions */
async function ensureLocationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
  if (existingStatus === "granted") return true;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Location Access",
      "Enable location services to see nearby club facilities and get directions."
    );
    return false;
  }
  return true;
}

/** Get the user's current location */
export async function getCurrentLocation(): Promise<UserLocation | null> {
  const hasPermission = await ensureLocationPermission();
  if (!hasPermission) return null;

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

/** Calculate distance between two points in miles */
export function getDistanceMiles(
  from: UserLocation,
  to: UserLocation
): number {
  const R = 3959; // Earth radius in miles
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Format distance for display */
export function formatDistance(miles: number): string {
  if (miles < 0.1) return "Nearby";
  if (miles < 1) return `${(miles * 5280).toFixed(0)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/** Check if user is within a certain radius of a point (for geofenced check-in) */
export function isWithinRadius(
  userLocation: UserLocation,
  targetLocation: UserLocation,
  radiusMiles: number
): boolean {
  return getDistanceMiles(userLocation, targetLocation) <= radiusMiles;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
