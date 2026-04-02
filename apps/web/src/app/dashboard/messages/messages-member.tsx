"use client";

import { AlertTriangle, Bell, Info, Megaphone } from "lucide-react";
import type { Announcement, AnnouncementPriority } from "@club/shared";

interface MessagesMemberProps {
  announcements: Announcement[];
}

const PRIORITY_ICONS: Record<AnnouncementPriority, React.ReactNode> = {
  urgent: <AlertTriangle className="h-5 w-5 text-red-500" />,
  high: <Bell className="h-5 w-5 text-amber-500" />,
  normal: <Megaphone className="h-5 w-5 text-blue-500" />,
  low: <Info className="h-5 w-5 text-gray-400" />,
};

const PRIORITY_BORDER: Record<AnnouncementPriority, string> = {
  urgent: "border-l-red-500",
  high: "border-l-amber-400",
  normal: "border-l-blue-400",
  low: "border-l-gray-300",
};

export function MessagesMember({ announcements }: MessagesMemberProps) {
  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function timeAgo(dateStr: string) {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr);
  }

  if (announcements.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-8 text-center">
        <Megaphone className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
        <p className="font-medium text-[var(--foreground)]">No announcements</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Club announcements will appear here when posted by your club admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {announcements.map((announcement) => (
        <div
          key={announcement.id}
          className={`rounded-xl border border-[var(--border)] border-l-4 ${
            PRIORITY_BORDER[announcement.priority]
          } p-5 transition-colors hover:bg-[var(--muted)]/30`}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {PRIORITY_ICONS[announcement.priority]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[var(--foreground)]">
                  {announcement.title}
                </h3>
                {announcement.priority === "urgent" && (
                  <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
                    URGENT
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--foreground)] mt-1.5 whitespace-pre-wrap leading-relaxed">
                {announcement.content}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-3">
                {timeAgo(announcement.published_at ?? announcement.created_at)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
