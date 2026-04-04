"use client";

import { useState, useEffect } from "react";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Shield,
  RefreshCw,
  Sparkles,
  CheckCircle,
  Clock,
} from "lucide-react";

interface KPIHealth {
  metric: string;
  status: "good" | "warning" | "critical";
  value: string;
  insight: string;
}

interface Insight {
  title: string;
  category: "revenue" | "membership" | "operations" | "engagement";
  priority: "high" | "medium" | "low";
  description: string;
  action: string;
}

interface Risk {
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
}

interface Opportunity {
  title: string;
  potential_impact: string;
  description: string;
}

interface AIInsights {
  summary: string;
  kpi_health: KPIHealth[];
  insights: Insight[];
  risks: Risk[];
  opportunities: Opportunity[];
}

interface ClubData {
  active_members: number;
  new_members_this_month: number;
  total_members: number;
  revenue_mtd: number;
  outstanding_amount: number;
  overdue_invoices: number;
  bookings_this_month: number;
  bookings_last_month: number;
  booking_change_pct: number;
  cancelled_bookings: number;
  no_shows: number;
  events_this_month: number;
  pos_transactions_mtd: number;
  pos_revenue_mtd: number;
  guest_visits_this_month: number;
  guest_fee_revenue: number;
}

export default function InsightsPage() {
  const [clubData, setClubData] = useState<ClubData | null>(null);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/insights");
        if (res.ok) {
          const data = await res.json();
          setClubData(data.club_data);
        }
      } catch (err) {
        console.error("Failed to fetch club data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  async function generateInsights() {
    if (!clubData) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ club_data: clubData, focus: focus || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to generate insights");
      }
    } catch {
      setError("Network error");
    } finally {
      setGenerating(false);
    }
  }

  function formatCurrency(n: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">AI Insights</h1>
          <p className="text-[var(--muted-foreground)]">Loading club data...</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-[var(--primary)]" />
            AI Insights
          </h1>
          <p className="text-[var(--muted-foreground)]">Claude-powered analysis of your club&apos;s operations and financials.</p>
        </div>
      </div>

      {/* Club data overview */}
      {clubData && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Active Members" value={String(clubData.active_members)} sub={`+${clubData.new_members_this_month} this month`} />
          <MiniStat label="Revenue (MTD)" value={formatCurrency(clubData.revenue_mtd)} />
          <MiniStat label="Outstanding" value={formatCurrency(clubData.outstanding_amount)} warn={clubData.overdue_invoices > 0} sub={`${clubData.overdue_invoices} overdue`} />
          <MiniStat label="Bookings" value={String(clubData.bookings_this_month)} sub={`${clubData.booking_change_pct >= 0 ? "+" : ""}${clubData.booking_change_pct}% vs last month`} />
          <MiniStat label="POS Revenue" value={formatCurrency(clubData.pos_revenue_mtd)} sub={`${clubData.pos_transactions_mtd} transactions`} />
          <MiniStat label="Guest Visits" value={String(clubData.guest_visits_this_month)} sub={formatCurrency(clubData.guest_fee_revenue) + " in fees"} />
          <MiniStat label="No-Shows" value={String(clubData.no_shows)} warn={clubData.no_shows > 3} />
          <MiniStat label="Events" value={String(clubData.events_this_month)} />
        </div>
      )}

      {/* Generate insights */}
      <div className="rounded-xl border border-[var(--border)] p-5 bg-gradient-to-r from-[var(--primary)]/5 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[var(--primary)]" />
              Generate AI Analysis
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Claude will analyze your club data and provide actionable insights, risks, and opportunities.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              <option value="">All Areas</option>
              <option value="revenue and billing">Revenue</option>
              <option value="membership growth and retention">Membership</option>
              <option value="facility utilization and bookings">Operations</option>
              <option value="member engagement and events">Engagement</option>
            </select>
            <button
              onClick={generateInsights}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {generating ? "Analyzing..." : "Generate Insights"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* AI Insights results */}
      {insights && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="rounded-xl border border-[var(--border)] p-5 bg-[var(--muted)]">
            <p className="text-lg font-medium">{insights.summary}</p>
          </div>

          {/* KPI Health */}
          {insights.kpi_health.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3">KPI Health Check</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {insights.kpi_health.map((kpi, i) => (
                  <div key={i} className="rounded-xl border border-[var(--border)] p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{kpi.metric}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        kpi.status === "good" ? "bg-green-100 text-green-800" :
                        kpi.status === "warning" ? "bg-amber-100 text-amber-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {kpi.status === "good" ? <CheckCircle className="h-3 w-3" /> :
                         kpi.status === "warning" ? <Clock className="h-3 w-3" /> :
                         <AlertTriangle className="h-3 w-3" />}
                        {kpi.status}
                      </span>
                    </div>
                    <p className="text-2xl font-bold">{kpi.value}</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">{kpi.insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {insights.insights.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[var(--primary)]" />
                Key Insights
              </h2>
              <div className="space-y-3">
                {insights.insights.map((insight, i) => (
                  <div key={i} className="rounded-xl border border-[var(--border)] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        insight.priority === "high" ? "bg-red-100 text-red-800" :
                        insight.priority === "medium" ? "bg-amber-100 text-amber-800" :
                        "bg-blue-100 text-blue-800"
                      }`}>
                        {insight.priority}
                      </span>
                      <span className="text-xs bg-[var(--muted)] px-2 py-0.5 rounded capitalize">{insight.category}</span>
                      <h3 className="font-medium">{insight.title}</h3>
                    </div>
                    <p className="text-sm text-[var(--muted-foreground)] mb-2">{insight.description}</p>
                    <div className="flex items-start gap-2 bg-[var(--muted)] rounded-lg p-3">
                      <Lightbulb className="h-4 w-4 text-[var(--primary)] shrink-0 mt-0.5" />
                      <p className="text-sm font-medium">{insight.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Risks */}
            {insights.risks.length > 0 && (
              <div>
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-500" />
                  Risks
                </h2>
                <div className="space-y-3">
                  {insights.risks.map((risk, i) => (
                    <div key={i} className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          risk.severity === "high" ? "bg-red-200 text-red-900" :
                          risk.severity === "medium" ? "bg-amber-200 text-amber-900" :
                          "bg-yellow-200 text-yellow-900"
                        }`}>
                          {risk.severity}
                        </span>
                        <h3 className="font-medium text-red-900">{risk.title}</h3>
                      </div>
                      <p className="text-sm text-red-800">{risk.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opportunities */}
            {insights.opportunities.length > 0 && (
              <div>
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-green-600" style={{ transform: "scaleY(-1)" }} />
                  Opportunities
                </h2>
                <div className="space-y-3">
                  {insights.opportunities.map((opp, i) => (
                    <div key={i} className="rounded-xl border border-green-200 bg-green-50 p-4">
                      <h3 className="font-medium text-green-900">{opp.title}</h3>
                      <p className="text-xs text-green-700 font-medium mb-1">{opp.potential_impact}</p>
                      <p className="text-sm text-green-800">{opp.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className={`text-xl font-bold ${warn ? "text-amber-600" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{sub}</p>}
    </div>
  );
}
