"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Trash2,
  UserPlus,
  UserMinus,
  Crown,
  Pencil,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import type { FamilyWithMembers, MemberRole } from "@club/shared";

interface UnassignedMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function FamiliesPage() {
  const [families, setFamilies] = useState<FamilyWithMembers[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedMember[]>([]);
  const [role, setRole] = useState<MemberRole>("member");
  const [loading, setLoading] = useState(true);
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [addingMemberTo, setAddingMemberTo] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchFamilies = useCallback(async () => {
    try {
      const res = await fetch("/api/families");
      if (res.ok) {
        const data = await res.json();
        setFamilies(data.families ?? []);
        setUnassigned(data.unassigned_members ?? []);
        if (data.role) setRole(data.role);
      }
    } catch (err) {
      console.error("Failed to fetch families:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFamilies();
  }, [fetchFamilies]);

  const isAdmin = role === "admin";

  async function handleDelete(familyId: string, familyName: string) {
    if (
      !confirm(
        `Delete the "${familyName}" family? Members will be unlinked but not removed.`
      )
    )
      return;
    setActionLoading(familyId);
    try {
      await fetch(`/api/families/${familyId}`, { method: "DELETE" });
      fetchFamilies();
    } catch {
      alert("Failed to delete family");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemoveMember(familyId: string, memberId: string) {
    setActionLoading(`remove-${memberId}`);
    try {
      await fetch(`/api/families/${familyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_member", member_id: memberId }),
      });
      fetchFamilies();
    } catch {
      alert("Failed to remove member");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSetPrimary(familyId: string, memberId: string) {
    setActionLoading(`primary-${memberId}`);
    try {
      await fetch(`/api/families/${familyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_primary", member_id: memberId }),
      });
      fetchFamilies();
    } catch {
      alert("Failed to set primary member");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddMember(familyId: string, memberId: string) {
    setActionLoading(`add-${memberId}`);
    try {
      await fetch(`/api/families/${familyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_member", member_id: memberId }),
      });
      setAddingMemberTo(null);
      fetchFamilies();
    } catch {
      alert("Failed to add member to family");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Families</h1>
          <p className="text-[var(--muted-foreground)]">
            Manage family accounts and member groupings.
          </p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse"
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
          <h1 className="text-2xl font-bold">Families</h1>
          <p className="text-[var(--muted-foreground)]">
            {isAdmin
              ? "Manage family accounts and member groupings."
              : "View family memberships."}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            New Family
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--border)] p-4">
          <p className="text-sm text-[var(--muted-foreground)]">Families</p>
          <p className="text-2xl font-bold mt-1">{families.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            Members in Families
          </p>
          <p className="text-2xl font-bold mt-1">
            {families.reduce((s, f) => s + f.member_count, 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-4">
          <p className="text-sm text-[var(--muted-foreground)]">Unassigned</p>
          <p className="text-2xl font-bold mt-1">{unassigned.length}</p>
        </div>
      </div>

      {/* Family list */}
      {families.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center">
          <Users className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
          <p className="font-medium text-[var(--foreground)]">
            No families created yet
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Create a family to group related members together.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {families.map((family) => {
            const isExpanded = expandedFamily === family.id;
            const isProcessing = actionLoading === family.id;

            return (
              <div
                key={family.id}
                className="rounded-xl border border-[var(--border)] overflow-hidden"
              >
                {/* Family header */}
                <button
                  onClick={() =>
                    setExpandedFamily(isExpanded ? null : family.id)
                  }
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--muted)]/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)]" />
                    )}
                    <div className="text-left">
                      <h3 className="font-semibold text-[var(--foreground)]">
                        {family.name}
                      </h3>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {family.member_count}{" "}
                        {family.member_count === 1 ? "member" : "members"}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setAddingMemberTo(
                            addingMemberTo === family.id ? null : family.id
                          )
                        }
                        className="rounded-lg p-1.5 hover:bg-[var(--muted)] transition-colors"
                        title="Add member"
                      >
                        <UserPlus className="h-4 w-4 text-[var(--muted-foreground)]" />
                      </button>
                      <button
                        onClick={() => handleDelete(family.id, family.name)}
                        disabled={isProcessing}
                        className="rounded-lg p-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Delete family"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  )}
                </button>

                {/* Add member dropdown */}
                {addingMemberTo === family.id && unassigned.length > 0 && (
                  <div className="border-t border-[var(--border)] bg-blue-50/50 px-5 py-3">
                    <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">
                      Add a member to this family:
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {unassigned.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleAddMember(family.id, m.id)}
                          disabled={actionLoading === `add-${m.id}`}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors text-sm disabled:opacity-50"
                        >
                          <span>
                            {m.first_name} {m.last_name}
                          </span>
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {m.email}
                          </span>
                        </button>
                      ))}
                    </div>
                    {unassigned.length === 0 && (
                      <p className="text-sm text-[var(--muted-foreground)]">
                        All members are already in a family.
                      </p>
                    )}
                  </div>
                )}

                {/* Expanded member list */}
                {isExpanded && (
                  <div className="border-t border-[var(--border)]">
                    {family.members.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-[var(--muted-foreground)]">
                        No members in this family yet.
                      </p>
                    ) : (
                      <div className="divide-y divide-[var(--border)]">
                        {family.members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between px-5 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center text-xs font-bold">
                                {member.first_name[0]}
                                {member.last_name[0]}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {member.first_name} {member.last_name}
                                  </span>
                                  {member.is_primary && (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-medium">
                                      <Crown className="h-2.5 w-2.5" />
                                      Primary
                                    </span>
                                  )}
                                  {member.tier_name && (
                                    <span className="text-xs text-[var(--muted-foreground)]">
                                      {member.tier_name}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[var(--muted-foreground)]">
                                  {member.email}
                                </p>
                              </div>
                            </div>

                            {isAdmin && (
                              <div className="flex items-center gap-1">
                                {!member.is_primary && (
                                  <button
                                    onClick={() =>
                                      handleSetPrimary(family.id, member.id)
                                    }
                                    disabled={
                                      actionLoading ===
                                      `primary-${member.id}`
                                    }
                                    className="rounded-lg p-1.5 hover:bg-amber-50 transition-colors disabled:opacity-50"
                                    title="Set as primary"
                                  >
                                    <Crown className="h-3.5 w-3.5 text-amber-500" />
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    handleRemoveMember(family.id, member.id)
                                  }
                                  disabled={
                                    actionLoading === `remove-${member.id}`
                                  }
                                  className="rounded-lg p-1.5 hover:bg-red-50 transition-colors disabled:opacity-50"
                                  title="Remove from family"
                                >
                                  <UserMinus className="h-3.5 w-3.5 text-red-500" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create family modal */}
      {showCreateModal && (
        <CreateFamilyModal
          unassignedMembers={unassigned}
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchFamilies}
        />
      )}
    </div>
  );
}

function CreateFamilyModal({
  unassignedMembers,
  onClose,
  onSuccess,
}: {
  unassignedMembers: UnassignedMember[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [primaryMemberId, setPrimaryMemberId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          primary_member_id: primaryMemberId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create family");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Failed to create family");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Create Family</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-[var(--muted)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Family Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. The Smiths"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Primary Member{" "}
              <span className="text-[var(--muted-foreground)] font-normal">
                (optional)
              </span>
            </label>
            <select
              value={primaryMemberId}
              onChange={(e) => setPrimaryMemberId(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              <option value="">Select a primary member...</option>
              {unassignedMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name} ({m.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              The primary member is typically the account holder responsible for billing.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Family"}
          </button>
        </form>
      </div>
    </div>
  );
}
