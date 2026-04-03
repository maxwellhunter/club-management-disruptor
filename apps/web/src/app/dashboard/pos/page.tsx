"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart,
  Settings,
  BarChart3,
  Plus,
  Trash2,
  DollarSign,
  CreditCard,
  Banknote,
  UserCheck,
  Clock,
  TrendingUp,
  Receipt,
  X,
  Check,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────

interface POSConfig {
  id: string;
  provider: string;
  location: string;
  name: string;
  is_active: boolean;
  config: Record<string, unknown>;
}

interface POSSummary {
  date: string;
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  tipTotal: number;
  salesByLocation: { location: string; total: number; count: number }[];
  salesByHour: { hour: number; total: number; count: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  recentTransactions: {
    id: string;
    total: number;
    tip: number;
    location: string;
    payment_method: string | null;
    description: string | null;
    member_id: string | null;
    item_count: number;
    created_at: string;
  }[];
  mtd: { sales: number; count: number };
}

interface CartItem {
  name: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  category: string | null;
}

type TabKey = "terminal" | "transactions" | "settings";

const LOCATIONS = [
  { value: "dining", label: "Dining" },
  { value: "pro_shop", label: "Pro Shop" },
  { value: "bar", label: "Bar" },
  { value: "snack_bar", label: "Snack Bar" },
  { value: "other", label: "Other" },
];

const PROVIDERS = [
  { value: "stripe_terminal", label: "Stripe Terminal" },
  { value: "manual", label: "Manual (Cash/Check)" },
  { value: "square", label: "Square (coming soon)", disabled: true },
  { value: "toast", label: "Toast (coming soon)", disabled: true },
  { value: "lightspeed", label: "Lightspeed (coming soon)", disabled: true },
];

// ── Main Page ───────────────────────────────────────────────

export default function POSPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("terminal");
  const [configs, setConfigs] = useState<POSConfig[]>([]);
  const [summary, setSummary] = useState<POSSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [configRes, summaryRes] = await Promise.all([
        fetch("/api/pos/config"),
        fetch("/api/pos/summary"),
      ]);

      if (configRes.status === 403 || summaryRes.status === 403) {
        setError("POS is only available to administrators and staff.");
        return;
      }

      if (configRes.ok) {
        const { configs: c } = await configRes.json();
        setConfigs(c);
      }
      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
    } catch {
      setError("Failed to load POS data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-[var(--muted)] animate-pulse" />
        <div className="h-4 w-72 rounded bg-[var(--muted)] animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-[var(--border)] bg-[var(--muted)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-12 text-center">
        <ShoppingCart className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
        <p className="font-semibold text-lg">POS Unavailable</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">{error}</p>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "terminal", label: "Terminal", icon: <ShoppingCart className="h-4 w-4" /> },
    { key: "transactions", label: "Sales Dashboard", icon: <BarChart3 className="h-4 w-4" /> },
    { key: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Point of Sale</h1>
        <p className="text-[var(--muted-foreground)]">
          Ring up sales, track transactions, and manage POS terminals
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--border)] p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "terminal" && (
        <TerminalTab configs={configs} onSaleComplete={fetchData} />
      )}
      {activeTab === "transactions" && <TransactionsTab summary={summary} />}
      {activeTab === "settings" && (
        <SettingsTab configs={configs} onUpdate={fetchData} />
      )}
    </div>
  );
}

// ── Terminal Tab (Ring Up Sales) ─────────────────────────────

function TerminalTab({
  configs,
  onSaleComplete,
}: {
  configs: POSConfig[];
  onSaleComplete: () => void;
}) {
  const activeConfigs = configs.filter((c) => c.is_active);
  const [selectedConfig, setSelectedConfig] = useState(activeConfigs[0]?.id ?? "");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemCategory, setItemCategory] = useState("");
  const [taxRate, setTaxRate] = useState("8");
  const [tip, setTip] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [memberId, setMemberId] = useState("");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [saleError, setSaleError] = useState("");

  if (activeConfigs.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-12 text-center">
        <ShoppingCart className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
        <p className="font-semibold text-lg">No Active Terminals</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Go to Settings to configure a POS terminal first.
        </p>
      </div>
    );
  }

  const subtotal = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxAmount = subtotal * (parseFloat(taxRate) / 100);
  const tipAmount = parseFloat(tip) || 0;
  const total = subtotal + taxAmount + tipAmount;
  const currentConfig = activeConfigs.find((c) => c.id === selectedConfig);

  function addToCart() {
    const price = parseFloat(itemPrice);
    const qty = parseInt(itemQty);
    if (!itemName.trim() || isNaN(price) || price < 0 || isNaN(qty) || qty < 1) return;

    setCart([
      ...cart,
      { name: itemName.trim(), sku: null, quantity: qty, unit_price: price, category: itemCategory || null },
    ]);
    setItemName("");
    setItemPrice("");
    setItemQty("1");
    setItemCategory("");
  }

  function removeFromCart(index: number) {
    setCart(cart.filter((_, i) => i !== index));
  }

  async function processSale() {
    if (cart.length === 0 || !selectedConfig) return;
    setProcessing(true);
    setSaleError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/pos/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pos_config_id: selectedConfig,
          member_id: memberId || null,
          subtotal,
          tax: Math.round(taxAmount * 100) / 100,
          tip: tipAmount,
          payment_method: paymentMethod,
          location: currentConfig?.location ?? "other",
          description: `Sale — ${currentConfig?.name ?? "POS"}`,
          items: cart,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSaleError(data.error ?? "Sale failed");
        return;
      }

      setSuccess(true);
      setCart([]);
      setTip("0");
      setMemberId("");
      onSaleComplete();
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setSaleError("Network error. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: Add Items */}
      <div className="lg:col-span-2 space-y-4">
        {/* Terminal selector */}
        <div className="flex gap-3 items-center">
          <label className="text-sm font-medium">Terminal:</label>
          <select
            value={selectedConfig}
            onChange={(e) => setSelectedConfig(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
          >
            {activeConfigs.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.location})</option>
            ))}
          </select>
        </div>

        {/* Add item form */}
        <div className="rounded-xl border border-[var(--border)] p-4">
          <h3 className="text-sm font-semibold mb-3">Add Item</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <input
              placeholder="Item name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addToCart()}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              placeholder="Price"
              type="number"
              step="0.01"
              min="0"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addToCart()}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                placeholder="Qty"
                type="number"
                min="1"
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm w-16"
              />
              <button
                onClick={addToCart}
                disabled={!itemName.trim() || !itemPrice}
                className="rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Cart */}
        <div className="rounded-xl border border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-5 py-3 text-sm font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Cart ({cart.length} item{cart.length !== 1 ? "s" : ""})
          </div>
          <div className="p-4">
            {cart.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-6">
                Add items to begin a transaction.
              </p>
            ) : (
              <div className="space-y-2">
                {cart.map((item, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
                    <div className="flex-1">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-xs text-[var(--muted-foreground)] ml-2">
                        x{item.quantity} @ {formatCurrency(item.unit_price)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </span>
                      <button onClick={() => removeFromCart(i)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Checkout */}
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] p-5 space-y-4">
          <h3 className="text-sm font-semibold">Checkout</h3>

          {/* Tax rate */}
          <div>
            <label className="text-xs text-[var(--muted-foreground)]">Tax Rate %</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm mt-1"
            />
          </div>

          {/* Tip */}
          <div>
            <label className="text-xs text-[var(--muted-foreground)]">Tip</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm mt-1"
            />
          </div>

          {/* Payment method */}
          <div>
            <label className="text-xs text-[var(--muted-foreground)]">Payment Method</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[
                { value: "card", label: "Card", icon: <CreditCard className="h-3.5 w-3.5" /> },
                { value: "cash", label: "Cash", icon: <Banknote className="h-3.5 w-3.5" /> },
                { value: "member_charge", label: "Member", icon: <UserCheck className="h-3.5 w-3.5" /> },
                { value: "other", label: "Other", icon: <DollarSign className="h-3.5 w-3.5" /> },
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    paymentMethod === m.value
                      ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Member ID (for member charge) */}
          {paymentMethod === "member_charge" && (
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Member ID</label>
              <input
                placeholder="Enter member UUID"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm mt-1"
              />
            </div>
          )}

          {/* Totals */}
          <div className="border-t border-[var(--border)] pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Tax ({taxRate}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            {tipAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">Tip</span>
                <span>{formatCurrency(tipAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-1 border-t border-[var(--border)]">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {saleError && (
            <p className="text-xs text-red-500">{saleError}</p>
          )}

          {success && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <Check className="h-4 w-4" />
              Sale completed!
            </div>
          )}

          <button
            onClick={processSale}
            disabled={cart.length === 0 || processing}
            className="w-full rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {processing ? "Processing..." : `Charge ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Transactions / Sales Dashboard Tab ──────────────────────

function TransactionsTab({ summary }: { summary: POSSummary | null }) {
  if (!summary) {
    return (
      <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
        No sales data available.
      </p>
    );
  }

  const locationLabels: Record<string, string> = {
    dining: "Dining",
    pro_shop: "Pro Shop",
    bar: "Bar",
    snack_bar: "Snack Bar",
    other: "Other",
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
          label="Today's Sales"
          value={formatCurrency(summary.totalSales)}
          sub={`${summary.transactionCount} transaction${summary.transactionCount !== 1 ? "s" : ""}`}
        />
        <StatCard
          icon={<Receipt className="h-5 w-5 text-blue-500" />}
          label="Avg Ticket"
          value={formatCurrency(summary.averageTicket)}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-purple-500" />}
          label="MTD Sales"
          value={formatCurrency(summary.mtd.sales)}
          sub={`${summary.mtd.count} transactions`}
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-amber-500" />}
          label="Tips Today"
          value={formatCurrency(summary.tipTotal)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales by location */}
        <div className="rounded-xl border border-[var(--border)]">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3.5 text-sm font-semibold">
            <BarChart3 className="h-4 w-4" />
            Sales by Location
          </div>
          <div className="p-5">
            {summary.salesByLocation.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-4">No sales today.</p>
            ) : (
              <div className="space-y-3">
                {summary.salesByLocation.map((loc, i) => {
                  const max = Math.max(...summary.salesByLocation.map((l) => l.total), 1);
                  const pct = Math.max(Math.round((loc.total / max) * 100), 2);
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{locationLabels[loc.location] ?? loc.location}</span>
                        <span className="text-[var(--muted-foreground)]">
                          {formatCurrency(loc.total)} ({loc.count})
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--muted)]">
                        <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top items */}
        <div className="rounded-xl border border-[var(--border)]">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3.5 text-sm font-semibold">
            <ShoppingCart className="h-4 w-4" />
            Top Items
          </div>
          <div className="p-5">
            {summary.topItems.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-4">No items sold today.</p>
            ) : (
              <div className="space-y-2">
                {summary.topItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm rounded-lg border border-[var(--border)] px-3 py-2">
                    <span className="font-medium truncate flex-1">{item.name}</span>
                    <span className="text-[var(--muted-foreground)] ml-3 shrink-0">
                      x{item.quantity} &middot; {formatCurrency(item.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rounded-xl border border-[var(--border)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3.5 text-sm font-semibold">
          <Clock className="h-4 w-4" />
          Recent Transactions
        </div>
        <div className="p-5">
          {summary.recentTransactions.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-4">No transactions today.</p>
          ) : (
            <div className="space-y-2">
              {summary.recentTransactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {txn.description ?? "POS Sale"}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {new Date(txn.created_at).toLocaleTimeString()} &middot;{" "}
                      {txn.payment_method ?? "card"} &middot;{" "}
                      {txn.item_count} item{txn.item_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold shrink-0 ml-3">
                    {formatCurrency(txn.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Settings Tab ────────────────────────────────────────────

function SettingsTab({
  configs,
  onUpdate,
}: {
  configs: POSConfig[];
  onUpdate: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProvider, setNewProvider] = useState("stripe_terminal");
  const [newLocation, setNewLocation] = useState("dining");
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  async function createConfig() {
    if (!newName.trim()) return;
    setSaving(true);
    setSettingsError("");

    try {
      const res = await fetch("/api/pos/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          provider: newProvider,
          location: newLocation,
          config: {},
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSettingsError(data.error ?? "Failed to create");
        return;
      }

      setNewName("");
      setShowAdd(false);
      onUpdate();
    } catch {
      setSettingsError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch(`/api/pos/config/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !isActive }),
    });
    onUpdate();
  }

  async function deleteConfig(id: string) {
    const res = await fetch(`/api/pos/config/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Failed to delete");
      return;
    }
    onUpdate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">POS Terminals</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] px-3 py-1.5 text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Terminal
        </button>
      </div>

      {/* Add terminal form */}
      {showAdd && (
        <div className="rounded-xl border border-[var(--border)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">New POS Terminal</h3>
            <button onClick={() => setShowAdd(false)}>
              <X className="h-4 w-4 text-[var(--muted-foreground)]" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Name</label>
              <input
                placeholder="e.g., Main Dining Register"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Provider</label>
              <select
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm mt-1"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value} disabled={p.disabled}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Location</label>
              <select
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm mt-1"
              >
                {LOCATIONS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>
          {settingsError && <p className="text-xs text-red-500">{settingsError}</p>}
          <button
            onClick={createConfig}
            disabled={!newName.trim() || saving}
            className="rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Terminal"}
          </button>
        </div>
      )}

      {/* Existing configs */}
      {configs.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-12 text-center">
          <Settings className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
          <p className="font-semibold text-lg">No POS Terminals</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Add a terminal to start processing sales.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => (
            <div
              key={config.id}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] px-5 py-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{config.name}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      config.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {config.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {PROVIDERS.find((p) => p.value === config.provider)?.label ?? config.provider}
                  {" "}&middot;{" "}
                  {LOCATIONS.find((l) => l.value === config.location)?.label ?? config.location}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(config.id, config.is_active)}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)]"
                >
                  {config.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => deleteConfig(config.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared Components ───────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
      {sub && (
        <p className="text-xs mt-1 text-[var(--muted-foreground)]">{sub}</p>
      )}
    </div>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
