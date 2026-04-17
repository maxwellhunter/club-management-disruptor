"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, QrCode, Search, Loader2 } from "lucide-react";

interface MemberQRRow {
  member_id: string;
  name: string;
  email: string | null;
  member_number: string | null;
  tier_name: string | null;
  barcode_payload: string;
  qr_data_url: string;
  has_pass: boolean;
}

interface MemberQRResponse {
  members: MemberQRRow[];
  provisioned: number;
}

export default function MemberQRTestPage() {
  const [rows, setRows] = useState<MemberQRRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [provisioned, setProvisioned] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/member-qrcodes");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        const data: MemberQRResponse = await res.json();
        setRows(data.members);
        setProvisioned(data.provisioned);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load member QR codes");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = rows.filter((r) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.email?.toLowerCase().includes(q) ?? false) ||
      (r.member_number?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/dashboard/digital-cards"
          className="p-2 -ml-2 rounded-md hover:bg-[var(--muted)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">Member QR Test Grid</h1>
      </div>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        Live QR codes for every active member. Point the iOS scanner at one to
        verify the end-to-end scan → resolve → display flow.
      </p>

      {provisioned > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm px-3 py-2">
          Provisioned {provisioned} missing staff pass{provisioned === 1 ? "" : "es"}.
          These codes are now scannable.
        </div>
      )}

      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Search by name, email, or member #"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]"
          />
        </div>
        <span className="text-xs text-[var(--muted-foreground)]">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-[var(--muted-foreground)]">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading member QR codes…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <QrCode className="h-10 w-10 mx-auto mb-2 text-[var(--muted-foreground)]" />
          <p className="text-sm text-[var(--muted-foreground)]">No members match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((row) => (
            <button
              key={row.member_id}
              type="button"
              onClick={() => setExpanded(expanded === row.member_id ? null : row.member_id)}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col items-center hover:border-[var(--primary)]/50 hover:shadow-sm transition-all"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={row.qr_data_url}
                alt={`QR for ${row.name}`}
                className={`rounded-md border border-[var(--border)] ${
                  expanded === row.member_id ? "w-64 h-64" : "w-40 h-40"
                } transition-all`}
              />
              <div className="mt-3 text-center">
                <div className="text-sm font-semibold">{row.name}</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {row.tier_name ?? "—"}
                  {row.member_number ? ` · #${row.member_number}` : ""}
                </div>
                <div className="mt-1 text-[10px] font-mono text-[var(--muted-foreground)] truncate max-w-[200px]">
                  {row.barcode_payload}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
