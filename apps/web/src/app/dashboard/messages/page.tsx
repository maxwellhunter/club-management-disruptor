"use client";

import { useState, useEffect, useCallback } from "react";
import type { Announcement, MemberRole } from "@club/shared";
import { MessagesAdmin } from "./messages-admin";
import { MessagesMember } from "./messages-member";

interface Tier {
  id: string;
  name: string;
  level: string;
}

export default function MessagesPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [role, setRole] = useState<MemberRole>("member");
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements ?? []);
        if (data.role) setRole(data.role);
        if (data.tiers) setTiers(data.tiers);
      }
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const isAdmin = role === "admin";

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-[var(--muted-foreground)]">
            Announcements and member communications.
          </p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-[var(--muted-foreground)]">
          {isAdmin
            ? "Create and manage announcements for club members."
            : "Announcements and updates from your club."}
        </p>
      </div>

      {isAdmin ? (
        <MessagesAdmin
          announcements={announcements}
          tiers={tiers}
          onRefresh={fetchAnnouncements}
        />
      ) : (
        <MessagesMember announcements={announcements} />
      )}
    </div>
  );
}
