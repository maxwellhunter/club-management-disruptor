"use client";

import { useState, useEffect } from "react";
import {
  ClipboardList,
  BookOpen,
  CalendarDays,
  UtensilsCrossed,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Clock,
  MapPin,
  Users,
  Pencil,
  X,
  Check,
  Ban,
  UserPlus,
} from "lucide-react";
import type {
  DiningOrderWithItems,
  DiningOrderStatus,
  MenuCategory,
  MenuItem,
  BookingWithDetails,
} from "@club/shared";

type AdminTab = "orders" | "menu" | "reservations";

const TABS: { value: AdminTab; label: string; icon: typeof ClipboardList }[] = [
  { value: "orders", label: "Orders", icon: ClipboardList },
  { value: "menu", label: "Menu", icon: BookOpen },
  { value: "reservations", label: "Reservations", icon: CalendarDays },
];

const STATUS_FLOW: Record<string, DiningOrderStatus | null> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "delivered",
  delivered: null,
  cancelled: null,
};

const STATUS_BADGE: Record<
  string,
  { label: string; dot: string; bg: string; text: string }
> = {
  pending: {
    label: "Pending",
    dot: "bg-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
  confirmed: {
    label: "Confirmed",
    dot: "bg-blue-500",
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
  preparing: {
    label: "Preparing",
    dot: "bg-orange-500",
    bg: "bg-orange-50",
    text: "text-orange-700",
  },
  ready: {
    label: "Ready",
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
  delivered: {
    label: "Delivered",
    dot: "bg-gray-400",
    bg: "bg-gray-100",
    text: "text-gray-600",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-red-500",
    bg: "bg-red-50",
    text: "text-red-700",
  },
};

const STATUS_ACTIONS: Record<string, string> = {
  pending: "Confirm",
  confirmed: "Start Preparing",
  preparing: "Mark Ready",
  ready: "Mark Delivered",
};

// Shared input class
const INPUT_CLS =
  "rounded-xl border border-[var(--border)] bg-[var(--surface-lowest)] px-4 py-2.5 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all";

export default function DiningAdmin() {
  const [tab, setTab] = useState<AdminTab>("orders");

  return (
    <div className="space-y-6">
      {/* Segmented tab control */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--muted)] w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold tracking-wide transition-all ${
                tab === t.value
                  ? "bg-[var(--surface-lowest)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "orders" && <OrdersTab />}
      {tab === "menu" && <MenuTab />}
      {tab === "reservations" && <ReservationsTab />}
    </div>
  );
}

// ========== Orders Tab ==========

function OrdersTab() {
  const [orders, setOrders] = useState<DiningOrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "all">("active");

  async function fetchOrders() {
    try {
      const res = await fetch("/api/dining/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  async function advanceStatus(orderId: string, newStatus: DiningOrderStatus) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/dining/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, status: newStatus } : o
          )
        );
      }
    } catch (err) {
      console.error("Failed to update order:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  async function cancelOrder(orderId: string) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/dining/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, status: "cancelled" } : o
          )
        );
      }
    } catch (err) {
      console.error("Failed to cancel order:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered =
    filter === "active"
      ? orders.filter(
          (o) => !["delivered", "cancelled"].includes(o.status)
        )
      : orders;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-[var(--muted)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">
          {filtered.length} order{filtered.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--muted)]">
          {(["active", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                filter === f
                  ? "bg-[var(--surface-lowest)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {f === "active" ? "Active" : "All"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[var(--outline-variant)]/30 p-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--muted)] mb-4">
            <ClipboardList className="h-7 w-7 text-[var(--muted-foreground)]" />
          </div>
          <p className="font-[family-name:var(--font-headline)] font-bold text-xl">
            No orders
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {filter === "active"
              ? "No active orders right now."
              : "No orders found."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const nextStatus = STATUS_FLOW[order.status];
            const badge = STATUS_BADGE[order.status];
            return (
              <div
                key={order.id}
                className="rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[var(--outline-variant)]/30 p-5 transition-all hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="font-[family-name:var(--font-headline)] font-bold text-base">
                        {order.member_first_name} {order.member_last_name}
                      </p>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${badge.bg} ${badge.text}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${badge.dot}`}
                        />
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--muted-foreground)]">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {order.facility_name}
                      </span>
                      {order.table_number && (
                        <span className="inline-flex items-center gap-1.5">
                          <UtensilsCrossed className="h-3.5 w-3.5" />
                          Table {order.table_number}
                        </span>
                      )}
                      <span className="shrink-0 rounded-md bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase">
                        ${Number(order.total).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {nextStatus && (
                      <button
                        onClick={() => advanceStatus(order.id, nextStatus)}
                        disabled={updatingId === order.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-bold tracking-wide uppercase hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        {updatingId === order.id
                          ? "..."
                          : STATUS_ACTIONS[order.status]}
                      </button>
                    )}
                    {order.status !== "cancelled" &&
                      order.status !== "delivered" && (
                        <button
                          onClick={() => cancelOrder(order.id)}
                          disabled={updatingId === order.id}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold tracking-wide uppercase text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                  </div>
                </div>

                {/* Order items */}
                <div className="mt-3 pt-3 border-t border-[var(--border)]/50 text-sm text-[var(--muted-foreground)]">
                  {order.items.map((item) => (
                    <span key={item.id} className="mr-3">
                      <span className="font-semibold text-[var(--foreground)]">
                        {item.quantity}x
                      </span>{" "}
                      {item.name}
                      {item.special_instructions && (
                        <span className="italic text-xs">
                          {" "}
                          ({item.special_instructions})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
                {order.notes && (
                  <p className="mt-2 text-xs text-[var(--muted-foreground)] italic">
                    Note: {order.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ========== Menu Tab ==========

interface CategoryWithItems extends MenuCategory {
  items: MenuItem[];
}

function MenuTab() {
  const [facilities, setFacilities] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryWithItems[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category form
  const [catName, setCatName] = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [catSortOrder, setCatSortOrder] = useState(0);

  // Item form (create + edit)
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemSortOrder, setItemSortOrder] = useState(0);

  // Inline editing
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [editCatName, setEditCatName] = useState("");
  const [editCatDescription, setEditCatDescription] = useState("");

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemDescription, setEditItemDescription] = useState("");
  const [editItemPrice, setEditItemPrice] = useState("");

  useEffect(() => {
    async function fetchFacilities() {
      try {
        const res = await fetch("/api/facilities?type=dining");
        if (res.ok) {
          const data = await res.json();
          setFacilities(data.facilities ?? []);
          if (data.facilities?.length > 0) {
            setSelectedFacility(data.facilities[0].id);
          }
        }
      } catch {
        setError("Failed to load facilities");
      } finally {
        setLoading(false);
      }
    }
    fetchFacilities();
  }, []);

  useEffect(() => {
    if (selectedFacility) fetchMenu();
  }, [selectedFacility]);

  async function fetchMenu() {
    if (!selectedFacility) return;
    setLoadingMenu(true);
    try {
      const res = await fetch(
        `/api/dining/menu?facility_id=${selectedFacility}&include_unavailable=true`
      );
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories ?? []);
      }
    } catch {
      setError("Failed to load menu");
    } finally {
      setLoadingMenu(false);
    }
  }

  async function handleCreateCategory() {
    if (!selectedFacility || !catName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dining/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: selectedFacility,
          name: catName.trim(),
          description: catDescription.trim() || undefined,
          sort_order: catSortOrder,
        }),
      });
      if (res.ok) {
        setShowCategoryForm(false);
        setCatName("");
        setCatDescription("");
        setCatSortOrder(0);
        fetchMenu();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create category");
      }
    } catch {
      setError("Failed to create category");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateCategory(categoryId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dining/admin/categories/${categoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editCatName.trim(),
          description: editCatDescription.trim() || undefined,
        }),
      });
      if (res.ok) {
        setEditingCategoryId(null);
        fetchMenu();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update category");
      }
    } catch {
      setError("Failed to update category");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/dining/admin/categories/${categoryId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchMenu();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete category");
      }
    } catch {
      setError("Failed to delete category");
    }
  }

  async function handleCreateItem() {
    if (!formCategoryId || !itemName.trim() || !itemPrice) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dining/admin/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: formCategoryId,
          name: itemName.trim(),
          description: itemDescription.trim() || undefined,
          price: parseFloat(itemPrice),
          sort_order: itemSortOrder,
        }),
      });
      if (res.ok) {
        setShowItemForm(false);
        setItemName("");
        setItemDescription("");
        setItemPrice("");
        setItemSortOrder(0);
        fetchMenu();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create item");
      }
    } catch {
      setError("Failed to create item");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateItem(itemId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dining/admin/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editItemName.trim(),
          description: editItemDescription.trim() || undefined,
          price: parseFloat(editItemPrice),
        }),
      });
      if (res.ok) {
        setEditingItemId(null);
        fetchMenu();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update item");
      }
    } catch {
      setError("Failed to update item");
    } finally {
      setSaving(false);
    }
  }

  async function toggleItemAvailability(itemId: string, available: boolean) {
    // Optimistic update
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        items: cat.items.map((item) =>
          item.id === itemId ? { ...item, is_available: !available } : item
        ),
      }))
    );
    try {
      const res = await fetch(`/api/dining/admin/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: !available }),
      });
      if (!res.ok) {
        setCategories((prev) =>
          prev.map((cat) => ({
            ...cat,
            items: cat.items.map((item) =>
              item.id === itemId
                ? { ...item, is_available: available }
                : item
            ),
          }))
        );
        setError("Failed to update availability");
      }
    } catch {
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          items: cat.items.map((item) =>
            item.id === itemId ? { ...item, is_available: available } : item
          ),
        }))
      );
      setError("Failed to update item");
    }
  }

  async function deleteItem(itemId: string) {
    try {
      await fetch(`/api/dining/admin/items/${itemId}`, {
        method: "DELETE",
      });
      fetchMenu();
    } catch {
      setError("Failed to delete item");
    }
  }

  function startEditCategory(cat: CategoryWithItems) {
    setEditingCategoryId(cat.id);
    setEditCatName(cat.name);
    setEditCatDescription(cat.description || "");
  }

  function startEditItem(item: MenuItem) {
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemDescription(item.description || "");
    setEditItemPrice(String(item.price));
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 w-48 rounded-xl bg-[var(--muted)] animate-pulse" />
        <div className="h-40 rounded-2xl bg-[var(--muted)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-medium flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Facility selector */}
      {facilities.length > 1 && (
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--muted)] w-fit">
          {facilities.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFacility(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                selectedFacility === f.id
                  ? "bg-[var(--surface-lowest)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setShowCategoryForm(true);
            setShowItemForm(false);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-lowest)] px-4 py-2 text-xs font-bold tracking-wide uppercase shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          Category
        </button>
        <button
          onClick={() => {
            setShowItemForm(true);
            setShowCategoryForm(false);
            if (categories.length > 0 && !formCategoryId) {
              setFormCategoryId(categories[0].id);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary-container)] text-white px-4 py-2 text-xs font-bold tracking-wide uppercase hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3.5 w-3.5" />
          Menu Item
        </button>
      </div>

      {/* Add Category Form */}
      {showCategoryForm && (
        <div className="rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[var(--outline-variant)]/30 p-5 space-y-4">
          <p className="font-[family-name:var(--font-headline)] font-bold text-base">
            New Category
          </p>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Category name"
              className={`col-span-2 ${INPUT_CLS}`}
            />
            <input
              type="number"
              value={catSortOrder}
              onChange={(e) => setCatSortOrder(parseInt(e.target.value) || 0)}
              placeholder="Sort order"
              className={INPUT_CLS}
            />
          </div>
          <input
            type="text"
            value={catDescription}
            onChange={(e) => setCatDescription(e.target.value)}
            placeholder="Description (optional)"
            className={`w-full ${INPUT_CLS}`}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateCategory}
              disabled={saving || !catName.trim()}
              className="rounded-xl bg-[var(--primary-container)] text-white px-5 py-2.5 text-xs font-bold tracking-wide uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Category"}
            </button>
            <button
              onClick={() => setShowCategoryForm(false)}
              className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-xs font-semibold hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Item Form */}
      {showItemForm && (
        <div className="rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[var(--outline-variant)]/30 p-5 space-y-4">
          <p className="font-[family-name:var(--font-headline)] font-bold text-base">
            New Menu Item
          </p>
          <div className="grid grid-cols-3 gap-3">
            <select
              value={formCategoryId}
              onChange={(e) => setFormCategoryId(e.target.value)}
              className={INPUT_CLS}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Item name"
              className={INPUT_CLS}
            />
            <input
              type="number"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              placeholder="Price"
              step="0.01"
              className={INPUT_CLS}
            />
          </div>
          <input
            type="text"
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            placeholder="Description (optional)"
            className={`w-full ${INPUT_CLS}`}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateItem}
              disabled={saving || !itemName.trim() || !itemPrice}
              className="rounded-xl bg-[var(--primary-container)] text-white px-5 py-2.5 text-xs font-bold tracking-wide uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Item"}
            </button>
            <button
              onClick={() => setShowItemForm(false)}
              className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-xs font-semibold hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Menu display */}
      {loadingMenu ? (
        <div className="space-y-3">
          <div className="h-40 rounded-2xl bg-[var(--muted)] animate-pulse" />
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[var(--outline-variant)]/30 p-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--muted)] mb-4">
            <BookOpen className="h-7 w-7 text-[var(--muted-foreground)]" />
          </div>
          <p className="font-[family-name:var(--font-headline)] font-bold text-xl">
            No menu categories
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Create a category to start building your menu.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[var(--outline-variant)]/30 overflow-hidden"
            >
              {/* Category header — inline edit or display */}
              <div className="bg-[var(--muted)]/40 px-5 py-3.5 border-b border-[var(--outline-variant)]/20">
                {editingCategoryId === cat.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      className={`w-full text-sm font-bold ${INPUT_CLS}`}
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editCatDescription}
                      onChange={(e) => setEditCatDescription(e.target.value)}
                      placeholder="Description (optional)"
                      className={`w-full text-xs ${INPUT_CLS}`}
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleUpdateCategory(cat.id)}
                        disabled={saving || !editCatName.trim()}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs font-bold uppercase disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" />
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCategoryId(null)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-[family-name:var(--font-headline)] font-bold text-sm">
                        {cat.name}
                      </p>
                      {cat.description && (
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          {cat.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => startEditCategory(cat)}
                        className="rounded-lg border border-[var(--border)] p-1.5 hover:bg-[var(--muted)] transition-colors"
                        title="Edit category"
                      >
                        <Pencil className="h-3 w-3 text-[var(--muted-foreground)]" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="rounded-lg border border-[var(--border)] p-1.5 hover:bg-red-50 hover:border-red-200 transition-colors"
                        title={
                          cat.items.length > 0
                            ? "Remove all items first"
                            : "Delete category"
                        }
                      >
                        <Trash2 className="h-3 w-3 text-[var(--muted-foreground)]" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Category items */}
              {cat.items.length === 0 ? (
                <div className="px-5 py-4 text-sm text-[var(--muted-foreground)]">
                  No items in this category.
                </div>
              ) : (
                <div className="divide-y divide-[var(--outline-variant)]/20">
                  {cat.items.map((item) => (
                    <div
                      key={item.id}
                      className="px-5 py-3.5 hover:bg-[var(--muted)]/20 transition-colors"
                    >
                      {editingItemId === item.id ? (
                        /* Inline item edit */
                        <div className="space-y-2">
                          <div className="grid grid-cols-4 gap-2">
                            <input
                              type="text"
                              value={editItemName}
                              onChange={(e) => setEditItemName(e.target.value)}
                              className={`col-span-2 text-sm ${INPUT_CLS}`}
                              autoFocus
                            />
                            <input
                              type="text"
                              value={editItemDescription}
                              onChange={(e) =>
                                setEditItemDescription(e.target.value)
                              }
                              placeholder="Description"
                              className={`text-sm ${INPUT_CLS}`}
                            />
                            <input
                              type="number"
                              value={editItemPrice}
                              onChange={(e) => setEditItemPrice(e.target.value)}
                              step="0.01"
                              className={`text-sm ${INPUT_CLS}`}
                            />
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleUpdateItem(item.id)}
                              disabled={
                                saving ||
                                !editItemName.trim() ||
                                !editItemPrice
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 px-2.5 py-1 text-xs font-bold uppercase disabled:opacity-50"
                            >
                              <Check className="h-3 w-3" />
                              Save
                            </button>
                            <button
                              onClick={() => setEditingItemId(null)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Normal item display */
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-semibold ${!item.is_available ? "line-through text-[var(--muted-foreground)]" : "text-[var(--foreground)]"}`}
                            >
                              {item.name}
                            </p>
                            {item.description && (
                              <p className="text-xs text-[var(--muted-foreground)] mt-0.5 line-clamp-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-4">
                            <span className="rounded-md bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase">
                              ${Number(item.price).toFixed(2)}
                            </span>
                            <button
                              onClick={() =>
                                toggleItemAvailability(
                                  item.id,
                                  item.is_available
                                )
                              }
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase transition-colors ${
                                item.is_available
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {item.is_available ? (
                                <ToggleRight className="h-3 w-3" />
                              ) : (
                                <ToggleLeft className="h-3 w-3" />
                              )}
                              {item.is_available ? "Available" : "86'd"}
                            </button>
                            <button
                              onClick={() => startEditItem(item)}
                              className="rounded-lg border border-[var(--border)] p-1.5 hover:bg-[var(--muted)] transition-colors"
                              title="Edit item"
                            >
                              <Pencil className="h-3 w-3 text-[var(--muted-foreground)]" />
                            </button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="rounded-lg border border-[var(--border)] p-1.5 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                              title="Delete item"
                            >
                              <Trash2 className="h-3 w-3 text-[var(--muted-foreground)]" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Reservations Tab ==========

function ReservationsTab() {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "all">("upcoming");

  // Edit modal state
  const [editingBooking, setEditingBooking] =
    useState<BookingWithDetails | null>(null);
  const [editPartySize, setEditPartySize] = useState(2);
  const [editNotes, setEditNotes] = useState("");

  async function fetchBookings() {
    try {
      const res = await fetch("/api/bookings?type=dining");
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBookings();
  }, []);

  async function cancelBooking(bookingId: string) {
    setActionId(bookingId);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "PATCH",
      });
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId ? { ...b, status: "cancelled" } : b
          )
        );
      } else {
        const data = await res.json();
        setError(data.error || "Failed to cancel reservation");
      }
    } catch {
      setError("Failed to cancel reservation");
    } finally {
      setActionId(null);
    }
  }

  async function handleModifyBooking() {
    if (!editingBooking) return;
    setActionId(editingBooking.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/bookings/${editingBooking.id}/modify`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            party_size: editPartySize,
            notes: editNotes || undefined,
          }),
        }
      );
      if (res.ok) {
        setEditingBooking(null);
        fetchBookings();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to modify reservation");
      }
    } catch {
      setError("Failed to modify reservation");
    } finally {
      setActionId(null);
    }
  }

  function startEdit(booking: BookingWithDetails) {
    setEditingBooking(booking);
    setEditPartySize(booking.party_size);
    setEditNotes(booking.notes || "");
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function formatTime(timeStr: string) {
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${display}:${m} ${ampm}`;
  }

  const today = new Date().toISOString().split("T")[0];
  const filtered =
    filter === "upcoming"
      ? bookings.filter(
          (b) => b.date >= today && b.status !== "cancelled"
        )
      : bookings;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl bg-[var(--muted)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-medium flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter + count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">
          {filtered.length} reservation{filtered.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--muted)]">
          {(["upcoming", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                filter === f
                  ? "bg-[var(--surface-lowest)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {f === "upcoming" ? "Upcoming" : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editingBooking && (
        <div className="rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[var(--outline-variant)]/30 p-5 space-y-4">
          <p className="font-[family-name:var(--font-headline)] font-bold text-base">
            Edit Reservation — {editingBooking.member_first_name}{" "}
            {editingBooking.member_last_name}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            {editingBooking.facility_name} &middot;{" "}
            {formatDate(editingBooking.date)} &middot;{" "}
            {formatTime(editingBooking.start_time)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase tracking-wide">
                Party Size
              </label>
              <select
                value={editPartySize}
                onChange={(e) => setEditPartySize(parseInt(e.target.value))}
                className={INPUT_CLS}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "guest" : "guests"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1 uppercase tracking-wide">
                Notes
              </label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Special requests..."
                className={`w-full ${INPUT_CLS}`}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleModifyBooking}
              disabled={actionId === editingBooking.id}
              className="rounded-xl bg-[var(--primary-container)] text-white px-5 py-2.5 text-xs font-bold tracking-wide uppercase hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {actionId === editingBooking.id ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={() => setEditingBooking(null)}
              className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-xs font-semibold hover:bg-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[var(--outline-variant)]/30 p-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--muted)] mb-4">
            <CalendarDays className="h-7 w-7 text-[var(--muted-foreground)]" />
          </div>
          <p className="font-[family-name:var(--font-headline)] font-bold text-xl">
            No reservations
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {filter === "upcoming"
              ? "No upcoming dining reservations."
              : "No dining reservations found."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => {
            const isCancelled = booking.status === "cancelled";
            const isPast = booking.date < today;
            const canModify = !isCancelled && !isPast;
            const badge = isCancelled
              ? STATUS_BADGE.cancelled
              : booking.status === "confirmed"
                ? STATUS_BADGE.confirmed
                : STATUS_BADGE.pending;

            return (
              <div
                key={booking.id}
                className={`rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[var(--outline-variant)]/30 p-5 transition-all hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] ${isCancelled ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)]">
                      <UtensilsCrossed className="h-5 w-5 text-[var(--primary)]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-[family-name:var(--font-headline)] font-bold text-base">
                          {booking.member_first_name}{" "}
                          {booking.member_last_name}
                        </p>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${badge.bg} ${badge.text}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${badge.dot}`}
                          />
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--muted-foreground)]">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {booking.facility_name}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(booking.date)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTime(booking.start_time)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          {booking.party_size}{" "}
                          {booking.party_size === 1 ? "guest" : "guests"}
                        </span>
                      </div>
                      {booking.notes && (
                        <p className="text-xs text-[var(--muted-foreground)] mt-1 italic">
                          {booking.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  {canModify && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => startEdit(booking)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-bold tracking-wide uppercase hover:bg-[var(--muted)] transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => cancelBooking(booking.id)}
                        disabled={actionId === booking.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold tracking-wide uppercase text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        <Ban className="h-3 w-3" />
                        {actionId === booking.id ? "..." : "Cancel"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
