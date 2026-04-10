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
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { shareScorecard } from "@/lib/sharing";
import { haptics } from "@/lib/haptics";

const API_URL =
  process.env.EXPO_PUBLIC_APP_URL || "http://localhost:3000";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const serifFont = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

interface GolfRound {
  id: string;
  facility_id: string;
  facility_name: string;
  played_at: string;
  tee_set: string;
  holes_played: number;
  total_score: number | null;
  total_putts: number | null;
  total_fairways_hit: number | null;
  total_greens_in_regulation: number | null;
  weather: string | null;
  status: string;
  score_to_par: number | null;
  course_par: number | null;
}

interface Facility {
  id: string;
  name: string;
}

interface CourseHole {
  hole_number: number;
  par: number;
  yardage_back: number;
  yardage_middle: number | null;
  yardage_forward: number | null;
  handicap_index: number;
}

interface GolfScore {
  hole_number: number;
  strokes: number | null;
  putts: number | null;
  fairway_hit: boolean | null;
  green_in_regulation: boolean | null;
  penalty_strokes: number;
}

type ScreenView = "history" | "new_round" | "scoring";

export default function ScorecardScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<ScreenView>("history");
  const [rounds, setRounds] = useState<GolfRound[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New round form
  const [selectedFacility, setSelectedFacility] = useState<string>("");
  const [teeSet, setTeeSet] = useState<string>("middle");
  const [holesPlayed, setHolesPlayed] = useState<number>(18);
  const [weather, setWeather] = useState<string>("");
  const [creating, setCreating] = useState(false);

  // Active round scoring
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [activeRound, setActiveRound] = useState<GolfRound | null>(null);
  const [holes, setHoles] = useState<CourseHole[]>([]);
  const [scores, setScores] = useState<Map<number, GolfScore>>(new Map());
  const [activeHole, setActiveHole] = useState(1);
  const [saving, setSaving] = useState(false);

  const headers = {
    "Content-Type": "application/json",
    ...(session?.access_token && {
      Authorization: `Bearer ${session.access_token}`,
    }),
  };

  const fetchRounds = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/scorecards`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRounds(data.rounds ?? []);
        setFacilities(data.facilities ?? []);
        if (data.facilities?.length > 0 && !selectedFacility) {
          setSelectedFacility(data.facilities[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch rounds:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchRounds();
  }, [fetchRounds]);

  async function fetchRoundDetail(roundId: string) {
    try {
      const res = await fetch(`${API_URL}/api/scorecards/${roundId}`, {
        headers,
      });
      if (!res.ok) return;
      const data = await res.json();
      setActiveRound(data.round);
      setHoles(data.holes);

      const map = new Map<number, GolfScore>();
      const hc = data.round.holes_played;
      for (let i = 1; i <= hc; i++) {
        const existing = data.scores.find(
          (s: GolfScore) => s.hole_number === i
        );
        map.set(i, {
          hole_number: i,
          strokes: existing?.strokes ?? null,
          putts: existing?.putts ?? null,
          fairway_hit: existing?.fairway_hit ?? null,
          green_in_regulation: existing?.green_in_regulation ?? null,
          penalty_strokes: existing?.penalty_strokes ?? 0,
        });
      }
      setScores(map);
      setActiveHole(1);
      setActiveRoundId(roundId);
      setView("scoring");
    } catch (err) {
      Alert.alert("Error", "Failed to load round");
    }
  }

  async function createRound() {
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/scorecards`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          facility_id: selectedFacility,
          played_at: new Date().toISOString().slice(0, 10),
          tee_set: teeSet,
          holes_played: holesPlayed,
          weather: weather || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to start round");
        return;
      }
      const data = await res.json();
      await fetchRoundDetail(data.round.id);
    } catch {
      Alert.alert("Error", "Failed to create round");
    } finally {
      setCreating(false);
    }
  }

  function updateScore(
    hole: number,
    field: keyof GolfScore,
    value: unknown
  ) {
    setScores((prev) => {
      const next = new Map(prev);
      const entry = { ...next.get(hole)! };
      (entry as Record<string, unknown>)[field] = value;
      next.set(hole, entry);
      return next;
    });
  }

  async function saveScores() {
    if (!activeRoundId) return;
    setSaving(true);
    try {
      const toSave = Array.from(scores.values()).filter(
        (s) => s.strokes != null
      );
      if (toSave.length === 0) return;
      await fetch(`${API_URL}/api/scorecards/${activeRoundId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ scores: toSave }),
      });
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function completeRound() {
    Alert.alert("Finish Round", "Finalize this round?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Finish",
        onPress: async () => {
          await saveScores();
          try {
            await fetch(`${API_URL}/api/scorecards/${activeRoundId}`, {
              method: "PATCH",
              headers,
              body: JSON.stringify({ action: "complete" }),
            });
            setView("history");
            fetchRounds();
          } catch {
            Alert.alert("Error", "Failed to complete round");
          }
        },
      },
    ]);
  }

  function formatScoreToPar(val: number | null) {
    if (val == null) return "—";
    if (val === 0) return "E";
    if (val > 0) return `+${val}`;
    return `${val}`;
  }

  function getScoreColor(strokes: number | null, par: number) {
    if (strokes == null) return Colors.light.mutedForeground;
    const diff = strokes - par;
    if (diff <= -2) return "#d97706";
    if (diff === -1) return "#dc2626";
    if (diff === 0) return Colors.light.primary;
    if (diff === 1) return "#2563eb";
    return Colors.light.mutedForeground;
  }

  function getScoreBg(strokes: number | null, par: number) {
    if (strokes == null) return "transparent";
    const diff = strokes - par;
    if (diff <= -2) return "#fef3c7";
    if (diff === -1) return "#fee2e2";
    if (diff === 0) return "#dcfce7";
    if (diff === 1) return "#dbeafe";
    return "#f3f4f6";
  }

  // ── HISTORY VIEW ──
  if (view === "history") {
    const completedRounds = rounds.filter((r) => r.status === "completed");
    const bestScore = completedRounds.length
      ? Math.min(
          ...completedRounds
            .filter((r) => r.total_score != null)
            .map((r) => r.total_score!)
        )
      : null;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontFamily: serifFont }]}>
            Scorecards
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setView("new_round")}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>New Round</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                haptics.light();
                setRefreshing(true);
                fetchRounds();
              }}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Stats */}
          {completedRounds.length > 0 && (
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Rounds</Text>
                <Text style={styles.statValue}>
                  {completedRounds.length}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Best</Text>
                <Text style={styles.statValue}>{bestScore ?? "—"}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Avg</Text>
                <Text style={styles.statValue}>
                  {completedRounds.length
                    ? Math.round(
                        completedRounds
                          .filter((r) => r.total_score != null)
                          .reduce((s, r) => s + r.total_score!, 0) /
                          completedRounds.filter(
                            (r) => r.total_score != null
                          ).length
                      )
                    : "—"}
                </Text>
              </View>
            </View>
          )}

          {loading ? (
            <ActivityIndicator
              size="large"
              color={Colors.light.primary}
              style={{ marginTop: 40 }}
            />
          ) : rounds.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="flag-outline"
                size={48}
                color={Colors.light.mutedForeground}
              />
              <Text style={styles.emptyTitle}>No rounds yet</Text>
              <Text style={styles.emptySubtitle}>
                Start a new round to track your scores
              </Text>
            </View>
          ) : (
            rounds.map((round) => (
              <TouchableOpacity
                key={round.id}
                style={styles.roundCard}
                onPress={() => fetchRoundDetail(round.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.roundCourse}>
                    {round.facility_name}
                  </Text>
                  <Text style={styles.roundMeta}>
                    {new Date(round.played_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {round.holes_played}H · {round.tee_set} tees
                    {round.weather ? ` · ${round.weather}` : ""}
                  </Text>
                  {round.status === "in_progress" && (
                    <View style={styles.inProgressBadge}>
                      <Text style={styles.inProgressText}>In Progress</Text>
                    </View>
                  )}
                </View>
                {round.total_score != null && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        haptics.light();
                        shareScorecard({
                          facilityName: round.facility_name,
                          date: round.played_at,
                          score: round.total_score!,
                          par: round.course_par || 72,
                          holes: round.holes_played,
                        });
                      }}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="share-outline" size={18} color={Colors.light.onSurfaceVariant} />
                    </TouchableOpacity>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.roundScore}>{round.total_score}</Text>
                      <Text
                        style={[
                          styles.roundToPar,
                          {
                            color:
                              (round.score_to_par ?? 0) < 0
                                ? "#dc2626"
                                : (round.score_to_par ?? 0) === 0
                                  ? Colors.light.primary
                                  : Colors.light.foreground,
                          },
                        ]}
                      >
                        {formatScoreToPar(round.score_to_par)}
                      </Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    );
  }

  // ── NEW ROUND VIEW ──
  if (view === "new_round") {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView("history")}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={Colors.light.foreground}
            />
          </TouchableOpacity>
          <Text style={[styles.title, { fontFamily: serifFont, flex: 1, marginLeft: 12 }]}>
            New Round
          </Text>
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Course selection */}
          <Text style={styles.fieldLabel}>Course</Text>
          {facilities.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.optionCard,
                selectedFacility === f.id && styles.optionCardActive,
              ]}
              onPress={() => setSelectedFacility(f.id)}
            >
              <Ionicons
                name={
                  selectedFacility === f.id
                    ? "radio-button-on"
                    : "radio-button-off"
                }
                size={20}
                color={
                  selectedFacility === f.id
                    ? Colors.light.primary
                    : Colors.light.mutedForeground
                }
              />
              <Text style={styles.optionText}>{f.name}</Text>
            </TouchableOpacity>
          ))}

          {/* Tees */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Tees</Text>
          <View style={styles.chipRow}>
            {["back", "middle", "forward"].map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.chip,
                  teeSet === t && styles.chipActive,
                ]}
                onPress={() => setTeeSet(t)}
              >
                <Text
                  style={[
                    styles.chipText,
                    teeSet === t && styles.chipTextActive,
                  ]}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Holes */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Holes</Text>
          <View style={styles.chipRow}>
            {[18, 9].map((h) => (
              <TouchableOpacity
                key={h}
                style={[
                  styles.chip,
                  holesPlayed === h && styles.chipActive,
                ]}
                onPress={() => setHolesPlayed(h)}
              >
                <Text
                  style={[
                    styles.chipText,
                    holesPlayed === h && styles.chipTextActive,
                  ]}
                >
                  {h} Holes
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Weather */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>
            Weather (optional)
          </Text>
          <View style={styles.chipRow}>
            {["sunny", "cloudy", "windy", "rainy", "cold"].map((w) => (
              <TouchableOpacity
                key={w}
                style={[
                  styles.chip,
                  weather === w && styles.chipActive,
                ]}
                onPress={() => setWeather(weather === w ? "" : w)}
              >
                <Text
                  style={[
                    styles.chipText,
                    weather === w && styles.chipTextActive,
                  ]}
                >
                  {w.charAt(0).toUpperCase() + w.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.startButton,
              creating && { opacity: 0.6 },
            ]}
            onPress={createRound}
            disabled={creating || !selectedFacility}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startButtonText}>Start Round</Text>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ── SCORING VIEW ──
  const currentHole = holes.find((h) => h.hole_number === activeHole);
  const currentScore = scores.get(activeHole);
  const holeCount = activeRound?.holes_played ?? 18;

  const totalStrokes = Array.from(scores.values()).reduce(
    (s, sc) => s + (sc.strokes ?? 0),
    0
  );
  const totalPar = holes
    .filter((h) => h.hole_number <= holeCount)
    .reduce((s, h) => s + h.par, 0);
  const scoreToPar = totalStrokes - totalPar;
  const holesCompleted = Array.from(scores.values()).filter(
    (s) => s.strokes != null
  ).length;

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            saveScores();
            setView("history");
            fetchRounds();
          }}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={Colors.light.foreground}
          />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.title, { fontFamily: serifFont, fontSize: 18 }]}>
            {activeRound?.facility_name}
          </Text>
          <Text style={styles.roundMeta}>
            Hole {activeHole} of {holeCount} · {activeRound?.tee_set} tees
          </Text>
        </View>
        {activeRound?.status === "in_progress" && (
          <TouchableOpacity onPress={completeRound}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.light.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Score summary */}
      <View style={styles.scoreSummary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Score</Text>
          <Text style={styles.summaryValue}>
            {totalStrokes > 0 ? totalStrokes : "—"}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>To Par</Text>
          <Text
            style={[
              styles.summaryValue,
              {
                color:
                  totalStrokes > 0
                    ? scoreToPar < 0
                      ? "#dc2626"
                      : scoreToPar === 0
                        ? Colors.light.primary
                        : Colors.light.foreground
                    : Colors.light.mutedForeground,
              },
            ]}
          >
            {totalStrokes > 0 ? formatScoreToPar(scoreToPar) : "—"}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Thru</Text>
          <Text style={styles.summaryValue}>{holesCompleted}</Text>
        </View>
      </View>

      {/* Hole selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.holeSelector}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
      >
        {Array.from({ length: holeCount }, (_, i) => i + 1).map((num) => {
          const s = scores.get(num);
          const hasScore = s?.strokes != null;
          return (
            <TouchableOpacity
              key={num}
              onPress={() => setActiveHole(num)}
              style={[
                styles.holePill,
                activeHole === num && styles.holePillActive,
                hasScore && activeHole !== num && styles.holePillDone,
              ]}
            >
              <Text
                style={[
                  styles.holePillText,
                  activeHole === num && styles.holePillTextActive,
                ]}
              >
                {num}
              </Text>
              {hasScore && (
                <Text
                  style={[
                    styles.holePillScore,
                    activeHole === num && { color: "#fff" },
                  ]}
                >
                  {s!.strokes}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Active hole */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {currentHole && currentScore && (
          <View style={styles.scoringCard}>
            <View style={styles.holeHeader}>
              <Text style={styles.holeTitle}>Hole {activeHole}</Text>
              <View style={styles.holeInfo}>
                <Text style={styles.holeInfoText}>
                  Par {currentHole.par}
                </Text>
                <Text style={styles.holeInfoText}>
                  {activeRound?.tee_set === "back"
                    ? currentHole.yardage_back
                    : activeRound?.tee_set === "forward"
                      ? currentHole.yardage_forward
                      : currentHole.yardage_middle ??
                        currentHole.yardage_back}{" "}
                  yds
                </Text>
                <Text style={styles.holeInfoText}>
                  HCP {currentHole.handicap_index}
                </Text>
              </View>
            </View>

            {/* Strokes */}
            <Text style={styles.scoringLabel}>Strokes</Text>
            <View style={styles.numberRow}>
              {Array.from(
                { length: Math.max(8, currentHole.par + 4) },
                (_, i) => i + 1
              ).map((n) => (
                <TouchableOpacity
                  key={n}
                  disabled={activeRound?.status !== "in_progress"}
                  onPress={() =>
                    updateScore(
                      activeHole,
                      "strokes",
                      currentScore.strokes === n ? null : n
                    )
                  }
                  style={[
                    styles.numberButton,
                    currentScore.strokes === n && {
                      backgroundColor: getScoreBg(n, currentHole.par),
                      borderColor: getScoreColor(n, currentHole.par),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.numberButtonText,
                      currentScore.strokes === n && {
                        color: getScoreColor(n, currentHole.par),
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Putts */}
            <Text style={[styles.scoringLabel, { marginTop: 16 }]}>
              Putts
            </Text>
            <View style={styles.numberRow}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  disabled={activeRound?.status !== "in_progress"}
                  onPress={() =>
                    updateScore(
                      activeHole,
                      "putts",
                      currentScore.putts === n ? null : n
                    )
                  }
                  style={[
                    styles.numberButton,
                    currentScore.putts === n && {
                      backgroundColor: Colors.light.primary,
                      borderColor: Colors.light.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.numberButtonText,
                      currentScore.putts === n && {
                        color: "#fff",
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Fairway + GIR */}
            <View style={styles.boolRow}>
              {currentHole.par > 3 && (
                <View style={{ flex: 1 }}>
                  <Text style={styles.scoringLabel}>Fairway</Text>
                  <View style={styles.boolButtons}>
                    {[true, false].map((val) => (
                      <TouchableOpacity
                        key={String(val)}
                        disabled={activeRound?.status !== "in_progress"}
                        onPress={() =>
                          updateScore(
                            activeHole,
                            "fairway_hit",
                            currentScore.fairway_hit === val ? null : val
                          )
                        }
                        style={[
                          styles.boolButton,
                          currentScore.fairway_hit === val && {
                            backgroundColor: val ? "#dcfce7" : "#fee2e2",
                            borderColor: val ? "#16a34a" : "#dc2626",
                          },
                        ]}
                      >
                        <Ionicons
                          name={val ? "checkmark" : "close"}
                          size={16}
                          color={
                            currentScore.fairway_hit === val
                              ? val
                                ? "#16a34a"
                                : "#dc2626"
                              : Colors.light.mutedForeground
                          }
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.scoringLabel}>GIR</Text>
                <View style={styles.boolButtons}>
                  {[true, false].map((val) => (
                    <TouchableOpacity
                      key={String(val)}
                      disabled={activeRound?.status !== "in_progress"}
                      onPress={() =>
                        updateScore(
                          activeHole,
                          "green_in_regulation",
                          currentScore.green_in_regulation === val ? null : val
                        )
                      }
                      style={[
                        styles.boolButton,
                        currentScore.green_in_regulation === val && {
                          backgroundColor: val ? "#dcfce7" : "#fee2e2",
                          borderColor: val ? "#16a34a" : "#dc2626",
                        },
                      ]}
                    >
                      <Ionicons
                        name={val ? "checkmark" : "close"}
                        size={16}
                        color={
                          currentScore.green_in_regulation === val
                            ? val
                              ? "#16a34a"
                              : "#dc2626"
                            : Colors.light.mutedForeground
                        }
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Navigation */}
        {activeRound?.status === "in_progress" && (
          <View style={styles.navRow}>
            <TouchableOpacity
              disabled={activeHole === 1}
              onPress={() => setActiveHole(activeHole - 1)}
              style={[styles.navButton, activeHole === 1 && { opacity: 0.3 }]}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={Colors.light.foreground}
              />
              <Text style={styles.navButtonText}>Prev</Text>
            </TouchableOpacity>

            {activeHole < holeCount ? (
              <TouchableOpacity
                onPress={() => {
                  saveScores();
                  setActiveHole(activeHole + 1);
                }}
                style={styles.nextButton}
              >
                <Text style={styles.nextButtonText}>Next Hole</Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={completeRound}
                style={styles.nextButton}
              >
                <Ionicons name="flag" size={16} color="#fff" />
                <Text style={styles.nextButtonText}>Finish Round</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.foreground,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.foreground,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
  },
  roundCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 16,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  roundCourse: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.foreground,
  },
  roundMeta: {
    fontSize: 13,
    color: Colors.light.mutedForeground,
    marginTop: 2,
  },
  roundScore: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.foreground,
  },
  roundToPar: {
    fontSize: 14,
    fontWeight: "600",
  },
  inProgressBadge: {
    backgroundColor: "#fef3c7",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  inProgressText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400e",
  },
  // New round
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.foreground,
    paddingHorizontal: 20,
    marginBottom: 8,
    marginTop: 4,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surfaceContainerLowest,
  },
  optionCardActive: {
    borderColor: Colors.light.primary,
    backgroundColor: "#dcfce7",
  },
  optionText: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.light.foreground,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surfaceContainerLowest,
  },
  chipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.foreground,
  },
  chipTextActive: {
    color: "#fff",
  },
  startButton: {
    marginHorizontal: 20,
    marginTop: 28,
    backgroundColor: Colors.light.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  startButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  // Scoring
  scoreSummary: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surfaceContainerLowest,
  },
  summaryLabel: {
    fontSize: 11,
    color: Colors.light.mutedForeground,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.foreground,
  },
  holeSelector: {
    maxHeight: 56,
    marginBottom: 12,
  },
  holePill: {
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  holePillActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  holePillDone: {
    backgroundColor: Colors.light.muted,
  },
  holePillText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.light.foreground,
  },
  holePillTextActive: {
    color: "#fff",
  },
  holePillScore: {
    fontSize: 10,
    color: Colors.light.mutedForeground,
  },
  scoringCard: {
    marginHorizontal: 20,
    padding: 20,
    backgroundColor: Colors.light.surfaceContainerLowest,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  holeHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  holeTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.foreground,
  },
  holeInfo: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  holeInfoText: {
    fontSize: 13,
    color: Colors.light.mutedForeground,
  },
  scoringLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.foreground,
    marginBottom: 8,
  },
  numberRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  numberButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  numberButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.light.foreground,
  },
  boolRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
  },
  boolButtons: {
    flexDirection: "row",
    gap: 8,
  },
  boolButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 16,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 10,
  },
  navButtonText: {
    fontSize: 14,
    color: Colors.light.foreground,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
