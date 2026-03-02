"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  LayoutGrid,
  Users,
  CreditCard,
  Calendar,
  PartyPopper,
  Mail,
  Bot,
  type LucideIcon,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { name: "Members", href: "/dashboard/members", icon: Users },
  { name: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { name: "Bookings", href: "/dashboard/bookings", icon: Calendar },
  { name: "Events", href: "/dashboard/events", icon: PartyPopper },
  { name: "Messages", href: "/dashboard/messages", icon: Mail },
  { name: "AI Chat", href: "/dashboard/chat", icon: Bot },
] satisfies { name: string; href: string; icon: LucideIcon }[];

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
          const Icon = item.icon;

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
              <Icon className="h-4 w-4" />
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
