"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Trash2,
  Loader2,
  ToggleLeft,
  ToggleRight,
  UserCircle,
  UserPlus,
  Pencil,
  X,
  Check,
} from "lucide-react";
import type {
  GolfPlayerRateWithDetails,
  GolfDayType,
  GolfTimeType,
  GolfHoles,
} from "@club/shared";

interface Facility {
  id: string;
  name: string;
}

interface Tier {
  id: string;
  name: string;
  level: string;
}

const DAY_TYPE_LABELS: Record<GolfDayType, string> = {
  weekday: "Weekday",
  weekend: "Weekend",
};

const TIME_TYPE_LABELS: Record<GolfTimeType, string> = {
  prime: "Prime",
  afternoon: "Afternoon",
  twilight: "Twilight",
};

const HOLES_LABELS: Record<GolfHoles, string> = {
  "9": "9 Holes",
  "18": "18 Holes",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function PlayerRatesAdmin() {
  const [rates, setRates] = useState<GolfPlayerRateWithDetails[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formFacilityId, setFormFacilityId] = useState("");
  const [formName, setFormName] = useState("");
  const [formIsGuest, setFormIsGuest] = useState(false);
  const [formTierId, setFormTierId] = useState<string>("");
  const [formDayType, setFormDayType] = useState<GolfDayType>("weekday");
  const [formTimeType, setFormTimeType] = useState<GolfTimeType>("prime");
  const [formHoles, setFormHoles] = useState<GolfHoles>("18");
  const [formGreensFee, setFormGreensFee] = useState("0");
  const [formCartFee, setFormCartFee] = useState("0");
  const [formCaddieFee, setFormCaddieFee] = useState("0");

  // Inline edit state
  const [editGreensFee, setEditGreensFee] = useState("");
  const [editCartFee, setEditCartFee] = useState("");
  const [editCaddieFee, setEditCaddieFee] = useState("");

  useEffect(() => {
    fetchRates();
  }, []);

  async function fetchRates() {
    try {
      const res = await fetch("/api/bookings/admin/player-rates");
      if (res.ok) {
        const data = await res.json();
        setRates(data.rates ?? []);
        setFacilities(data.facilities ?? []);
        setTiers(data.tiers ?? []);
        if (data.facilities?.length > 0 && !formFacilityId) {
          setFormFacilityId(data.facilities[0].id);
        }
      } else if (res.status === 403) {
        setError("You must be a club admin to manage player rates.");
      }
    } catch {
      setError("Failed to load player rates");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormName("");
    setFormIsGuest(false);
    setFormTierId("");
    setFormDayType("weekday");
    setFormTimeType("prime");
    setFormHoles("18");
    setFormGreensFee("0");
    setFormCartFee("0");
    setFormCaddieFee("0");
    setShowForm(false);
  }

  function autoName(): string {
    if (formIsGuest) {
      return `Guest \u2014 ${DAY_TYPE_LABELS[formDayType]} ${TIME_TYPE_LABELS[formTimeType]} ${formHoles}`;
    }
    const tier = tiers.find((t) => t.id === formTierId);
    return `${tier?.name ?? "Member"} \u2014 ${DAY_TYPE_LABELS[formDayType]} ${TIME_TYPE_LABELS[formTimeType]} ${formHoles}`;
  }

  async function handleCreate() {
    if (!formFacilityId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/bookings/admin/player-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: formFacilityId,
          name: formName || autoName(),
          is_guest: formIsGuest,
          tier_id: formIsGuest ? null : formTierId || null,
          day_type: formDayType,
          time_type: formTimeType,
          holes: formHoles,
          greens_fee: parseFloat(formGreensFee) || 0,
          cart_fee: parseFloat(formCartFee) || 0,
          caddie_fee: parseFloat(formCaddieFee) || 0,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess("Player rate created");
        resetForm();
        fetchRates();
      } else {
        setError(data.error || "Failed to create rate");
      }
    } catch {
      setError("Failed to create rate");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(rate: GolfPlayerRateWithDetails) {
    setEditingId(rate.id);
    setEditGreensFee(String(rate.greens_fee));
    setEditCartFee(String(rate.cart_fee));
    setEditCaddieFee(String(rate.caddie_fee));
  }

  async function saveEdit(rateId: string) {
    try {
      const res = await fetch("/api/bookings/admin/player-rates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rateId,
          greens_fee: parseFloat(editGreensFee) || 0,
          cart_fee: parseFloat(editCartFee) || 0,
          caddie_fee: parseFloat(editCaddieFee) || 0,
        }),
      });

      if (res.ok) {
        setRates((prev) =>
          prev.map((r) =>
            r.id === rateId
              ? {
                  ...r,
                  greens_fee: parseFloat(editGreensFee) || 0,
                  cart_fee: parseFloat(editCartFee) || 0,
                  caddie_fee: parseFloat(editCaddieFee) || 0,
                }
              : r
          )
        );
        setEditingId(null);
        setSuccess("Rate updated");
      }
    } catch {
      setError("Failed to update rate");
    }
  }

  async function handleToggleActive(rate: GolfPlayerRateWithDetails) {
    try {
      const res = await fetch("/api/bookings/admin/player-rates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rate.id, is_active: !rate.is_active }),
      });

      if (res.ok) {
        setRates((prev) =>
          prev.map((r) =>
            r.id === rate.id ? { ...r, is_active: !r.is_active } : r
          )
        );
      }
    } catch {
      setError("Failed to update rate");
    }
  }

  async function handleDelete(rateId: string) {
    if (!confirm("Delete this player rate?")) return;
    try {
      const res = await fetch(
        `/api/bookings/admin/player-rates?id=${rateId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setRates((prev) => prev.filter((r) => r.id !== rateId));
        setSuccess("Rate deleted");
      }
    } catch {
      setError("Failed to delete rate");
    }
  }

  // Group: facility -> member rates / guest rates
  type RateGroup = {
    facilityName: string;
    memberRates: GolfPlayerRateWithDetails[];
    guestRates: GolfPlayerRateWithDetails[];
  };

  const grouped = rates.reduce(
    (acc, rate) => {
      const key = rate.facility_id;
      if (!acc[key]) {
        acc[key] = {
          facilityName: rate.facility_name,
          memberRates: [],
          guestRates: [],
        };
      }
      if (rate.is_guest) {
        acc[key].guestRates.push(rate);
      } else {
        acc[key].memberRates.push(rate);
      }
      return acc;
    },
    {} as Record<string, RateGroup>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (facilities.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
        <p className="text-[var(--muted-foreground)]">
          No golf facilities found. Add a golf facility first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            &times;
          </button>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
          <button
            onClick={() => setSuccess(null)}
            className="ml-2 text-green-500 hover:text-green-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* Header + Add Button */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              Per-Player Rate Card
            </h3>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Set greens fees by membership tier. Each tier + guest can have
              different pricing per course, day, time, and holes.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Rate
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="border border-[var(--border)] rounded-lg p-4 mb-5 space-y-4 bg-[var(--background)]">
            {/* Player type toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setFormIsGuest(false)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
                  !formIsGuest
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                <UserCircle className="h-4 w-4" />
                Member Tier Rate
              </button>
              <button
                onClick={() => setFormIsGuest(true)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
                  formIsGuest
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                <UserPlus className="h-4 w-4" />
                Guest Rate
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Course */}
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
                  Course
                </label>
                <select
                  value={formFacilityId}
                  onChange={(e) => setFormFacilityId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tier (only for member rates) */}
              {!formIsGuest && (
                <div>
                  <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
                    Membership Tier
                  </label>
                  <select
                    value={formTierId}
                    onChange={(e) => setFormTierId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  >
                    <option value="">Select tier...</option>
                    {tiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.level})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Rate Name */}
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
                  Rate Name{" "}
                  <span className="text-xs font-normal">(auto-generated)</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={autoName()}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
              </div>

              {/* Day Type */}
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
                  Day Type
                </label>
                <select
                  value={formDayType}
                  onChange={(e) =>
                    setFormDayType(e.target.value as GolfDayType)
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  <option value="weekday">Weekday (Mon-Fri)</option>
                  <option value="weekend">Weekend (Sat-Sun)</option>
                </select>
              </div>

              {/* Time Type */}
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
                  Time of Day
                </label>
                <select
                  value={formTimeType}
                  onChange={(e) =>
                    setFormTimeType(e.target.value as GolfTimeType)
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  <option value="prime">Prime (before 12pm)</option>
                  <option value="afternoon">Afternoon (12pm-4pm)</option>
                  <option value="twilight">Twilight (after 4pm)</option>
                </select>
              </div>

              {/* Holes */}
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
                  Holes
                </label>
                <select
                  value={formHoles}
                  onChange={(e) => setFormHoles(e.target.value as GolfHoles)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  <option value="18">18 Holes</option>
                  <option value="9">9 Holes</option>
                </select>
              </div>

              {/* Greens Fee */}
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
                  Greens Fee
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-[var(--muted-foreground)]">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={formGreensFee}
                    onChange={(e) => setFormGreensFee(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-7 pr-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Cart Fee */}
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
                  Cart Fee (per rider)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-[var(--muted-foreground)]">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={formCartFee}
                    onChange={(e) => setFormCartFee(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-7 pr-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Caddie Fee */}
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
                  Caddie Fee (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-[var(--muted-foreground)]">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={formCaddieFee}
                    onChange={(e) => setFormCaddieFee(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-7 pr-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={saving || (!formIsGuest && !formTierId)}
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </span>
                ) : (
                  "Save Rate"
                )}
              </button>
              <button
                onClick={resetForm}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Rate Tables */}
        {rates.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
            No player rates configured yet. Click &ldquo;Add Rate&rdquo; to set
            up per-tier pricing.
          </p>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(
              ([facilityId, { facilityName, memberRates, guestRates }]) => (
                <div key={facilityId}>
                  <h4 className="text-sm font-semibold text-[var(--foreground)] mb-4">
                    {facilityName}
                  </h4>

                  {/* Member Rates */}
                  {memberRates.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCircle className="h-4 w-4 text-[var(--primary)]" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Member Rates by Tier
                        </span>
                      </div>
                      <RateTable
                        rates={memberRates}
                        editingId={editingId}
                        editGreensFee={editGreensFee}
                        editCartFee={editCartFee}
                        editCaddieFee={editCaddieFee}
                        setEditGreensFee={setEditGreensFee}
                        setEditCartFee={setEditCartFee}
                        setEditCaddieFee={setEditCaddieFee}
                        onStartEdit={startEdit}
                        onSaveEdit={saveEdit}
                        onCancelEdit={() => setEditingId(null)}
                        onToggleActive={handleToggleActive}
                        onDelete={handleDelete}
                        showTier
                      />
                    </div>
                  )}

                  {/* Guest Rates */}
                  {guestRates.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <UserPlus className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                          Guest Rates
                        </span>
                      </div>
                      <RateTable
                        rates={guestRates}
                        editingId={editingId}
                        editGreensFee={editGreensFee}
                        editCartFee={editCartFee}
                        editCaddieFee={editCaddieFee}
                        setEditGreensFee={setEditGreensFee}
                        setEditCartFee={setEditCartFee}
                        setEditCaddieFee={setEditCaddieFee}
                        onStartEdit={startEdit}
                        onSaveEdit={saveEdit}
                        onCancelEdit={() => setEditingId(null)}
                        onToggleActive={handleToggleActive}
                        onDelete={handleDelete}
                        showTier={false}
                      />
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Extracted table component for member and guest rate sections
function RateTable({
  rates,
  editingId,
  editGreensFee,
  editCartFee,
  editCaddieFee,
  setEditGreensFee,
  setEditCartFee,
  setEditCaddieFee,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleActive,
  onDelete,
  showTier,
}: {
  rates: GolfPlayerRateWithDetails[];
  editingId: string | null;
  editGreensFee: string;
  editCartFee: string;
  editCaddieFee: string;
  setEditGreensFee: (v: string) => void;
  setEditCartFee: (v: string) => void;
  setEditCaddieFee: (v: string) => void;
  onStartEdit: (rate: GolfPlayerRateWithDetails) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onToggleActive: (rate: GolfPlayerRateWithDetails) => void;
  onDelete: (id: string) => void;
  showTier: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {showTier && (
              <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">
                Tier
              </th>
            )}
            <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">
              Day
            </th>
            <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">
              Time
            </th>
            <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">
              Holes
            </th>
            <th className="text-right py-2 pr-4 font-medium text-[var(--muted-foreground)]">
              Greens Fee
            </th>
            <th className="text-right py-2 pr-4 font-medium text-[var(--muted-foreground)]">
              Cart Fee
            </th>
            <th className="text-right py-2 pr-4 font-medium text-[var(--muted-foreground)]">
              Caddie
            </th>
            <th className="text-center py-2 pr-4 font-medium text-[var(--muted-foreground)]">
              Active
            </th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => {
            const isEditing = editingId === rate.id;
            return (
              <tr
                key={rate.id}
                className={`border-b border-[var(--border)] last:border-0 ${
                  !rate.is_active ? "opacity-50" : ""
                }`}
              >
                {showTier && (
                  <td className="py-2.5 pr-4 font-medium">
                    {rate.tier_name ?? "—"}
                  </td>
                )}
                <td className="py-2.5 pr-4">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      rate.day_type === "weekend"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {DAY_TYPE_LABELS[rate.day_type]}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      rate.time_type === "prime"
                        ? "bg-amber-100 text-amber-700"
                        : rate.time_type === "twilight"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-green-100 text-green-700"
                    }`}
                  >
                    {TIME_TYPE_LABELS[rate.time_type]}
                  </span>
                </td>
                <td className="py-2.5 pr-4">{HOLES_LABELS[rate.holes]}</td>

                {/* Greens Fee */}
                <td className="py-2.5 pr-4 text-right tabular-nums">
                  {isEditing ? (
                    <div className="relative inline-block w-24">
                      <span className="absolute left-2 top-1.5 text-xs text-[var(--muted-foreground)]">
                        $
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={5}
                        value={editGreensFee}
                        onChange={(e) => setEditGreensFee(e.target.value)}
                        className="w-full rounded border border-[var(--border)] bg-[var(--background)] pl-5 pr-2 py-1 text-sm text-right"
                      />
                    </div>
                  ) : rate.greens_fee === 0 ? (
                    <span className="text-green-600 font-medium">Included</span>
                  ) : (
                    formatCurrency(rate.greens_fee)
                  )}
                </td>

                {/* Cart Fee */}
                <td className="py-2.5 pr-4 text-right tabular-nums">
                  {isEditing ? (
                    <div className="relative inline-block w-24">
                      <span className="absolute left-2 top-1.5 text-xs text-[var(--muted-foreground)]">
                        $
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={5}
                        value={editCartFee}
                        onChange={(e) => setEditCartFee(e.target.value)}
                        className="w-full rounded border border-[var(--border)] bg-[var(--background)] pl-5 pr-2 py-1 text-sm text-right"
                      />
                    </div>
                  ) : rate.cart_fee === 0 ? (
                    <span className="text-[var(--muted-foreground)]">
                      &mdash;
                    </span>
                  ) : (
                    formatCurrency(rate.cart_fee)
                  )}
                </td>

                {/* Caddie Fee */}
                <td className="py-2.5 pr-4 text-right tabular-nums">
                  {isEditing ? (
                    <div className="relative inline-block w-24">
                      <span className="absolute left-2 top-1.5 text-xs text-[var(--muted-foreground)]">
                        $
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={5}
                        value={editCaddieFee}
                        onChange={(e) => setEditCaddieFee(e.target.value)}
                        className="w-full rounded border border-[var(--border)] bg-[var(--background)] pl-5 pr-2 py-1 text-sm text-right"
                      />
                    </div>
                  ) : rate.caddie_fee === 0 ? (
                    <span className="text-[var(--muted-foreground)]">
                      &mdash;
                    </span>
                  ) : (
                    formatCurrency(rate.caddie_fee)
                  )}
                </td>

                {/* Active toggle */}
                <td className="py-2.5 pr-4 text-center">
                  <button
                    onClick={() => onToggleActive(rate)}
                    className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    title={rate.is_active ? "Deactivate" : "Activate"}
                  >
                    {rate.is_active ? (
                      <ToggleRight className="h-5 w-5 text-[var(--primary)]" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                </td>

                {/* Actions */}
                <td className="py-2.5">
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => onSaveEdit(rate.id)}
                          className="rounded p-1.5 text-green-600 hover:bg-green-50 transition-colors"
                          title="Save"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={onCancelEdit}
                          className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onStartEdit(rate)}
                          className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                          title="Edit fees"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(rate.id)}
                          className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete rate"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
