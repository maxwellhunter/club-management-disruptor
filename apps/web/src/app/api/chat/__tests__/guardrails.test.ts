/**
 * Tests for the isObviouslyOffTopic input guard.
 *
 * Validates that obviously off-topic messages are caught before
 * being sent to the AI, while club-related messages pass through.
 */

import { isObviouslyOffTopic } from "../guardrails";

const DECLINE_SUBSTRING = "ClubOS assistant";

describe("isObviouslyOffTopic", () => {
  // ─── Should pass through (return null) ──────────────────────────────

  const clubMessages = [
    "What events are this week?",
    "Book a tee time for Saturday",
    "Show my balance",
    "What are my upcoming bookings?",
    "Cancel my RSVP for wine tasting",
    "Tell me about the club",
    "What are the hours?",
    "Who are the newest members?",
    "What's the dress code for dining?",
    "How do I upgrade my membership?",
    "Is the pool open today?",
    "Hi there!",
    "Thanks!",
    "I need help",
  ];

  it.each(clubMessages)(
    "passes through club-related message: %s",
    (message) => {
      expect(isObviouslyOffTopic(message)).toBeNull();
    }
  );

  it("passes through empty messages", () => {
    expect(isObviouslyOffTopic("")).toBeNull();
    expect(isObviouslyOffTopic("   ")).toBeNull();
  });

  // ─── Should block (return decline message) ──────────────────────────

  const offTopicMessages = [
    "Write me a poem about dogs",
    "Write me a story about space",
    "Write me an essay on climate change",
    "Help me with my homework",
    "Help me with this code",
    "Help me with my assignment",
    "What is the capital of France",
    "Translate hello to Spanish",
    "Explain quantum mechanics",
    "Teach me calculus",
    "Who was the president in 1990",
    "Who is the prime minister of Canada",
    "Generate code for a website",
    "Create a program that sorts numbers",
    "Make a script to scrape data",
    "Solve this math problem",
    "Solve the equation x + 5 = 10",
    "Pretend you are a pirate",
    "Roleplay as a wizard",
    "How do I hack a website",
    "Write code for a function that calculates fibonacci",
  ];

  it.each(offTopicMessages)(
    "blocks off-topic message: %s",
    (message) => {
      const result = isObviouslyOffTopic(message);
      expect(result).not.toBeNull();
      expect(result).toContain(DECLINE_SUBSTRING);
    }
  );

  // ─── Case insensitivity ─────────────────────────────────────────────

  it("is case insensitive", () => {
    expect(isObviouslyOffTopic("WRITE ME A POEM")).not.toBeNull();
    expect(isObviouslyOffTopic("What Is The Capital Of Japan")).not.toBeNull();
    expect(isObviouslyOffTopic("Translate this to French")).not.toBeNull();
  });

  // ─── Ambiguous messages should pass through to AI ───────────────────

  const ambiguousMessages = [
    "What is happening today?",
    "Can you help me?",
    "I have a question",
    "What should I do this weekend?",
    "Is there anything fun going on?",
  ];

  it.each(ambiguousMessages)(
    "passes ambiguous message to AI: %s",
    (message) => {
      expect(isObviouslyOffTopic(message)).toBeNull();
    }
  );
});
