"use client";

import { useState } from "react";
import ChargePostingTab from "./charge-posting-tab";
import MemberTabsTab from "./member-tabs-tab";

type Tab = "post" | "tabs";

export default function ChargesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("post");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Charge Posting</h1>
        <p className="text-[var(--muted-foreground)]">
          Post charges to member accounts and manage open tabs.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-[var(--muted)] p-1 w-fit">
        <button
          onClick={() => setActiveTab("post")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "post"
              ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Post Charge
        </button>
        <button
          onClick={() => setActiveTab("tabs")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "tabs"
              ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Member Tabs
        </button>
      </div>

      {activeTab === "post" ? <ChargePostingTab /> : <MemberTabsTab />}
    </div>
  );
}
