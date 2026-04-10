"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, UserCircle, UserPlus, Users } from "lucide-react";
import type { TeeTimeSlot } from "@club/shared";

interface Facility {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

interface SearchMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  tier_name: string | null;
  tier_level: string | null;
}

interface PlayerEntry {
  type: "member" | "guest";
  member?: SearchMember;
  guestName?: string;
}

interface PlayerPricing {
  player_type: "member" | "guest";
  display_name: string;
  tier_name: string | null;
  greens_fee: number;
  cart_fee: number;
  caddie_fee: number;
  total_fee: number;
  rate_name: string | null;
}

interface RateLookupResponse {
  day_type: string;
  time_type: string;
  holes: string;
  players: PlayerPricing[];
  total: number;
}

interface TeeTimeBookingProps {
  onBooked: () => void;
  onClose: () => void;
}

type Step = "course" | "date" | "time" | "players";

export default function TeeTimeBooking({
  onBooked,
  onClose,
}: TeeTimeBookingProps) {
  const [step, setStep] = useState<Step>("course");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<TeeTimeSlot | null>(null);
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<TeeTimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Player picker state
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [addingGuest, setAddingGuest] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Pricing state
  const [pricing, setPricing] = useState<RateLookupResponse | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const pricingTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const partySize = 1 + players.length; // booking member + added players

  // Generate next 14 days for date picking
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });

  // Current month/year for the calendar display
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Fetch golf facilities dynamically
  useEffect(() => {
    async function fetchFacilities() {
      try {
        const res = await fetch("/api/facilities?type=golf");
        if (res.ok) {
          const data = await res.json();
          setFacilities(data.facilities);
        }
      } catch {
        setError("Failed to load golf courses");
      } finally {
        setLoadingFacilities(false);
      }
    }
    fetchFacilities();
  }, []);

  useEffect(() => {
    if (selectedFacility && selectedDate) {
      fetchSlots();
    }
  }, [selectedFacility, selectedDate]);

  // Fetch pricing when players change or we enter the players step
  const fetchPricing = useCallback(async () => {
    if (!selectedFacility || !selectedDate || !selectedTime) return;
    setLoadingPricing(true);
    try {
      const playerEntries = players.map((p) => ({
        player_type: p.type,
        member_id: p.type === "member" ? p.member?.id ?? null : null,
        guest_name: p.type === "guest" ? p.guestName ?? null : null,
      }));

      const res = await fetch("/api/bookings/rate-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: selectedFacility.id,
          date: selectedDate,
          start_time: selectedTime.start_time,
          holes: "18",
          players: playerEntries,
        }),
      });

      if (res.ok) {
        const data: RateLookupResponse = await res.json();
        setPricing(data);
      }
    } catch {
      // silent — pricing is informational
    } finally {
      setLoadingPricing(false);
    }
  }, [selectedFacility, selectedDate, selectedTime, players]);

  useEffect(() => {
    if (step === "players") {
      // Debounce pricing fetch (300ms after player list changes)
      if (pricingTimeout.current) clearTimeout(pricingTimeout.current);
      pricingTimeout.current = setTimeout(() => fetchPricing(), 300);
    }
  }, [step, players, fetchPricing]);

  // Click outside to close search dropdown
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced member search
  const searchMembers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/members/search?q=${encodeURIComponent(query)}&limit=8`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.members ?? []);
      }
    } catch {
      // silent
    } finally {
      setSearching(false);
    }
  }, []);

  function handleSearchInput(value: string) {
    setMemberSearch(value);
    setShowSearch(true);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchMembers(value), 300);
  }

  function addMemberPlayer(member: SearchMember) {
    // Don't add duplicates
    if (players.some((p) => p.type === "member" && p.member?.id === member.id))
      return;
    if (players.length >= 3) return; // max 4 total including booker
    setPlayers((prev) => [...prev, { type: "member", member }]);
    setMemberSearch("");
    setSearchResults([]);
    setShowSearch(false);
  }

  function addGuestPlayer() {
    if (!guestNameInput.trim() || players.length >= 3) return;
    setPlayers((prev) => [
      ...prev,
      { type: "guest", guestName: guestNameInput.trim() },
    ]);
    setGuestNameInput("");
    setAddingGuest(false);
  }

  function removePlayer(index: number) {
    setPlayers((prev) => prev.filter((_, i) => i !== index));
  }

  async function fetchSlots() {
    if (!selectedFacility) return;
    setLoadingSlots(true);
    setError(null);
    setSelectedTime(null);
    try {
      const res = await fetch(
        `/api/bookings/tee-times?facility_id=${selectedFacility.id}&date=${selectedDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to load tee times");
      }
    } catch {
      setError("Failed to load tee times");
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleBook() {
    if (!selectedFacility || !selectedDate || !selectedTime) return;
    setBooking(true);
    setError(null);
    try {
      const playerEntries = players.map((p) => ({
        player_type: p.type,
        member_id: p.type === "member" ? p.member?.id ?? null : null,
        guest_name: p.type === "guest" ? p.guestName ?? null : null,
      }));

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: selectedFacility.id,
          date: selectedDate,
          start_time: selectedTime.start_time,
          end_time: selectedTime.end_time,
          party_size: partySize,
          notes: notes || undefined,
          players: playerEntries.length > 0 ? playerEntries : undefined,
        }),
      });

      if (res.ok) {
        onBooked();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to book tee time");
      }
    } catch {
      setError("Failed to book tee time");
    } finally {
      setBooking(false);
    }
  }

  function formatTime(timeStr: string) {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${display}:${m} ${ampm}`;
  }

  function formatDateDisplay(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  // Calendar helpers
  function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
  }

  function isDateSelectable(dateStr: string) {
    const today = new Date().toISOString().split("T")[0];
    const maxDate = dates[dates.length - 1];
    return dateStr > today && dateStr <= maxDate;
  }

  function renderCalendar() {
    const { year, month } = calendarMonth;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const monthName = new Date(year, month).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    const cells: React.ReactNode[] = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} />);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const selectable = isDateSelectable(dateStr);
      const isSelected = dateStr === selectedDate;

      cells.push(
        <button
          key={day}
          type="button"
          disabled={!selectable}
          onClick={() => {
            setSelectedDate(dateStr);
            setStep("time");
          }}
          className={`h-9 w-9 rounded-lg text-sm font-medium transition-colors ${
            isSelected
              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
              : selectable
                ? "hover:bg-[var(--muted)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)]/40 cursor-not-allowed"
          }`}
        >
          {day}
        </button>
      );
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() =>
              setCalendarMonth((prev) => {
                const d = new Date(prev.year, prev.month - 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })
            }
            className="rounded-lg p-1.5 hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
          >
            &#9664;
          </button>
          <p className="text-sm font-semibold">{monthName}</p>
          <button
            type="button"
            onClick={() =>
              setCalendarMonth((prev) => {
                const d = new Date(prev.year, prev.month + 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })
            }
            className="rounded-lg p-1.5 hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
          >
            &#9654;
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div
              key={d}
              className="text-xs font-medium text-[var(--muted-foreground)] h-8 flex items-center justify-center"
            >
              {d}
            </div>
          ))}
          {cells.map((cell, i) => (
            <div key={i} className="flex items-center justify-center">
              {cell}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Group slots by hour for display
  function groupSlotsByHour(slots: TeeTimeSlot[]) {
    const groups: Record<string, TeeTimeSlot[]> = {};
    for (const slot of slots) {
      const hour = slot.start_time.split(":")[0];
      const label =
        parseInt(hour) < 12
          ? `${parseInt(hour)} AM`
          : parseInt(hour) === 12
            ? "12 PM"
            : `${parseInt(hour) - 12} PM`;
      if (!groups[label]) groups[label] = [];
      groups[label].push(slot);
    }
    return groups;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Book a Tee Time</h2>
          {step !== "course" && (
            <span className="text-xs text-[var(--muted-foreground)]">
              {step === "date" && selectedFacility
                ? `\u2014 ${selectedFacility.name}`
                : (step === "time" || step === "players") && selectedFacility
                  ? `\u2014 ${selectedFacility.name} \u2014 ${formatDateDisplay(selectedDate)}`
                  : ""}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 hover:bg-[var(--muted)] text-[var(--muted-foreground)] text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 px-5 pt-4 pb-1">
        {(["course", "date", "time", "players"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className={`h-1.5 w-8 rounded-full transition-colors ${
                (["course", "date", "time", "players"] as const).indexOf(step) >= i
                  ? "bg-[var(--primary)]"
                  : "bg-[var(--muted)]"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Step 1: Select Course */}
      {step === "course" && (
        <div className="p-5 space-y-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            Select a golf course
          </p>
          {loadingFacilities ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
            </div>
          ) : facilities.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] py-4">
              No golf courses available.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {facilities.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setSelectedFacility(f);
                    setStep("date");
                  }}
                  className="rounded-xl border border-[var(--border)] p-4 text-left transition-all hover:border-[var(--primary)] hover:shadow-sm"
                >
                  <p className="text-2xl mb-2">&#9971;</p>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {f.name}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    {f.description}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select Date */}
      {step === "date" && (
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setStep("course");
                setSelectedFacility(null);
                setSelectedDate("");
              }}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              &larr; Back
            </button>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Select a date (next 14 days)
          </p>
          <div className="max-w-xs">{renderCalendar()}</div>
        </div>
      )}

      {/* Step 3: Select Time */}
      {step === "time" && (
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setStep("date");
                setSelectedDate("");
                setSelectedTime(null);
                setSlots([]);
              }}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              &larr; Back
            </button>
          </div>

          {loadingSlots ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium mb-2">Available Tee Times</p>
                {slots.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    No tee times available for this date.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(groupSlotsByHour(slots)).map(
                      ([hour, hourSlots]) => (
                        <div key={hour}>
                          <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                            {hour}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {hourSlots.map((slot) => {
                              const isSelected =
                                selectedTime?.start_time === slot.start_time;
                              return (
                                <button
                                  key={slot.start_time}
                                  disabled={!slot.is_available}
                                  onClick={() => setSelectedTime(slot)}
                                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                                    isSelected
                                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] ring-2 ring-[var(--primary)]/20"
                                      : slot.is_available
                                        ? "border border-[var(--border)] hover:border-[var(--primary)] text-[var(--foreground)]"
                                        : "border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]/40 line-through cursor-not-allowed"
                                  }`}
                                >
                                  {formatTime(slot.start_time)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {selectedTime && (
                <div className="border-t border-[var(--border)] pt-4">
                  <button
                    onClick={() => setStep("players")}
                    className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
                  >
                    Next: Add Players &rarr;
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 4: Add Players + Confirm */}
      {step === "players" && selectedTime && (
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep("time")}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              &larr; Back
            </button>
          </div>

          {/* Booking summary */}
          <div className="rounded-lg bg-[var(--muted)] p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {selectedFacility?.name}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {formatDateDisplay(selectedDate)} at{" "}
                  {formatTime(selectedTime.start_time)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)]">
                <Users className="h-4 w-4" />
                {partySize}/4
              </div>
            </div>
          </div>

          {/* Your spot (booker) */}
          <div>
            <p className="text-sm font-medium mb-2">Your Group</p>
            <div className="space-y-2">
              {/* Booker (always first) */}
              <div className="flex items-center gap-3 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/5 px-3 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-bold">
                  You
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">You (Booking Member)</p>
                </div>
              </div>

              {/* Added players */}
              {players.map((player, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      player.type === "member"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {player.type === "member" ? (
                      <UserCircle className="h-4 w-4" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {player.type === "member"
                        ? `${player.member?.first_name} ${player.member?.last_name}`
                        : player.guestName}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {player.type === "member"
                        ? player.member?.tier_name ?? "Member"
                        : "Guest"}
                    </p>
                  </div>
                  <button
                    onClick={() => removePlayer(i)}
                    className="rounded p-1 text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add player controls */}
          {players.length < 3 && (
            <div className="space-y-3">
              {/* Member search */}
              <div ref={searchRef} className="relative">
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--ring)]">
                  <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onFocus={() => {
                      if (memberSearch.length >= 2) setShowSearch(true);
                    }}
                    placeholder="Search members to add..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
                  />
                  {searching && (
                    <div className="animate-spin h-4 w-4 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
                  )}
                </div>

                {/* Search results dropdown */}
                {showSearch && searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg max-h-48 overflow-auto">
                    {searchResults
                      .filter(
                        (m) =>
                          !players.some(
                            (p) =>
                              p.type === "member" && p.member?.id === m.id
                          )
                      )
                      .map((member) => (
                        <button
                          key={member.id}
                          onClick={() => addMemberPlayer(member)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--muted)] transition-colors"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                            {member.first_name[0]}
                            {member.last_name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)] truncate">
                              {member.tier_name ?? "Member"} &middot;{" "}
                              {member.email}
                            </p>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
                {showSearch &&
                  memberSearch.length >= 2 &&
                  !searching &&
                  searchResults.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg px-3 py-3 text-sm text-[var(--muted-foreground)] text-center">
                      No members found
                    </div>
                  )}
              </div>

              {/* Add guest */}
              {addingGuest ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={guestNameInput}
                    onChange={(e) => setGuestNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addGuestPlayer();
                    }}
                    placeholder="Guest name"
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    autoFocus
                  />
                  <button
                    onClick={addGuestPlayer}
                    disabled={!guestNameInput.trim()}
                    className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setAddingGuest(false);
                      setGuestNameInput("");
                    }}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingGuest(true)}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted-foreground)] hover:border-amber-400 hover:text-amber-600 transition-colors w-full"
                >
                  <UserPlus className="h-4 w-4" />
                  Add a Guest
                </button>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-sm font-medium mb-1.5">
              Notes{" "}
              <span className="font-normal text-[var(--muted-foreground)]">
                (optional)
              </span>
            </p>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Cart needed, celebrating a birthday"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          {/* Pricing Breakdown */}
          {pricing && pricing.players.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Estimated Fees
              </p>
              <div className="space-y-1.5">
                {pricing.players.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          p.player_type === "guest" ? "bg-amber-400" : "bg-blue-400"
                        }`}
                      />
                      <span className="truncate">
                        {p.display_name}
                      </span>
                      {p.tier_name && (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          ({p.tier_name})
                        </span>
                      )}
                    </div>
                    <span className="font-medium tabular-nums whitespace-nowrap ml-3">
                      {p.total_fee === 0 ? (
                        <span className="text-green-600">Included</span>
                      ) : (
                        `$${p.total_fee.toFixed(2)}`
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-[var(--border)] pt-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-sm font-bold tabular-nums">
                  {pricing.total === 0 ? (
                    <span className="text-green-600">All Included</span>
                  ) : (
                    `$${pricing.total.toFixed(2)}`
                  )}
                </span>
              </div>
              {pricing.players.some((p) => p.greens_fee === 0 && p.cart_fee === 0 && p.player_type === "member") && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Greens fees included with membership. Cart fees may apply.
                </p>
              )}
            </div>
          )}
          {loadingPricing && (
            <div className="flex items-center justify-center py-2">
              <div className="animate-spin h-4 w-4 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
              <span className="text-xs text-[var(--muted-foreground)] ml-2">
                Calculating fees...
              </span>
            </div>
          )}

          {/* Confirm */}
          <button
            onClick={handleBook}
            disabled={booking}
            className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {booking
              ? "Booking..."
              : pricing && pricing.total > 0
                ? `Confirm \u2014 $${pricing.total.toFixed(2)} \u00B7 ${partySize} ${partySize === 1 ? "player" : "players"}`
                : `Confirm \u2014 ${formatTime(selectedTime.start_time)} \u00B7 ${partySize} ${partySize === 1 ? "player" : "players"}`}
          </button>
        </div>
      )}
    </div>
  );
}
