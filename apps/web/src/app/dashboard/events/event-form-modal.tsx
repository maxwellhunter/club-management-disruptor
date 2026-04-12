"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { ClubEvent, EventStatus } from "@club/shared";
import { ImageUpload } from "@/components/image-upload";

interface EventFormModalProps {
  event?: ClubEvent;
  onClose: () => void;
  onSaved: () => void;
}

function toLocalDateTimeValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  // Format as YYYY-MM-DDTHH:MM for datetime-local input
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventFormModal({
  event,
  onClose,
  onSaved,
}: EventFormModalProps) {
  const isEditing = !!event;

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [startDate, setStartDate] = useState(
    toLocalDateTimeValue(event?.start_date)
  );
  const [endDate, setEndDate] = useState(
    toLocalDateTimeValue(event?.end_date)
  );
  const [capacity, setCapacity] = useState(
    event?.capacity?.toString() ?? ""
  );
  const [price, setPrice] = useState(event?.price?.toString() ?? "");
  const [status, setStatus] = useState<EventStatus>(
    event?.status ?? "draft"
  );
  const [imageUrl, setImageUrl] = useState(event?.image_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        title,
        start_date: new Date(startDate).toISOString(),
      };

      if (description) body.description = description;
      if (location) body.location = location;
      if (endDate) body.end_date = new Date(endDate).toISOString();
      if (capacity) body.capacity = parseInt(capacity, 10);
      if (price) body.price = parseFloat(price);
      if (imageUrl) body.image_url = imageUrl;
      else if (isEditing && !imageUrl && event?.image_url) body.image_url = "";
      if (isEditing) body.status = status;

      const url = isEditing
        ? `/api/events/admin/${event.id}`
        : "/api/events/admin";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSaved();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save event");
      }
    } catch {
      setError("Failed to save event");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--background)] rounded-xl border border-[var(--border)] shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Edit Event" : "Create Event"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-[var(--muted)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              placeholder="e.g. Spring Gala Dinner"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent resize-none"
              placeholder="Describe the event..."
            />
          </div>

          {/* Event Image */}
          <ImageUpload
            value={imageUrl}
            onChange={setImageUrl}
            bucket="event-images"
            label="Cover Image"
          />

          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              placeholder="e.g. Main Ballroom"
            />
          </div>

          {/* Start & End Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                End Date & Time
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              />
            </div>
          </div>

          {/* Capacity & Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Capacity
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                min={1}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                placeholder="Unlimited"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Price ($)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                step="0.01"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                placeholder="Free"
              />
            </div>
          </div>

          {/* Status (edit mode only) */}
          {isEditing && (
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EventStatus)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title || !startDate}
              className="rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
