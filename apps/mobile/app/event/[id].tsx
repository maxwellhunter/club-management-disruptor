import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { EventFormModal } from "@/components/event-form-modal";
import { AttendeesModal } from "@/components/attendees-modal";
import { shareEvent } from "@/lib/sharing";
import { addEventToCalendar } from "@/lib/calendar";
import { haptics } from "@/lib/haptics";
import { trackPositiveAction } from "@/lib/store-review";
import type { RsvpStatus } from "@club/shared";

const API_URL =
  process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

const EVENT_IMAGES: Record<string, string> = {
  social:
    "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
  sporting:
    "https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80",
  dining:
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
  default:
    "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=80",
};

// Stitch RSVP form: dietary options as card-style rows
const DIETARY_OPTIONS = [
  "No Preferences",
  "Vegetarian / Vegan",
  "Gluten Free",
];

interface EventWithRsvp {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  capacity: number | null;
  price: number | null;
  status: string;
  rsvp_count: number;
  user_rsvp_status: RsvpStatus | null;
  category?: string;
}

const serifFont = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

function formatFullDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [event, setEvent] = useState<EventWithRsvp | null>(null);
  const [role, setRole] = useState<string>("member");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rsvpLoading, setRsvpLoading] = useState(false);

  // RSVP form state (matches Stitch: guest count 1-4, dietary, notes)
  const [guestCount, setGuestCount] = useState(2);
  const [dietaryPreference, setDietaryPreference] = useState("No Preferences");
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Admin modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);

  const getHeaders = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      h["Authorization"] = `Bearer ${session.access_token}`;
    }
    return h;
  }, [session?.access_token]);

  const fetchEvent = useCallback(async () => {
    const headers = getHeaders();
    try {
      const res = await fetch(`${API_URL}/api/events/${id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setEvent(data.event);
        setRole(data.role);
      } else {
        const data = await res.json();
        setError(data.error || "Event not found");
      }
    } catch {
      setError("Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [id, getHeaders]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  async function handleRsvp() {
    if (!event) return;
    if (event.user_rsvp_status === "attending") {
      Alert.alert(
        "Cancel RSVP",
        "Are you sure you want to cancel your RSVP?",
        [
          { text: "Keep RSVP", style: "cancel" },
          {
            text: "Cancel RSVP",
            style: "destructive",
            onPress: () => executeRsvp("declined"),
          },
        ]
      );
    } else {
      executeRsvp("attending");
    }
  }

  async function executeRsvp(newStatus: RsvpStatus) {
    if (!event) return;
    const headers = getHeaders();
    setRsvpLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/events/rsvp`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event_id: event.id,
          status: newStatus,
          guest_count: newStatus === "attending" ? guestCount - 1 : 0,
        }),
      });
      if (res.ok) {
        if (newStatus === "attending") {
          trackPositiveAction();
        }
        await fetchEvent();
      } else {
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to RSVP");
      }
    } catch {
      Alert.alert("Error", "Failed to RSVP");
    } finally {
      setRsvpLoading(false);
    }
  }

  const isAdmin = role === "admin";
  const isAttending = event?.user_rsvp_status === "attending";

  function getEventImage() {
    const cat = (event?.category || "default").toLowerCase();
    return EVENT_IMAGES[cat] || EVENT_IMAGES.default;
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.centered}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={Colors.light.outlineVariant}
        />
        <Text style={styles.errorTitle}>{error || "Event not found"}</Text>
        <Text style={styles.errorText}>
          This event may have been removed or you don&apos;t have access.
        </Text>
      </View>
    );
  }

  const categoryLabel =
    (event.category || "Social").charAt(0).toUpperCase() +
    (event.category || "social").slice(1);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero image (Stitch: h-[530px] rounded-3xl with gradient overlay) ── */}
        <View style={styles.heroWrap}>
          <View style={styles.heroInner}>
            <Image
              source={{ uri: getEventImage() }}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={[
                "transparent",
                "rgba(1, 45, 29, 0.2)",
                "rgba(1, 45, 29, 0.8)",
              ]}
              style={styles.heroGradient}
            />
            {/* Back button */}
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={22} color="#ffffff" />
            </TouchableOpacity>
            {/* Share & Calendar buttons */}
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.heroActionBtn}
                onPress={async () => {
                  haptics.light();
                  await addEventToCalendar({
                    title: event.title,
                    startDate: event.start_date,
                    endDate: event.end_date || undefined,
                    location: event.location || undefined,
                    description: event.description || undefined,
                  });
                  haptics.success();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={18} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroActionBtn}
                onPress={() => {
                  haptics.light();
                  shareEvent({
                    title: event.title,
                    date: event.start_date,
                    location: event.location || undefined,
                    description: event.description || undefined,
                  });
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="share-outline" size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
            {/* Signature Event badge (Stitch: tertiary-fixed bg) */}
            <View style={styles.heroCategoryBadge}>
              <Text style={styles.heroCategoryText}>
                {categoryLabel.toUpperCase()} EVENT
              </Text>
            </View>
            {/* Title + subtitle on image */}
            <View style={styles.heroTextArea}>
              <Text style={styles.heroTitle}>{event.title}</Text>
              {event.location && (
                <Text style={styles.heroSubtitle}>at {event.location}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Details section (Stitch: flex-wrap gap-12 with label + icon rows) ── */}
        <View style={styles.detailsRow}>
          {/* Date & Time */}
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>DATE & TIME</Text>
            <View style={styles.detailIconRow}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={Colors.light.primary}
              />
              <Text style={styles.detailValue}>
                {formatFullDate(event.start_date)}
              </Text>
            </View>
            <Text style={styles.detailSub}>
              Reception at {formatTime(event.start_date)}
            </Text>
          </View>
          {/* Location */}
          {event.location && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>LOCATION</Text>
              <View style={styles.detailIconRow}>
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={Colors.light.primary}
                />
                <Text style={styles.detailValue}>{event.location}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Description (Stitch: headline text-3xl + body paragraphs) ── */}
        {event.description && (
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionHeadline}>About This Event</Text>
            <Text style={styles.descriptionBody}>{event.description}</Text>
          </View>
        )}

        {/* ── Capacity / attendees info ── */}
        {(event.capacity || event.rsvp_count > 0) && (
          <View style={styles.capacityCard}>
            <View style={styles.capacityIconRow}>
              <Ionicons
                name="people-outline"
                size={18}
                color={Colors.light.primary}
              />
              <Text style={styles.capacityText}>
                {event.rsvp_count} attending
                {event.capacity ? ` of ${event.capacity} spots` : ""}
              </Text>
            </View>
            {event.capacity && event.capacity > 0 && (
              <View style={styles.capacityBarBg}>
                <View
                  style={[
                    styles.capacityBarFill,
                    {
                      width: `${Math.min(
                        (event.rsvp_count / event.capacity) * 100,
                        100
                      )}%`,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        )}

        {/* ── RSVP form (Stitch: sticky card with editorial-shadow rounded-3xl) ── */}
        {event.status === "published" && (
          <View style={styles.rsvpCard}>
            <Text style={styles.rsvpHeadline}>
              {isAttending
                ? "Your Reservation"
                : "Confirm Your Attendance"}
            </Text>

            {!isAttending && (
              <>
                {/* Guest count (Stitch: grid-cols-4 with border buttons, active = bg-primary) */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>NUMBER OF GUESTS</Text>
                  <View style={styles.guestGrid}>
                    {[1, 2, 3, 4].map((n) => {
                      const isSelected = guestCount === n;
                      return (
                        <TouchableOpacity
                          key={n}
                          style={[
                            styles.guestBtn,
                            isSelected
                              ? styles.guestBtnActive
                              : styles.guestBtnInactive,
                          ]}
                          onPress={() => setGuestCount(n)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.guestBtnText,
                              isSelected && styles.guestBtnTextActive,
                            ]}
                          >
                            {n}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Dietary preferences (Stitch: card-style rows with check_circle) */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>DIETARY PREFERENCES</Text>
                  <View style={styles.dietaryList}>
                    {DIETARY_OPTIONS.map((option) => {
                      const isSelected = dietaryPreference === option;
                      return (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles.dietaryRow,
                            isSelected
                              ? styles.dietaryRowSelected
                              : styles.dietaryRowDefault,
                          ]}
                          onPress={() => setDietaryPreference(option)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dietaryText}>{option}</Text>
                          <Ionicons
                            name={
                              isSelected
                                ? "checkmark-circle"
                                : "ellipse-outline"
                            }
                            size={22}
                            color={
                              isSelected
                                ? Colors.light.primary
                                : Colors.light.outline
                            }
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Additional notes (Stitch: textarea bg-surface-container rounded-2xl) */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>ADDITIONAL NOTES</Text>
                  <TextInput
                    style={styles.notesInput}
                    multiline
                    numberOfLines={3}
                    placeholder="Special seating requests or allergies..."
                    placeholderTextColor={`${Colors.light.onSurfaceVariant}80`}
                    value={additionalNotes}
                    onChangeText={setAdditionalNotes}
                    textAlignVertical="top"
                  />
                </View>
              </>
            )}

            {/* Confirm RSVP button (Stitch: bg-gradient from-primary to-primary-container) */}
            <TouchableOpacity
              style={[
                styles.rsvpBtn,
                isAttending && styles.rsvpBtnAttending,
                rsvpLoading && { opacity: 0.5 },
              ]}
              onPress={handleRsvp}
              disabled={rsvpLoading}
              activeOpacity={0.8}
            >
              {rsvpLoading ? (
                <ActivityIndicator
                  size="small"
                  color={
                    isAttending ? Colors.light.primary : "#ffffff"
                  }
                />
              ) : isAttending ? (
                <View style={styles.rsvpBtnRow}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.light.primary} />
                  <Text style={styles.rsvpBtnTextAttending}>
                    You're Attending
                  </Text>
                  <Text style={styles.rsvpCancelHint}>Tap to cancel</Text>
                </View>
              ) : (
                <LinearGradient
                  colors={[Colors.light.primary, Colors.light.primaryContainer]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.rsvpBtnGradient}
                >
                  <Text style={styles.rsvpBtnText}>CONFIRM RSVP</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>

            {/* Policy text (Stitch: text-center text-xs) */}
            {!isAttending && (
              <Text style={styles.policyText}>
                By confirming, you agree to our guest policies. Cancellation is
                required 48 hours prior to the event.
              </Text>
            )}
          </View>
        )}

        {/* ── Admin actions ── */}
        {isAdmin && (
          <View style={styles.adminSection}>
            <TouchableOpacity
              style={styles.adminBtn}
              onPress={() => setShowEditModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={Colors.light.foreground}
              />
              <Text style={styles.adminBtnText}>Edit Event</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.adminBtn}
              onPress={() => setShowAttendeesModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="list-outline"
                size={18}
                color={Colors.light.foreground}
              />
              <Text style={styles.adminBtnText}>Attendees</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Edit modal */}
      <EventFormModal
        visible={showEditModal}
        event={event as EventWithRsvp}
        apiUrl={API_URL}
        headers={getHeaders()}
        onClose={() => setShowEditModal(false)}
        onSaved={() => {
          setShowEditModal(false);
          fetchEvent();
        }}
      />

      {/* Attendees modal */}
      <AttendeesModal
        visible={showAttendeesModal}
        eventId={event.id}
        eventTitle={event.title}
        apiUrl={API_URL}
        headers={getHeaders()}
        onClose={() => setShowAttendeesModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    padding: 24,
  },
  errorTitle: {
    fontFamily: serifFont,
    fontSize: 20,
    color: Colors.light.foreground,
    marginTop: 12,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 14,
    color: Colors.light.onSurfaceVariant,
    textAlign: "center",
  },

  // ── Hero (Stitch: relative h-[530px] rounded-3xl overflow-hidden) ──
  heroWrap: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  heroInner: {
    height: 360,
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroActions: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
  },
  heroActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCategoryBadge: {
    position: "absolute",
    bottom: 84,
    left: 24,
    backgroundColor: Colors.light.tertiaryFixed,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  heroCategoryText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3,
    color: Colors.light.tertiary,
  },
  heroTextArea: {
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 24,
  },
  heroTitle: {
    fontFamily: serifFont,
    fontSize: 34,
    fontWeight: "700",
    color: "#ffffff",
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontFamily: serifFont,
    fontSize: 20,
    fontStyle: "italic",
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },

  // ── Details (Stitch: flex-wrap gap-12 with uppercase labels) ──
  detailsRow: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    gap: 24,
  },
  detailBlock: {
    gap: 6,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 3,
    color: Colors.light.onSurfaceVariant,
    marginBottom: 4,
  },
  detailIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: "500",
    color: Colors.light.foreground,
  },
  detailSub: {
    fontSize: 14,
    color: Colors.light.onSurfaceVariant,
    marginLeft: 30,
  },

  // ── Description (Stitch: headline text-3xl + body text-lg) ──
  descriptionSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  sectionHeadline: {
    fontFamily: serifFont,
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.primary,
  },
  descriptionBody: {
    fontSize: 16,
    color: Colors.light.onSurfaceVariant,
    lineHeight: 26,
  },

  // ── Capacity ──
  capacityCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.surfaceContainerLow,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
  },
  capacityIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  capacityText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.foreground,
  },
  capacityBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.surfaceContainerHigh,
    overflow: "hidden",
  },
  capacityBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: Colors.light.primary,
  },

  // ── RSVP card (Stitch: bg-surface-container-lowest editorial-shadow rounded-3xl) ──
  rsvpCard: {
    marginHorizontal: 24,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 24,
    padding: 28,
    shadowColor: "#191c1c",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${Colors.light.outlineVariant}20`,
  },
  rsvpHeadline: {
    fontFamily: serifFont,
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.foreground,
    marginBottom: 24,
  },

  // Field groups
  fieldGroup: {
    marginBottom: 24,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 3,
    color: Colors.light.onSurfaceVariant,
  },

  // Guest count (Stitch: grid-cols-4 gap-3, border + bg-primary active)
  guestGrid: {
    flexDirection: "row",
    gap: 10,
  },
  guestBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  guestBtnInactive: {
    borderWidth: 1,
    borderColor: Colors.light.outlineVariant,
  },
  guestBtnActive: {
    backgroundColor: Colors.light.primary,
    shadowColor: "#191c1c",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  guestBtnText: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.light.foreground,
  },
  guestBtnTextActive: {
    color: "#ffffff",
  },

  // Dietary (Stitch: card rows with check_circle / radio_button_unchecked)
  dietaryList: {
    gap: 8,
  },
  dietaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
  },
  dietaryRowSelected: {
    backgroundColor: Colors.light.surfaceContainer,
  },
  dietaryRowDefault: {
    borderWidth: 1,
    borderColor: Colors.light.outlineVariant,
  },
  dietaryText: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.light.foreground,
  },

  // Notes (Stitch: bg-surface-container border-none rounded-2xl p-4)
  notesInput: {
    backgroundColor: Colors.light.surfaceContainer,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    color: Colors.light.foreground,
    minHeight: 80,
    lineHeight: 22,
  },

  // RSVP button (Stitch: bg-gradient-to-br from-primary to-primary-container rounded-2xl py-5)
  rsvpBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 8,
  },
  rsvpBtnGradient: {
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: 16,
  },
  rsvpBtnAttending: {
    backgroundColor: Colors.light.accent,
    paddingVertical: 16,
    alignItems: "center",
  },
  rsvpBtnText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 3,
    color: "#ffffff",
  },
  rsvpBtnTextAttending: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.primary,
  },
  rsvpBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  rsvpCancelHint: {
    fontSize: 12,
    color: `${Colors.light.primary}80`,
    marginLeft: 4,
  },

  // Policy text (Stitch: text-center text-xs text-on-surface-variant)
  policyText: {
    fontSize: 12,
    color: Colors.light.onSurfaceVariant,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 12,
    lineHeight: 18,
  },

  // ── Admin ──
  adminSection: {
    marginTop: 24,
    marginHorizontal: 24,
    flexDirection: "row",
    gap: 12,
  },
  adminBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: Colors.light.surfaceContainerLow,
  },
  adminBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.foreground,
  },
});
