"use client";

import { useRouter } from "next/navigation";
import { Search, Users, Mail, Phone } from "lucide-react";
import type { DirectoryMember, MembershipTierLevel } from "@club/shared";

const TIER_BADGE: Record<MembershipTierLevel, string> = {
  standard: "bg-gray-100 text-gray-700 border-gray-200",
  premium: "bg-blue-50 text-blue-700 border-blue-200",
  vip: "bg-purple-50 text-purple-700 border-purple-200",
  honorary: "bg-amber-50 text-amber-700 border-amber-200",
};

interface MemberDirectoryProps {
  members: DirectoryMember[];
  tiers: { id: string; name: string; level: MembershipTierLevel }[];
  search: string;
  onSearchChange: (value: string) => void;
  tierFilter: string | null;
  onTierFilterChange: (value: string | null) => void;
}

export function MemberDirectory({
  members,
  tiers,
  search,
  onSearchChange,
  tierFilter,
  onTierFilterChange,
}: MemberDirectoryProps) {
  const router = useRouter();

  return (
    <>
      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <input
            type="search"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => onTierFilterChange(null)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              !tierFilter
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
            }`}
          >
            All
          </button>
          {tiers.map((t) => (
            <button
              key={t.id}
              onClick={() => onTierFilterChange(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tierFilter === t.id
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Member grid or empty state */}
      {members.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-12 text-center">
          <Users className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
          <p className="font-semibold text-lg">No members found</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Try adjusting your search or filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onClick={() => router.push(`/dashboard/members/${member.id}`)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function MemberCard({ member, onClick }: { member: DirectoryMember; onClick: () => void }) {
  const initials =
    `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();
  const badgeClass = member.tier_level ? TIER_BADGE[member.tier_level] : null;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      className="rounded-xl border border-[var(--border)] p-4 hover:border-[var(--primary)] hover:shadow-sm transition-all cursor-pointer">
      <div className="flex items-start gap-3">
        {member.avatar_url ? (
          <img
            src={member.avatar_url}
            alt={`${member.first_name} ${member.last_name}`}
            className="h-12 w-12 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center text-sm font-semibold shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate">
              {member.first_name} {member.last_name}
            </p>
            {badgeClass && (
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass}`}
              >
                {member.tier_name}
              </span>
            )}
          </div>
          {member.member_number && (
            <p className="text-xs text-[var(--muted-foreground)]">
              #{member.member_number}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-[var(--muted-foreground)]">
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <a
            href={`mailto:${member.email}`}
            className="truncate hover:text-[var(--primary)]"
          >
            {member.email}
          </a>
        </div>
        {member.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <a
              href={`tel:${member.phone}`}
              className="hover:text-[var(--primary)]"
            >
              {member.phone}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
