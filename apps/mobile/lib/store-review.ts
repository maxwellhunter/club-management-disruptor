import * as StoreReview from "expo-store-review";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const REVIEW_COUNT_KEY = "clubos_positive_actions";
const LAST_PROMPT_KEY = "clubos_last_review_prompt";
const REVIEW_THRESHOLD = 5; // Prompt after 5 positive actions
const MIN_DAYS_BETWEEN_PROMPTS = 30;

/**
 * Track a positive user action (booking confirmed, event RSVP, check-in).
 * After enough positive actions and sufficient time gap, prompt for review.
 */
export async function trackPositiveAction(): Promise<void> {
  const countStr = await SecureStore.getItemAsync(REVIEW_COUNT_KEY);
  const count = (parseInt(countStr || "0", 10) || 0) + 1;
  await SecureStore.setItemAsync(REVIEW_COUNT_KEY, String(count));

  if (count >= REVIEW_THRESHOLD && (await shouldPrompt())) {
    await promptForReview();
  }
}

/** Check if we should prompt (respecting cooldown period) */
async function shouldPrompt(): Promise<boolean> {
  const lastPrompt = await SecureStore.getItemAsync(LAST_PROMPT_KEY);
  if (!lastPrompt) return true;

  const daysSince =
    (Date.now() - parseInt(lastPrompt, 10)) / (1000 * 60 * 60 * 24);
  return daysSince >= MIN_DAYS_BETWEEN_PROMPTS;
}

/** Prompt for App Store review using native dialog */
async function promptForReview(): Promise<void> {
  const isAvailable = await StoreReview.isAvailableAsync();
  if (!isAvailable) return;

  if (await StoreReview.hasAction()) {
    await StoreReview.requestReview();
    // Reset counter and record prompt time
    await SecureStore.setItemAsync(REVIEW_COUNT_KEY, "0");
    await SecureStore.setItemAsync(LAST_PROMPT_KEY, String(Date.now()));
  }
}

/** Manually request review (e.g., from settings) */
export async function requestReviewManually(): Promise<boolean> {
  const isAvailable = await StoreReview.isAvailableAsync();
  if (!isAvailable) return false;

  if (await StoreReview.hasAction()) {
    await StoreReview.requestReview();
    return true;
  }
  return false;
}
