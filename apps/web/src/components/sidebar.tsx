"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  LayoutGrid,
  Users,
  CreditCard,
  Calculator,
  Calendar,
  UtensilsCrossed,
  PartyPopper,
  Mail,
  Bot,
  BarChart3,
  ShoppingCart,
  Receipt,
  BookOpen,
  ArrowUpDown,
  UserPlus,
  Bell,
  Brain,
  Wallet,
  Settings,
  Flag,
  Heart,
  FileText,
  Zap,
  Search,
  QrCode,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  /**
   * Optional aliases to match on in the search filter. Keep these
   * focused — the item's name is already indexed, so only add
   * terms that a user might type when they can't remember the
   * formal label (e.g. "f&b" → Dining, "tax" → Accounting).
   */
  keywords?: string[];
  /**
   * Set true for pages that should be search-only and not appear
   * in the always-on sidebar list — useful for deep-linked
   * secondary pages (scanner test, etc.) without cluttering the
   * nav.
   */
  hidden?: boolean;
};

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutGrid, keywords: ["home", "overview"] },
  { name: "Members", href: "/dashboard/members", icon: Users, keywords: ["roster", "users", "people"] },
  { name: "Families", href: "/dashboard/families", icon: Heart },
  { name: "Billing", href: "/dashboard/billing", icon: CreditCard, keywords: ["invoices", "dues", "stripe", "payments"] },
  { name: "Advanced Billing", href: "/dashboard/billing/advanced", icon: Calculator, keywords: ["minimums", "assessments", "f&b", "spending"] },
  { name: "Bookings", href: "/dashboard/bookings", icon: Calendar, keywords: ["tee times", "golf", "courts", "spaces", "rooms"] },
  { name: "Scorecards", href: "/dashboard/scorecards", icon: Flag, keywords: ["golf", "rounds"] },
  { name: "Dining", href: "/dashboard/dining", icon: UtensilsCrossed, keywords: ["menu", "restaurant", "f&b"] },
  { name: "Events", href: "/dashboard/events", icon: PartyPopper, keywords: ["rsvp", "calendar"] },
  { name: "Messages", href: "/dashboard/messages", icon: Mail, keywords: ["announcements", "email", "inbox"] },
  { name: "AI Chat", href: "/dashboard/chat", icon: Bot, keywords: ["concierge", "claude"] },
  { name: "Guests", href: "/dashboard/guests", icon: UserPlus, keywords: ["visitors", "policies"] },
  { name: "POS", href: "/dashboard/pos", icon: ShoppingCart, keywords: ["point of sale", "register", "charges"] },
  { name: "Charge Posting", href: "/dashboard/charges", icon: Receipt, keywords: ["manual charges", "adjustments"] },
  { name: "Statements", href: "/dashboard/statements", icon: FileText, keywords: ["billing history"] },
  { name: "Auto-Draft", href: "/dashboard/autodraft", icon: Zap, keywords: ["ach", "recurring", "autopay"] },
  { name: "Accounting", href: "/dashboard/accounting", icon: BookOpen, keywords: ["gl", "quickbooks", "journal", "tax"] },
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell, keywords: ["push", "templates", "alerts"] },
  { name: "AI Insights", href: "/dashboard/insights", icon: Brain, keywords: ["analytics"] },
  { name: "Digital Cards", href: "/dashboard/digital-cards", icon: Wallet, keywords: ["qr", "nfc", "apple wallet", "google wallet", "check-in"] },
  { name: "Scanner Test QRs", href: "/dashboard/digital-cards/test", icon: QrCode, keywords: ["qr", "test", "scan"], hidden: true },
  { name: "Reports", href: "/dashboard/reports", icon: BarChart3, keywords: ["analytics", "metrics"] },
  { name: "Migration", href: "/dashboard/migration", icon: ArrowUpDown, keywords: ["import", "jonas", "northstar", "csv"] },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, keywords: ["preferences", "config"] },
];

/**
 * Lowercase substring match on name + keywords. Simple on purpose —
 * the whole nav is <50 items and we want fast + predictable. If we
 * ever outgrow this, swap for a proper fuzzy ranker (fuse.js).
 */
function matches(item: NavItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (item.name.toLowerCase().includes(q)) return true;
  return (item.keywords ?? []).some((k) => k.toLowerCase().includes(q));
}

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses the search, Esc clears it. Standard admin-
  // tool affordances (Linear, Notion, Vercel) so power users can
  // keyboard-jump without touching the mouse.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const isSearchShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isSearchShortcut) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const filtered = useMemo(() => {
    const trimmed = query.trim();
    return navigation.filter((item) => {
      // Hidden items only appear when something's been searched.
      if (item.hidden && !trimmed) return false;
      return matches(item, trimmed);
    });
  }, [query]);

  // Keep keyboard cursor in-bounds as results shrink.
  useEffect(() => {
    if (focusedIndex >= filtered.length) setFocusedIndex(0);
  }, [filtered.length, focusedIndex]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (query) {
        setQuery("");
      } else {
        inputRef.current?.blur();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      const target = filtered[focusedIndex];
      if (target) {
        router.push(target.href);
        setQuery("");
        inputRef.current?.blur();
      }
    }
  }

  return (
    <aside className="flex h-full w-64 flex-shrink-0 flex-col border-r border-[var(--border)] bg-[var(--muted)]">
      <div className="p-6 pb-4">
        <h1 className="text-xl font-bold">
          Club<span className="text-[var(--primary)]">OS</span>
        </h1>
      </div>

      <div className="px-3 pb-3">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setFocusedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search pages"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] pl-7 pr-10 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] placeholder:text-[var(--muted-foreground)]"
            aria-label="Search admin pages"
          />
          {/* Shortcut badge — only shown while not focused so it
              doesn't hover over the user's typing. */}
          {!query && (
            <kbd className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 items-center gap-0.5 rounded border border-[var(--border)] bg-[var(--muted)] px-1 py-0.5 text-[9px] font-mono text-[var(--muted-foreground)]">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto space-y-1 px-3 pb-3">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-[var(--muted-foreground)]">
            No pages match <span className="font-medium">&ldquo;{query}&rdquo;</span>
          </div>
        ) : (
          filtered.map((item, idx) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const isFocused = query.trim() !== "" && idx === focusedIndex;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  setQuery("");
                }}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : isFocused
                    ? "bg-[var(--background)] text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })
        )}
      </nav>

      <div className="border-t border-[var(--border)] p-4">
        <div className="flex items-center justify-between">
          <div className="truncate">
            <p className="text-sm font-medium truncate">
              {user.user_metadata?.full_name || "User"}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] truncate">
              {user.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
