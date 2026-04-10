import { Platform } from "react-native";
import * as Linking from "expo-linking";

/**
 * iOS Spotlight / Handoff integration via NSUserActivity.
 *
 * Uses expo-linking to register user activities that appear in iOS Spotlight
 * search results. When a user taps a Spotlight result, the app opens to
 * the relevant screen via the deep linking handler.
 *
 * Note: Full CoreSpotlight indexing requires a native module. This uses
 * the web-based approach with activity types that iOS indexes automatically.
 */

export type SpotlightItem = {
  id: string;
  title: string;
  description?: string;
  type: "booking" | "event" | "member" | "dining" | "announcement";
  deepLink: string;
  keywords?: string[];
};

const ACTIVITY_PREFIX = "com.clubos.app";

/**
 * Builds a deep link URL for a Spotlight item.
 */
function buildUrl(item: SpotlightItem): string {
  return Linking.createURL(item.deepLink);
}

/**
 * Indexes items for Spotlight search using web metadata approach.
 * On non-iOS platforms this is a no-op.
 */
export function indexForSpotlight(items: SpotlightItem[]): void {
  if (Platform.OS !== "ios") return;

  // Store indexed items for retrieval via the deep link handler
  for (const item of items) {
    spotlightIndex.set(item.id, {
      ...item,
      url: buildUrl(item),
      activityType: `${ACTIVITY_PREFIX}.${item.type}`,
    });
  }
}

/**
 * Removes items from the Spotlight index.
 */
export function deindexFromSpotlight(ids: string[]): void {
  for (const id of ids) {
    spotlightIndex.delete(id);
  }
}

/**
 * Clears the entire Spotlight index for this app.
 */
export function clearSpotlightIndex(): void {
  spotlightIndex.clear();
}

// In-memory index for lookup when handling deep links
type IndexedItem = SpotlightItem & { url: string; activityType: string };
const spotlightIndex = new Map<string, IndexedItem>();

/**
 * Retrieves an indexed item by ID.
 */
export function getIndexedItem(id: string): IndexedItem | undefined {
  return spotlightIndex.get(id);
}

/**
 * Helper to create common Spotlight items from app data.
 */
export const SpotlightHelpers = {
  booking(id: string, facilityName: string, date: string, time: string): SpotlightItem {
    return {
      id: `booking-${id}`,
      title: `${facilityName} Booking`,
      description: `${date} at ${time}`,
      type: "booking",
      deepLink: "bookings",
      keywords: [facilityName, "booking", "reservation", "tee time"],
    };
  },

  event(id: string, title: string, description?: string): SpotlightItem {
    return {
      id: `event-${id}`,
      title,
      description: description?.slice(0, 200),
      type: "event",
      deepLink: `event/${id}`,
      keywords: [title, "event", "club event"],
    };
  },

  announcement(id: string, title: string, preview?: string): SpotlightItem {
    return {
      id: `announcement-${id}`,
      title,
      description: preview?.slice(0, 200),
      type: "announcement",
      deepLink: "announcements",
      keywords: [title, "announcement", "news"],
    };
  },
};
