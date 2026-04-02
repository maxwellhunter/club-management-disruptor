"use client";

import { useState, useEffect } from "react";
import { DollarSign, Plus, Trash2, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import type { GolfRateWithFacility, GolfDayType, GolfTimeType, GolfHoles } from "@club/shared";

interface Facility {
  id: string;
  name: string;
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

export default function GolfRatesAdmin() {
  const [rates, setRates] = useState<GolfRateWithFacility[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formFacilityId, setFormFacilityId] = useState("");
  const [formName, setFormName] = useState("");
  const [formHoles, setFormHoles] = useState<GolfHoles>("18");
  const [formDayType, setFormDayType] = useState<GolfDayType>("weekday");
  const [formTimeType, setFormTimeType] = useState<GolfTimeType>("prime");
  const [formMemberPrice, setFormMemberPrice] = useState("0");
  const [formGuestPrice, setFormGuestPrice] = useState("75");
  const [formCartFee, setFormCartFee] = useState("25");

  useEffect(() => {
    fetchRates();
  }, []);

  async function fetchRates() {
    try {
      const res = await fetch("/api/bookings/admin/golf-rates");
      if (res.ok) {
        const data = await res.json();
        setRates(data.rates ?? []);
        setFacilities(data.facilities ?? []);
        if (data.facilities?.length > 0 && !formFacilityId) {
          setFormFacilityId(data.facilities[0].id);
        }
      } else if (res.status === 403) {
        setError("You must be a club admin to manage golf rates.");
      }
    } catch {
      setError("Failed to load golf rates");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormName("");
    setFormHoles("18");
    setFormDayType("weekday");
    setFormTimeType("prime");
    setFormMemberPrice("0");
    setFormGuestPrice("75");
    setFormCartFee("25");
    setShowForm(false);
  }

  function autoGenerateName() {
    return `${DAY_TYPE_LABELS[formDayType]} ${TIME_TYPE_LABELS[formTimeType]} ${HOLES_LABELS[formHoles]}`;
  }

  async function handleCreate() {
    if (!formFacilityId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/bookings/admin/golf-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: formFacilityId,
          name: formName || autoGenerateName(),
          holes: formHoles,
          day_type: formDayType,
          time_type: formTimeType,
          member_price: parseFloat(formMemberPrice) || 0,
          guest_price: parseFloat(formGuestPrice) || 0,
          cart_fee: parseFloat(formCartFee) || 0,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess("Rate created");
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

  async function handleToggleActive(rate: GolfRateWithFacility) {
    try {
      const res = await fetch("/api/bookings/admin/golf-rates", {
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
    if (!confirm("Delete this rate?")) return;
    try {
      const res = await fetch(
        `/api/bookings/admin/golf-rates?id=${rateId}`,
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

  // Group rates by facility
  const ratesByFacility = rates.reduce(
    (acc, rate) => {
      const key = rate.facility_id;
      if (!acc[key]) acc[key] = { name: rate.facility_name, rates: [] };
      acc[key].rates.push(rate);
      return acc;
    },
    {} as Record<string, { name: string; rates: GolfRateWithFacility[] }>
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
        <DollarSign className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
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

      {/* Add Rate Form */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Golf Rate Card
          </h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Rate
          </button>
        </div>

        {showForm && (
          <div className="border border-[var(--border)] rounded-lg p-4 mb-4 space-y-4 bg-[var(--background)]">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Facility */}
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

              {/* Name */}
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
                  Rate Name
                  <span className="text-xs font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={autoGenerateName()}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
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

              {/* Day Type */}
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
                  Day Type
                </label>
                <select
                  value={formDayType}
                  onChange={(e) => setFormDayType(e.target.value as GolfDayType)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  <option value="weekday">Weekday (Mon–Fri)</option>
                  <option value="weekend">Weekend (Sat–Sun)</option>
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
                  <option value="afternoon">Afternoon (12pm–4pm)</option>
                  <option value="twilight">Twilight (after 4pm)</option>
                </select>
              </div>

              {/* Member Price */}
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
                  Member Greens Fee
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-[var(--muted-foreground)]">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={formMemberPrice}
                    onChange={(e) => setFormMemberPrice(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-7 pr-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Guest Price */}
              <div>
                <label className="text-sm font-medium text-[var(--muted-foreground)] mb-1 block">
                  Guest Greens Fee
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-[var(--muted-foreground)]">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={formGuestPrice}
                    onChange={(e) => setFormGuestPrice(e.target.value)}
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
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleCreate}
                disabled={saving}
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

        {/* Rate Cards Table */}
        {rates.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
            No golf rates configured yet. Click &ldquo;Add Rate&rdquo; to set up
            your pricing.
          </p>
        ) : (
          <div className="space-y-6">
            {Object.entries(ratesByFacility).map(
              ([facilityId, { name, rates: facilityRates }]) => (
                <div key={facilityId}>
                  <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                    {name}
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">
                            Rate
                          </th>
                          <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">
                            Holes
                          </th>
                          <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">
                            Day
                          </th>
                          <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">
                            Time
                          </th>
                          <th className="text-right py-2 pr-4 font-medium text-[var(--muted-foreground)]">
                            Member
                          </th>
                          <th className="text-right py-2 pr-4 font-medium text-[var(--muted-foreground)]">
                            Guest
                          </th>
                          <th className="text-right py-2 pr-4 font-medium text-[var(--muted-foreground)]">
                            Cart
                          </th>
                          <th className="text-center py-2 pr-4 font-medium text-[var(--muted-foreground)]">
                            Active
                          </th>
                          <th className="py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {facilityRates.map((rate) => (
                          <tr
                            key={rate.id}
                            className={`border-b border-[var(--border)] last:border-0 ${
                              !rate.is_active ? "opacity-50" : ""
                            }`}
                          >
                            <td className="py-2.5 pr-4 font-medium">
                              {rate.name}
                            </td>
                            <td className="py-2.5 pr-4">
                              {HOLES_LABELS[rate.holes]}
                            </td>
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
                            <td className="py-2.5 pr-4 text-right tabular-nums">
                              {rate.member_price === 0 ? (
                                <span className="text-green-600 font-medium">
                                  Included
                                </span>
                              ) : (
                                formatCurrency(rate.member_price)
                              )}
                            </td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">
                              {formatCurrency(rate.guest_price)}
                            </td>
                            <td className="py-2.5 pr-4 text-right tabular-nums">
                              {rate.cart_fee === 0 ? (
                                <span className="text-[var(--muted-foreground)]">
                                  —
                                </span>
                              ) : (
                                formatCurrency(rate.cart_fee)
                              )}
                            </td>
                            <td className="py-2.5 pr-4 text-center">
                              <button
                                onClick={() => handleToggleActive(rate)}
                                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                                title={
                                  rate.is_active ? "Deactivate" : "Activate"
                                }
                              >
                                {rate.is_active ? (
                                  <ToggleRight className="h-5 w-5 text-[var(--primary)]" />
                                ) : (
                                  <ToggleLeft className="h-5 w-5" />
                                )}
                              </button>
                            </td>
                            <td className="py-2.5">
                              <button
                                onClick={() => handleDelete(rate.id)}
                                className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Delete rate"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
