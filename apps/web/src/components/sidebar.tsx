"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: "grid" },
  { name: "Members", href: "/dashboard/members", icon: "users" },
  { name: "Billing", href: "/dashboard/billing", icon: "credit-card" },
  { name: "Bookings", href: "/dashboard/bookings", icon: "calendar" },
  { name: "Events", href: "/dashboard/events", icon: "party-popper" },
  { name: "Messages", href: "/dashboard/messages", icon: "mail" },
  { name: "AI Chat", href: "/dashboard/chat", icon: "bot" },
];

const icons: Record<string, string> = {
  grid: "⊞",
  users: "👥",
  "credit-card": "💳",
  calendar: "📅",
  "party-popper": "🎉",
  mail: "✉️",
  bot: "🤖",
};

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-[var(--border)] bg-[var(--muted)]">
      <div className="p-6">
        <h1 className="text-xl font-bold">
          Club<span className="text-[var(--primary)]">OS</span>
        </h1>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navigation.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
              }`}
            >
              <span className="text-base">{icons[item.icon]}</span>
              {item.name}
            </Link>
          );
        })}
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
