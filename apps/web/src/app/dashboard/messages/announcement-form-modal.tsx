"use client";

import { useState } from "react";
import { X, Megaphone } from "lucide-react";
import type { Announcement, AnnouncementPriority } from "@club/shared";

interface Tier {
  id: string;
  name: string;
  level: string;
}

interface AnnouncementFormModalProps {
  onClose: () => void;
  onSuccess: () => void;
  tiers: Tier[];
  /** Pass an existing announcement to edit; omit for create */
  existing?: Announcement;
}

const PRIORITY_OPTIONS: { value: AnnouncementPriority; label: string; description: string }[] = [
  { value: "low", label: "Low", description: "Informational, non-urgent" },
  { value: "normal", label: "Normal", description: "Standard announcement" },
  { value: "high", label: "High", description: "Important, time-sensitive" },
  { value: "urgent", label: "Urgent", description: "Critical, immediate attention" },
];

export function AnnouncementFormModal({
  onClose,
  onSuccess,
  tiers,
  existing,
}: AnnouncementFormModalProps) {
  const isEdit = !!existing;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [priority, setPriority] = useState<AnnouncementPriority>(
    existing?.priority ?? "normal"
  );
  const [targetTierIds, setTargetTierIds] = useState<string[]>(
    existing?.target_tier_ids ?? []
  );
  const [targetAll, setTargetAll] = useState(
    !existing?.target_tier_ids || existing.target_tier_ids.length === 0
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTier(tierId: string) {
    setTargetTierIds((prev) =>
      prev.includes(tierId)
        ? prev.filter((id) => id !== tierId)
        : [...prev, tierId]
    );
  }

  async function handleSubmit(e: React.FormEvent, publish: boolean) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      title,
      content,
      priority,
      target_tier_ids: targetAll ? [] : targetTierIds,
      publish,
    };

    try {
      const url = isEdit
        ? `/api/announcements/${existing!.id}`
        : "/api/announcements";
      const method = isEdit ? "PATCH" : "POST";

      // For edit + publish, add the action
      const body = isEdit && publish
        ? { ...payload, action: "publish" }
        : payload;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save announcement");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold">
              {isEdit ? "Edit Announcement" : "New Announcement"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-[var(--muted)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="ann-title" className="text-sm font-medium">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="ann-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Course maintenance update"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <label htmlFor="ann-content" className="text-sm font-medium">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="ann-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={5}
              placeholder="Write your announcement here..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)] resize-y"
            />
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Priority</label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all text-center ${
                    priority === opt.value
                      ? opt.value === "urgent"
                        ? "border-red-300 bg-red-50 text-red-700"
                        : opt.value === "high"
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : opt.value === "low"
                            ? "border-gray-300 bg-gray-50 text-gray-600"
                            : "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Audience */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Audience</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  checked={targetAll}
                  onChange={() => {
                    setTargetAll(true);
                    setTargetTierIds([]);
                  }}
                  className="accent-[var(--primary)]"
                />
                All members
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="target"
                  checked={!targetAll}
                  onChange={() => setTargetAll(false)}
                  className="accent-[var(--primary)]"
                />
                Specific tiers only
              </label>

              {!targetAll && (
                <div className="flex flex-wrap gap-2 pl-6 pt-1">
                  {tiers.map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => toggleTier(tier.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        targetTierIds.includes(tier.id)
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                      }`}
                    >
                      {tier.name}
                    </button>
                  ))}
                  {tiers.length === 0 && (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      No membership tiers found.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title || !content}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save as Draft"}
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={submitting || !title || !content}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Publishing..." : isEdit && existing?.published_at ? "Update" : "Publish Now"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
