"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  DirectoryMember,
  MemberRole,
  MembershipTierLevel,
} from "@club/shared";
import { MemberDirectory } from "./member-directory";

export default function MembersPage() {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [tiers, setTiers] = useState<
    { id: string; name: string; level: MembershipTierLevel }[]
  >([]);
  const [role, setRole] = useState<MemberRole>("member");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (tierFilter) params.set("tier", tierFilter);
      const res = await fetch(`/api/members?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
        setTiers(data.tiers);
        if (data.role) setRole(data.role);
      }
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setLoading(false);
    }
  }, [search, tierFilter]);

  // Debounce search
  const [inputValue, setInputValue] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Member Directory</h1>
          <p className="text-[var(--muted-foreground)]">
            Browse your club&apos;s membership directory.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-44 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Member Directory</h1>
          <p className="text-[var(--muted-foreground)]">
            {members.length} active member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        {role === "admin" && (
          <button className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
            Add Member
          </button>
        )}
      </div>

      <MemberDirectory
        members={members}
        tiers={tiers}
        search={inputValue}
        onSearchChange={setInputValue}
        tierFilter={tierFilter}
        onTierFilterChange={setTierFilter}
      />
    </div>
  );
}
