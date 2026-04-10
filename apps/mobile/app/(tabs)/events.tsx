import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Image,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { EventFormModal } from "@/components/event-form-modal";
import { AttendeesModal } from "@/components/attendees-modal";
import { haptics } from "@/lib/haptics";
import { addEventToCalendar } from "@/lib/calendar";
import { shareEvent } from "@/lib/sharing";
import { showEventContextMenu } from "@/lib/context-menu";
import { trackPositiveAction } from "@/lib/store-review";

const API_URL =
  process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Stitch design image placeholders per category
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

const CATEGORIES = ["All Events", "Social", "Sporting", "Dining"] as const;
type Category = (typeof CATEGORIES)[number];

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
  user_rsvp_status: string | null;
  category?: string;
}

const serifFont = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

export default function EventsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<EventWithRsvp[]>([]);
  const [role, setRole] = useState<string>("member");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>("All Events");

  // Admin form state
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithRsvp | null>(null);
  const [viewingAttendees, setViewingAttendees] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const getHeaders = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      h["Authorization"] = `Bearer ${session.access_token}`;
    }
    return h;
  }, [session?.access_token]);

  const fetchEvents = useCallback(async () => {
    const headers = getHeaders();
    try {
      const res = await fetch(`${API_URL}/api/events`, { headers });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
        if (data.role) setRole(data.role);
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const isAdmin = role === "admin";

  const filteredEvents =
    activeCategory === "All Events"
      ? events
      : events.filter(
          (e) =>
            (e.category || "social").toLowerCase() ===
            activeCategory.toLowerCase()
        );

  function handleRsvp(eventId: string, currentStatus: string | null) {
    if (currentStatus === "attending") {
      Alert.alert(
        "Cancel RSVP",
        "Are you sure you want to cancel your RSVP?",
        [
          { text: "Keep RSVP", style: "cancel" },
          {
            text: "Cancel RSVP",
            style: "destructive",
            onPress: () => executeRsvp(eventId, "declined"),
          },
        ]
      );
    } else {
      executeRsvp(eventId, "attending");
    }
  }

  async function executeRsvp(eventId: string, newStatus: string) {
    const headers = getHeaders();
    setRsvpLoading(eventId);
    try {
      const res = await fetch(`${API_URL}/api/events/rsvp`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event_id: eventId,
          status: newStatus,
          guest_count: 0,
        }),
      });

      if (res.ok) {
        if (newStatus === "attending") {
          haptics.success();
          trackPositiveAction();
          const event = events.find((e) => e.id === eventId);
          if (event) {
            Alert.alert("RSVP Confirmed!", `You're attending ${event.title}.`, [
              {
                text: "Add to Calendar",
                onPress: () =>
                  addEventToCalendar({
                    title: event.title,
                    startDate: event.start_date,
                    endDate: event.end_date || undefined,
                    location: event.location || undefined,
                    description: event.description || undefined,
                  }),
              },
              { text: "Done" },
            ]);
          }
        } else {
          haptics.medium();
        }
        await fetchEvents();
      } else {
        haptics.error();
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to RSVP");
      }
    } catch {
      haptics.error();
      Alert.alert("Error", "Failed to RSVP");
    } finally {
      setRsvpLoading(null);
    }
  }

  async function handlePublish(eventId: string) {
    const headers = getHeaders();
    setActionLoading(eventId);
    try {
      const res = await fetch(`${API_URL}/api/events/admin/${eventId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status: "published" }),
      });
      if (res.ok) {
        await fetchEvents();
      } else {
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to publish");
      }
    } catch {
      Alert.alert("Error", "Failed to publish event");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(eventId: string) {
    Alert.alert(
      "Delete Event",
      "Are you sure you want to delete this event? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const headers = getHeaders();
            setActionLoading(eventId);
            try {
              const res = await fetch(
                `${API_URL}/api/events/admin/${eventId}`,
                { method: "DELETE", headers }
              );
              if (res.ok) {
                await fetchEvents();
              } else {
                const data = await res.json();
                Alert.alert("Error", data.error || "Failed to delete");
              }
            } catch {
              Alert.alert("Error", "Failed to delete event");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  }

  function showAdminMenu(event: EventWithRsvp) {
    const actions: {
      text: string;
      onPress: () => void;
      style?: "destructive" | "cancel";
    }[] = [];

    if (event.status === "draft") {
      actions.push({
        text: "Publish",
        onPress: () => handlePublish(event.id),
      });
    }

    actions.push({
      text: "View Attendees",
      onPress: () =>
        setViewingAttendees({ id: event.id, title: event.title }),
    });

    actions.push({
      text: "Edit",
      onPress: () => {
        setEditingEvent(event);
        setShowForm(true);
      },
    });

    actions.push({
      text: "Delete",
      style: "destructive",
      onPress: () => handleDelete(event.id),
    });

    actions.push({ text: "Cancel", onPress: () => {}, style: "cancel" });

    Alert.alert("Event Actions", event.title, actions);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function getEventImage(event: EventWithRsvp) {
    const cat = (event.category || "default").toLowerCase();
    return EVENT_IMAGES[cat] || EVENT_IMAGES.default;
  }

  function getCategoryLabel(event: EventWithRsvp) {
    const cat = (event.category || "social").toLowerCase();
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    if (event.location) return `${label} · ${event.location}`;
    return label;
  }

  function getActionLabel(event: EventWithRsvp) {
    const cat = (event.category || "social").toLowerCase();
    if (cat === "dining") return "Book Experience";
    if (cat === "sporting") return "Tournament Details";
    return "Reserve Seat";
  }

  function isPastEvent(event: EventWithRsvp) {
    return new Date(event.start_date) < new Date();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  // Determine featured event (first event) and remaining
  const featuredEvent = filteredEvents.length > 0 ? filteredEvents[0] : null;
  const remainingEvents = filteredEvents.slice(1);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              haptics.light();
              setRefreshing(true);
              fetchEvents();
            }}
            tintColor={Colors.light.primary}
          />
        }
      >
        {/* Hero header — matches Stitch "Seasonal Highlights" section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroLabel}>SEASONAL HIGHLIGHTS</Text>
          <Text style={styles.heroTitle}>
            Club{"\n"}Gatherings &{"\n"}Curated Socials
          </Text>
          <Text style={styles.heroSubtitle}>
            Experience the pinnacle of club life through our exclusive
            member-only events.
          </Text>
        </View>

        {/* Category filter pills — matches Stitch filter row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.filterPill,
                  isActive && styles.filterPillActive,
                ]}
                onPress={() => setActiveCategory(cat)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isActive && styles.filterPillTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Events list */}
        {filteredEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="calendar-outline"
              size={48}
              color={Colors.light.outlineVariant}
            />
            <Text style={styles.emptyTitle}>
              {isAdmin ? "No events yet" : "No upcoming events"}
            </Text>
            <Text style={styles.emptyText}>
              {isAdmin
                ? "Tap the + button to create your first event."
                : "Check back soon for club events and social gatherings."}
            </Text>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {/* Featured event card — Stitch: large overlay card with content on image */}
            {featuredEvent && (
              <TouchableOpacity
                style={styles.featuredCard}
                activeOpacity={0.85}
                onPress={() => router.push(`/event/${featuredEvent.id}`)}
                onLongPress={() =>
                  showEventContextMenu({
                    title: featuredEvent.title,
                    onAddToCalendar: () =>
                      addEventToCalendar({
                        title: featuredEvent.title,
                        startDate: featuredEvent.start_date,
                        endDate: featuredEvent.end_date || undefined,
                        location: featuredEvent.location || undefined,
                        description: featuredEvent.description || undefined,
                      }),
                    onShare: () =>
                      shareEvent({
                        title: featuredEvent.title,
                        date: featuredEvent.start_date,
                        location: featuredEvent.location || undefined,
                        description: featuredEvent.description || undefined,
                      }),
                    onViewDetails: () => router.push(`/event/${featuredEvent.id}`),
                  })
                }
              >
                <Image
                  source={{ uri: getEventImage(featuredEvent) }}
                  style={styles.featuredImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={[
                    "transparent",
                    "rgba(1, 45, 29, 0.2)",
                    Colors.light.primary,
                  ]}
                  style={styles.featuredGradient}
                />
                {/* Signature Event badge — top left */}
                <View style={styles.signatureBadge}>
                  <Text style={styles.signatureBadgeText}>
                    {(featuredEvent.category || "Social").toUpperCase()}
                  </Text>
                </View>
                {/* Admin menu */}
                {isAdmin && (
                  <TouchableOpacity
                    onPress={() => showAdminMenu(featuredEvent)}
                    disabled={actionLoading === featuredEvent.id}
                    style={styles.featuredAdminBtn}
                    activeOpacity={0.6}
                  >
                    {actionLoading === featuredEvent.id ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={18}
                        color="#ffffff"
                      />
                    )}
                  </TouchableOpacity>
                )}
                {/* Content overlay — bottom */}
                <View style={styles.featuredContent}>
                  <View style={styles.featuredDateRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={Colors.light.tertiaryFixed}
                    />
                    <Text style={styles.featuredDateText}>
                      {formatDate(featuredEvent.start_date).toUpperCase()} ·{" "}
                      {formatTime(featuredEvent.start_date)}
                    </Text>
                  </View>
                  <Text style={styles.featuredTitle}>
                    {featuredEvent.title}
                  </Text>
                  {featuredEvent.description && (
                    <Text style={styles.featuredDescription} numberOfLines={2}>
                      {featuredEvent.description}
                    </Text>
                  )}
                  {/* Reserve Seat button — hide for past events */}
                  {featuredEvent.status === "published" && !isPastEvent(featuredEvent) && (
                    <TouchableOpacity
                      style={[
                        styles.featuredBtn,
                        featuredEvent.user_rsvp_status === "attending" &&
                          styles.featuredBtnAttending,
                        rsvpLoading === featuredEvent.id && { opacity: 0.5 },
                      ]}
                      onPress={() =>
                        handleRsvp(
                          featuredEvent.id,
                          featuredEvent.user_rsvp_status
                        )
                      }
                      disabled={rsvpLoading === featuredEvent.id}
                      activeOpacity={0.7}
                    >
                      {rsvpLoading === featuredEvent.id ? (
                        <ActivityIndicator size="small" color={Colors.light.primary} />
                      ) : featuredEvent.user_rsvp_status === "attending" ? (
                        <View style={styles.featuredBtnRow}>
                          <Ionicons name="checkmark-circle" size={16} color="#1b4332" />
                          <Text style={styles.featuredBtnTextAttending}>Attending</Text>
                        </View>
                      ) : (
                        <Text style={styles.featuredBtnText}>
                          {getActionLabel(featuredEvent)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {/* Remaining event cards — Stitch: white card with image header + body */}
            {remainingEvents.map((event) => {
              const isAttending = event.user_rsvp_status === "attending";
              const isLoadingThis = rsvpLoading === event.id;
              const isActionLoading = actionLoading === event.id;
              const hasCapacity = event.capacity && event.capacity > 0;
              const spotsLeft = hasCapacity
                ? event.capacity! - event.rsvp_count
                : null;

              return (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/event/${event.id}`)}
                  onLongPress={() =>
                    showEventContextMenu({
                      title: event.title,
                      onAddToCalendar: () =>
                        addEventToCalendar({
                          title: event.title,
                          startDate: event.start_date,
                          endDate: event.end_date || undefined,
                          location: event.location || undefined,
                          description: event.description || undefined,
                        }),
                      onShare: () =>
                        shareEvent({
                          title: event.title,
                          date: event.start_date,
                          location: event.location || undefined,
                          description: event.description || undefined,
                        }),
                      onViewDetails: () => router.push(`/event/${event.id}`),
                    })
                  }
                >
                  {/* Card image */}
                  <View style={styles.cardImageWrap}>
                    <Image
                      source={{ uri: getEventImage(event) }}
                      style={styles.cardImage}
                      resizeMode="cover"
                    />
                    <View style={styles.cardImageTint} />
                    {/* Admin menu on image */}
                    {isAdmin && (
                      <TouchableOpacity
                        onPress={() => showAdminMenu(event)}
                        disabled={isActionLoading}
                        style={styles.cardAdminBtn}
                        activeOpacity={0.6}
                      >
                        {isActionLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Ionicons
                            name="ellipsis-horizontal"
                            size={16}
                            color="#fff"
                          />
                        )}
                      </TouchableOpacity>
                    )}
                    {/* Limited badge */}
                    {spotsLeft !== null && spotsLeft <= 15 && (
                      <View style={styles.limitedBadge}>
                        <Text style={styles.limitedBadgeText}>LIMITED</Text>
                      </View>
                    )}
                  </View>

                  {/* Card body — matches Stitch p-8 section */}
                  <View style={styles.cardBody}>
                    {/* Category + location label */}
                    <View style={styles.cardCategoryRow}>
                      <Text style={styles.cardCategoryText}>
                        {getCategoryLabel(event).toUpperCase()}
                      </Text>
                      <View style={styles.cardDot} />
                    </View>

                    {/* Title */}
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {event.title}
                    </Text>

                    {/* Meta rows — matches Stitch schedule/location/group icons */}
                    <View style={styles.cardMeta}>
                      <View style={styles.metaRow}>
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color={Colors.light.onSurfaceVariant}
                        />
                        <Text style={styles.metaText}>
                          {formatDate(event.start_date)} ·{" "}
                          {formatTime(event.start_date)}
                        </Text>
                      </View>
                      {event.location && (
                        <View style={styles.metaRow}>
                          <Ionicons
                            name="location-outline"
                            size={16}
                            color={Colors.light.onSurfaceVariant}
                          />
                          <Text style={styles.metaText}>{event.location}</Text>
                        </View>
                      )}
                      <View style={styles.metaRow}>
                        <Ionicons
                          name="people-outline"
                          size={16}
                          color={Colors.light.onSurfaceVariant}
                        />
                        <Text style={styles.metaText}>
                          {spotsLeft !== null
                            ? `${spotsLeft} Seats Remaining`
                            : `${event.rsvp_count} attending`}
                        </Text>
                      </View>
                    </View>

                    {/* Action button — hide for past events */}
                    {event.status === "published" && !isPastEvent(event) && (
                      <TouchableOpacity
                        style={[
                          styles.cardBtn,
                          isAttending && styles.cardBtnAttending,
                          isLoadingThis && { opacity: 0.5 },
                        ]}
                        onPress={() =>
                          handleRsvp(event.id, event.user_rsvp_status)
                        }
                        disabled={isLoadingThis}
                        activeOpacity={0.7}
                      >
                        {isLoadingThis ? (
                          <ActivityIndicator
                            size="small"
                            color={
                              isAttending
                                ? Colors.light.primary
                                : Colors.light.primary
                            }
                          />
                        ) : isAttending ? (
                          <View style={styles.cardBtnRow}>
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color={Colors.light.primary}
                            />
                            <Text style={styles.cardBtnTextActive}>
                              Attending
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.cardBtnText}>
                            {getActionLabel(event)}
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}

                    {/* Draft indicator for admin */}
                    {isAdmin && event.status === "draft" && (
                      <View style={styles.draftRow}>
                        <Ionicons
                          name="document-outline"
                          size={13}
                          color={Colors.light.onSurfaceVariant}
                        />
                        <Text style={styles.draftText}>Draft</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* "Host Your Own Occasion" CTA — matches Stitch dark primary card */}
        <View style={styles.ctaCard}>
          <LinearGradient
            colors={[Colors.light.primary, Colors.light.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            <Ionicons
              name="sparkles"
              size={32}
              color={Colors.light.tertiaryFixed}
              style={styles.ctaIcon}
            />
            <Text style={styles.ctaTitle}>Host Your Own Occasion</Text>
            <Text style={styles.ctaDescription}>
              The club offers bespoke event planning services for private
              member celebrations.
            </Text>
            <TouchableOpacity style={styles.ctaLink} activeOpacity={0.7}>
              <Text style={styles.ctaLinkText}>INQUIRE TODAY</Text>
              <Ionicons
                name="arrow-forward"
                size={14}
                color={Colors.light.tertiaryFixed}
              />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </ScrollView>

      {/* Admin FAB */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setEditingEvent(null);
            setShowForm(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons
            name="add"
            size={28}
            color={Colors.light.primaryForeground}
          />
        </TouchableOpacity>
      )}

      {/* Event form modal */}
      <EventFormModal
        visible={showForm}
        event={editingEvent}
        apiUrl={API_URL}
        headers={getHeaders()}
        onClose={() => {
          setShowForm(false);
          setEditingEvent(null);
        }}
        onSaved={() => {
          setShowForm(false);
          setEditingEvent(null);
          fetchEvents();
        }}
      />

      {/* Attendees modal */}
      <AttendeesModal
        visible={!!viewingAttendees}
        eventId={viewingAttendees?.id ?? ""}
        eventTitle={viewingAttendees?.title ?? ""}
        apiUrl={API_URL}
        headers={getHeaders()}
        onClose={() => setViewingAttendees(null)}
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
    paddingBottom: 120,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.background,
    padding: 24,
  },

  // ── Hero section (Stitch: "Seasonal Highlights" + headline) ──
  heroSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 3,
    color: Colors.light.tertiary,
    marginBottom: 12,
  },
  heroTitle: {
    fontFamily: serifFont,
    fontSize: 38,
    fontWeight: "700",
    color: Colors.light.primary,
    lineHeight: 44,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    fontStyle: "italic",
    color: Colors.light.onSurfaceVariant,
    lineHeight: 24,
  },

  // ── Filter pills (Stitch: px-8 py-3 rounded-full) ──
  filterRow: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 10,
    flexDirection: "row",
  },
  filterPill: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 9999,
    backgroundColor: Colors.light.surfaceContainerLow,
  },
  filterPillActive: {
    backgroundColor: Colors.light.primary,
    shadowColor: "#191c1c",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.light.foreground,
  },
  filterPillTextActive: {
    color: "#ffffff",
  },

  // ── Empty state ──
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: serifFont,
    fontSize: 20,
    color: Colors.light.foreground,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.onSurfaceVariant,
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Events list ──
  eventsList: {
    paddingHorizontal: 24,
    gap: 24,
  },

  // ── Featured card (Stitch: large overlay card, aspect-[16/9]) ──
  featuredCard: {
    borderRadius: 16,
    overflow: "hidden",
    height: 280,
    position: "relative",
    backgroundColor: Colors.light.primaryContainer,
  },
  featuredImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    opacity: 0.8,
  },
  featuredGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  signatureBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(52, 35, 0, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  signatureBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 3,
    color: Colors.light.tertiaryFixed,
  },
  featuredAdminBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  featuredContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  featuredDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  featuredDateText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    color: Colors.light.tertiaryFixed,
  },
  featuredTitle: {
    fontFamily: serifFont,
    fontSize: 28,
    color: "#ffffff",
    marginBottom: 4,
  },
  featuredDescription: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
    marginBottom: 12,
  },
  featuredBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
  },
  featuredBtnAttending: {
    backgroundColor: Colors.light.accent,
  },
  featuredBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  featuredBtnText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    color: Colors.light.primary,
    textTransform: "uppercase",
  },
  featuredBtnTextAttending: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#1b4332",
    textTransform: "uppercase",
  },

  // ── Regular event card (Stitch: bg-surface-container-lowest rounded-xl editorial-shadow) ──
  eventCard: {
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#191c1c",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  cardImageWrap: {
    height: 200,
    position: "relative",
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardImageTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(1, 45, 29, 0.1)",
  },
  cardAdminBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  limitedBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: Colors.light.tertiaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  limitedBadgeText: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
    color: Colors.light.tertiary,
  },

  // Card body (Stitch: p-8)
  cardBody: {
    padding: 24,
  },
  cardCategoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardCategoryText: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 2.5,
    color: Colors.light.onSurfaceVariant,
  },
  cardDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.primary,
  },
  cardTitle: {
    fontFamily: serifFont,
    fontSize: 22,
    color: Colors.light.primary,
    marginBottom: 12,
  },
  cardMeta: {
    gap: 8,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaText: {
    fontSize: 13,
    color: Colors.light.onSurfaceVariant,
  },

  // Card button (Stitch: w-full py-4 rounded-xl bg-surface-container-highest)
  cardBtn: {
    backgroundColor: Colors.light.surfaceContainerHighest,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  cardBtnAttending: {
    backgroundColor: Colors.light.accent,
  },
  cardBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardBtnText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    color: Colors.light.primary,
    textTransform: "uppercase",
  },
  cardBtnTextActive: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    color: Colors.light.primary,
    textTransform: "uppercase",
  },

  // Draft indicator
  draftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
  },
  draftText: {
    fontSize: 11,
    color: Colors.light.onSurfaceVariant,
    fontWeight: "500",
  },

  // ── CTA card (Stitch: bg-primary p-8 rounded-xl) ──
  ctaCard: {
    marginHorizontal: 24,
    marginTop: 32,
    borderRadius: 16,
    overflow: "hidden",
  },
  ctaGradient: {
    padding: 28,
  },
  ctaIcon: {
    marginBottom: 20,
  },
  ctaTitle: {
    fontFamily: serifFont,
    fontSize: 26,
    color: "#ffffff",
    marginBottom: 10,
  },
  ctaDescription: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 20,
    marginBottom: 24,
  },
  ctaLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ctaLinkText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 3,
    color: Colors.light.tertiaryFixed,
  },

  // ── FAB ──
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#191c1c",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },

});
