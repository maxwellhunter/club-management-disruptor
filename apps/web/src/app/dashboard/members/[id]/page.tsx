"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  Edit2,
  UserX,
  UserCheck,
  Send,
  Copy,
  Check,
  Shield,
  Calendar,
  Hash,
  Clock,
  StickyNote,
} from "lucide-react";
import type { MemberRole, MembershipTierLevel } from "@club/shared";
import { EditMemberModal } from "./edit-member-modal";

interface MemberDetail {
  id: string;
  club_id: string;
  member_number: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: MemberRole;
  status: string;
  join_date: string;
  notes: string | null;
  user_id: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  invite_sent_at: string | null;
  invite_accepted_at: string | null;
  membership_tier_id: string | null;
  family_id: string | null;
  created_at: string;
  updated_at: string;
  tier: { id: string; name: string; level: MembershipTierLevel } | null;
  family: { id: string; name: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  invited: "bg-blue-50 text-blue-700 border-blue-200",
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  suspended: "bg-red-50 text-red-700 border-red-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  staff: "Staff",
  member: "Member",
};

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [callerRole, setCallerRole] = useState<MemberRole>("member");
  const [tiers, setTiers] = useState<
    { id: string; name: string; level: MembershipTierLevel }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchMember = useCallback(async () => {
    try {
      const [memberRes, tiersRes] = await Promise.all([
        fetch(`/api/members/${memberId}`),
        fetch("/api/members?status=active"),
      ]);

      if (!memberRes.ok) {
        const data = await memberRes.json();
        setError(data.error || "Member not found");
        return;
      }

      const memberData = await memberRes.json();
      setMember(memberData.member);
      setCallerRole(memberData.role);

      if (tiersRes.ok) {
        const tiersData = await tiersRes.json();
        setTiers(tiersData.tiers || []);
      }
    } catch {
      setError("Failed to load member");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  async function handleStatusChange(newStatus: string) {
    if (!member) return;
    setActionLoading("status");

    try {
      const res = await fetch(`/api/members/${member.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        await fetchMember();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update status");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResendInvite() {
    if (!member) return;
    setActionLoading("resend");

    try {
      const res = await fetch(`/api/members/${member.id}/resend-invite`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        setInviteUrl(data.invite_url);
        await fetchMember();
      } else {
        alert(data.error || "Failed to resend invite");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeactivate() {
    if (!member) return;
    if (!confirm(`Deactivate ${member.first_name} ${member.last_name}? They will lose access to the app.`)) {
      return;
    }

    setActionLoading("deactivate");
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push("/dashboard/members");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to deactivate member");
      }
    } catch {
      alert("Something went wrong");
    } finally {
      setActionLoading(null);
    }
  }

  async function copyUrl() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isAdmin = callerRole === "admin";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-20 rounded-lg bg-[var(--muted)] animate-pulse" />
          <div className="h-7 w-48 rounded-lg bg-[var(--muted)] animate-pulse" />
        </div>
        <div className="h-64 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse" />
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.push("/dashboard/members")}
          className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to directory
        </button>
        <div className="rounded-xl border border-[var(--border)] p-12 text-center">
          <p className="font-semibold text-lg">Member not found</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {error || "This member may have been removed."}
          </p>
        </div>
      </div>
    );
  }

  const initials = `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard/members")}
          className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to directory
        </button>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </button>

            {member.status === "invited" && (
              <button
                onClick={handleResendInvite}
                disabled={actionLoading === "resend"}
                className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {actionLoading === "resend" ? "Sending..." : "Resend Invite"}
              </button>
            )}

            {member.status === "inactive" || member.status === "suspended" ? (
              <button
                onClick={() => handleStatusChange("active")}
                disabled={actionLoading === "status"}
                className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Reactivate
              </button>
            ) : member.status === "active" ? (
              <button
                onClick={handleDeactivate}
                disabled={actionLoading === "deactivate"}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <UserX className="h-3.5 w-3.5" />
                Deactivate
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Resend invite URL banner */}
      {inviteUrl && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
          <p className="text-sm font-medium text-blue-800">
            New invite link generated:
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inviteUrl}
              readOnly
              className="flex-1 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-mono"
            />
            <button
              onClick={copyUrl}
              className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm hover:bg-blue-50 transition-colors flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Profile card */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        {/* Top section */}
        <div className="bg-[var(--muted)]/50 px-6 py-6 flex items-center gap-5">
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt={`${member.first_name} ${member.last_name}`}
              className="h-20 w-20 rounded-full object-cover shrink-0 border-2 border-[var(--background)]"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center text-2xl font-bold shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">
              {member.first_name} {member.last_name}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                  STATUS_STYLES[member.status] || STATUS_STYLES.inactive
                }`}
              >
                {member.status}
              </span>
              <span className="text-sm text-[var(--muted-foreground)]">
                {ROLE_LABELS[member.role] || member.role}
              </span>
              {member.tier && (
                <span className="text-sm text-[var(--muted-foreground)]">
                  &middot; {member.tier.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DetailRow icon={Mail} label="Email" href={`mailto:${member.email}`}>
            {member.email}
          </DetailRow>

          <DetailRow icon={Phone} label="Phone" href={member.phone ? `tel:${member.phone}` : undefined}>
            {member.phone || "Not provided"}
          </DetailRow>

          <DetailRow icon={Hash} label="Member Number">
            {member.member_number || "Not assigned"}
          </DetailRow>

          <DetailRow icon={Shield} label="Role">
            {ROLE_LABELS[member.role] || member.role}
          </DetailRow>

          <DetailRow icon={Calendar} label="Joined">
            {new Date(member.join_date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </DetailRow>

          <DetailRow icon={Clock} label="Last Updated">
            {new Date(member.updated_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </DetailRow>

          {member.tier && (
            <DetailRow icon={Shield} label="Membership Tier">
              {member.tier.name}{" "}
              <span className="text-[var(--muted-foreground)] capitalize">
                ({member.tier.level})
              </span>
            </DetailRow>
          )}

          {member.family && (
            <DetailRow icon={Shield} label="Family">
              {member.family.name}
            </DetailRow>
          )}
        </div>

        {/* Notes (admin only) */}
        {isAdmin && member.notes && (
          <div className="border-t border-[var(--border)] px-6 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--muted-foreground)] mb-2">
              <StickyNote className="h-4 w-4" />
              Admin Notes
            </div>
            <p className="text-sm whitespace-pre-wrap">{member.notes}</p>
          </div>
        )}

        {/* Invite status (admin, invited members) */}
        {isAdmin && member.status === "invited" && (
          <div className="border-t border-[var(--border)] px-6 py-4 bg-blue-50/50">
            <p className="text-sm font-medium text-blue-800 mb-1">
              Invite Pending
            </p>
            <div className="text-sm text-blue-700 space-y-0.5">
              {member.invite_sent_at && (
                <p>
                  Sent:{" "}
                  {new Date(member.invite_sent_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
              {member.invite_expires_at && (
                <p>
                  Expires:{" "}
                  {new Date(member.invite_expires_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {showEditModal && (
        <EditMemberModal
          member={member}
          tiers={tiers}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => fetchMember()}
        />
      )}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  href?: string;
}) {
  const content = href ? (
    <a href={href} className="hover:text-[var(--primary)] transition-colors">
      {children}
    </a>
  ) : (
    children
  );

  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-[var(--muted-foreground)] shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
        <p className="text-sm font-medium truncate">{content}</p>
      </div>
    </div>
  );
}
