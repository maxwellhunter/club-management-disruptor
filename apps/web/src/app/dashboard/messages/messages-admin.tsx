"use client";

import { useState } from "react";
import {
  Megaphone,
  Send,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  MoreHorizontal,
} from "lucide-react";
import type { Announcement, AnnouncementPriority } from "@club/shared";
import { AnnouncementFormModal } from "./announcement-form-modal";

interface Tier {
  id: string;
  name: string;
  level: string;
}

interface MessagesAdminProps {
  announcements: Announcement[];
  tiers: Tier[];
  onRefresh: () => void;
}

type FilterTab = "all" | "published" | "drafts";

const PRIORITY_STYLES: Record<AnnouncementPriority, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-amber-100 text-amber-700",
  normal: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
};

export function MessagesAdmin({
  announcements,
  tiers,
  onRefresh,
}: MessagesAdminProps) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = announcements.filter((a) => {
    if (filter === "published") return !!a.published_at;
    if (filter === "drafts") return !a.published_at;
    return true;
  });

  const publishedCount = announcements.filter((a) => a.published_at).length;
  const draftCount = announcements.filter((a) => !a.published_at).length;

  async function handlePublish(id: string) {
    setOpenMenuId(null);
    setActionLoading(id);
    try {
      await fetch(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      onRefresh();
    } catch {
      alert("Failed to publish announcement");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnpublish(id: string) {
    setOpenMenuId(null);
    setActionLoading(id);
    try {
      await fetch(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unpublish" }),
      });
      onRefresh();
    } catch {
      alert("Failed to unpublish announcement");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string) {
    setOpenMenuId(null);
    if (!confirm("Delete this announcement? This cannot be undone.")) return;
    setActionLoading(id);
    try {
      await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      onRefresh();
    } catch {
      alert("Failed to delete announcement");
    } finally {
      setActionLoading(null);
    }
  }

  function handleEdit(announcement: Announcement) {
    setOpenMenuId(null);
    setEditingAnnouncement(announcement);
    setShowForm(true);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getTierNames(tierIds: string[] | null) {
    if (!tierIds || tierIds.length === 0) return "All members";
    return tierIds
      .map((id) => tiers.find((t) => t.id === id)?.name ?? "Unknown")
      .join(", ");
  }

  return (
    <>
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 border-b border-[var(--border)]">
          {(
            [
              { key: "all", label: `All (${announcements.length})` },
              { key: "published", label: `Published (${publishedCount})` },
              { key: "drafts", label: `Drafts (${draftCount})` },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                filter === t.key
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setEditingAnnouncement(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
        >
          <Megaphone className="h-4 w-4" />
          New Announcement
        </button>
      </div>

      {/* Announcement list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center">
          <Megaphone className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
          <p className="font-medium text-[var(--foreground)]">
            {filter === "drafts"
              ? "No draft announcements"
              : filter === "published"
                ? "No published announcements"
                : "No announcements yet"}
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Create your first announcement to communicate with club members.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((announcement) => {
            const isPublished = !!announcement.published_at;
            const isProcessing = actionLoading === announcement.id;

            return (
              <div
                key={announcement.id}
                className="rounded-xl border border-[var(--border)] p-5 transition-colors hover:bg-[var(--muted)]/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-[var(--foreground)]">
                        {announcement.title}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          PRIORITY_STYLES[announcement.priority]
                        }`}
                      >
                        {announcement.priority}
                      </span>
                      {isPublished ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">
                          <Eye className="h-3 w-3" />
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-medium">
                          <EyeOff className="h-3 w-3" />
                          Draft
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-[var(--muted-foreground)] mt-1.5 line-clamp-2">
                      {announcement.content}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-xs text-[var(--muted-foreground)]">
                      <span>
                        {isPublished
                          ? `Published ${formatDate(announcement.published_at!)}`
                          : `Created ${formatDate(announcement.created_at)}`}
                      </span>
                      <span>&middot;</span>
                      <span>
                        {getTierNames(announcement.target_tier_ids)}
                      </span>
                    </div>
                  </div>

                  {/* Actions menu */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() =>
                        setOpenMenuId(
                          openMenuId === announcement.id
                            ? null
                            : announcement.id
                        )
                      }
                      disabled={isProcessing}
                      className="rounded-lg p-1.5 hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <div className="h-4 w-4 border-2 border-[var(--muted-foreground)] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-4 w-4" />
                      )}
                    </button>

                    {openMenuId === announcement.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg py-1">
                          {!isPublished && (
                            <button
                              onClick={() => handlePublish(announcement.id)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors text-left"
                            >
                              <Send className="h-3.5 w-3.5" />
                              Publish
                            </button>
                          )}
                          {isPublished && (
                            <button
                              onClick={() => handleUnpublish(announcement.id)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors text-left"
                            >
                              <EyeOff className="h-3.5 w-3.5" />
                              Unpublish
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(announcement)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--muted)] transition-colors text-left"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(announcement.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <AnnouncementFormModal
          onClose={() => {
            setShowForm(false);
            setEditingAnnouncement(null);
          }}
          onSuccess={onRefresh}
          tiers={tiers}
          existing={editingAnnouncement ?? undefined}
        />
      )}
    </>
  );
}
