/**
 * Lightweight input guard that catches obviously off-topic messages
 * before they reach the AI, saving API calls and enforcing scope.
 */

const OFF_TOPIC_DECLINE =
  "I'm your ClubOS assistant, so I focus on club-related topics like events, bookings, and membership. Is there something about the club I can help you with?";

const OFF_TOPIC_PATTERNS: RegExp[] = [
  /write\s+me\s+an?\s+(poem|story|essay|song|script|letter|novel|haiku)/i,
  /help\s+me\s+with\s+(my\s+|this\s+|the\s+)?(homework|code|assignment|exam|test|thesis|resume)/i,
  /what\s+is\s+the\s+capital\s+of/i,
  /translate\s+.+\s+(to|into)\s+/i,
  /(explain|teach\s+me)\s+(quantum|relativity|calculus|chemistry|biology|physics|algebra|trigonometry)/i,
  /who\s+(was|is)\s+the\s+(president|king|queen|prime\s+minister)/i,
  /(generate|create|make|write)\s+(code|a\s+program|a\s+script|an\s+app|a\s+function|a\s+website)/i,
  /solve\s+(this|the|my)\s+(math|equation|problem)/i,
  /(what\s+is|define|meaning\s+of)\s+.{0,20}\s+in\s+(physics|chemistry|biology|math|philosophy)/i,
  /how\s+do\s+i\s+(hack|crack|bypass|jailbreak)/i,
  /(?:^|\s)(roleplay|pretend\s+you\s+are|act\s+as\s+(?:a|an|the))\s/i,
];

/**
 * Returns a decline message if the user's input is obviously off-topic,
 * or null if it should be forwarded to the AI.
 */
export function isObviouslyOffTopic(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(trimmed)) return OFF_TOPIC_DECLINE;
  }
  return null;
}
