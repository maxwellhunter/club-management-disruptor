"use client";

import { useState, useEffect } from "react";
import type {
  DiningOrderWithItems,
  DiningOrderStatus,
  MenuCategory,
  MenuItem,
  BookingWithDetails,
} from "@club/shared";

type AdminTab = "orders" | "menu" | "reservations";

const STATUS_FLOW: Record<string, DiningOrderStatus | null> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "delivered",
  delivered: null,
  cancelled: null,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-orange-100 text-orange-700",
  ready: "bg-green-100 text-green-700",
  delivered: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Confirm",
  confirmed: "Start Preparing",
  preparing: "Mark Ready",
  ready: "Mark Delivered",
};

export default function DiningAdmin() {
  const [tab, setTab] = useState<AdminTab>("orders");

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {(["orders", "menu", "reservations"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {t === "orders"
              ? "Orders"
              : t === "menu"
                ? "Menu"
                : "Reservations"}
          </button>
        ))}
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
      <div className="animate-pulse space-y-3">
        <div className="h-16 rounded-lg bg-[var(--muted)]" />
        <div className="h-16 rounded-lg bg-[var(--muted)]" />
        <div className="h-16 rounded-lg bg-[var(--muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">
          {filtered.length} order{filtered.length !== 1 ? "s" : ""}
        </p>
        <div className="flex gap-1">
          {(["active", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              {f === "active" ? "Active" : "All"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            No {filter === "active" ? "active " : ""}orders.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => {
            const nextStatus = STATUS_FLOW[order.status];
            return (
              <div
                key={order.id}
                className="rounded-xl border border-[var(--border)] p-4 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">
                        {order.member_first_name} {order.member_last_name}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status]}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {order.facility_name}
                      {order.table_number && ` · Table ${order.table_number}`}
                      {" · "}${Number(order.total).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {nextStatus && (
                      <button
                        onClick={() => advanceStatus(order.id, nextStatus)}
                        disabled={updatingId === order.id}
                        className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {updatingId === order.id
                          ? "..."
                          : STATUS_LABELS[order.status]}
                      </button>
                    )}
                    {order.status !== "cancelled" &&
                      order.status !== "delivered" && (
                        <button
                          onClick={() => cancelOrder(order.id)}
                          disabled={updatingId === order.id}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                  </div>
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {order.items.map((item) => (
                    <span key={item.id} className="mr-3">
                      {item.quantity}x {item.name}
                      {item.special_instructions && (
                        <span className="italic">
                          {" "}
                          ({item.special_instructions})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
                {order.notes && (
                  <p className="text-xs text-[var(--muted-foreground)] italic">
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

  // Item form
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemSortOrder, setItemSortOrder] = useState(0);

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
        `/api/dining/menu?facility_id=${selectedFacility}`
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

  async function toggleItemAvailability(itemId: string, available: boolean) {
    try {
      await fetch(`/api/dining/admin/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: !available }),
      });
      fetchMenu();
    } catch {
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

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-10 w-48 rounded bg-[var(--muted)]" />
        <div className="h-32 rounded-lg bg-[var(--muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Facility selector */}
      {facilities.length > 1 && (
        <div className="flex gap-1.5">
          {facilities.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFacility(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                selectedFacility === f.id
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)]"
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
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--primary)] transition-colors"
        >
          + Category
        </button>
        <button
          onClick={() => {
            setShowItemForm(true);
            setShowCategoryForm(false);
            if (categories.length > 0 && !formCategoryId) {
              setFormCategoryId(categories[0].id);
            }
          }}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--primary)] transition-colors"
        >
          + Menu Item
        </button>
      </div>

      {/* Add Category Form */}
      {showCategoryForm && (
        <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
          <p className="text-sm font-medium">New Category</p>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Category name"
              className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <input
              type="number"
              value={catSortOrder}
              onChange={(e) => setCatSortOrder(parseInt(e.target.value) || 0)}
              placeholder="Sort order"
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <input
            type="text"
            value={catDescription}
            onChange={(e) => setCatDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateCategory}
              disabled={saving || !catName.trim()}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Category"}
            </button>
            <button
              onClick={() => setShowCategoryForm(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Item Form */}
      {showItemForm && (
        <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
          <p className="text-sm font-medium">New Menu Item</p>
          <div className="grid grid-cols-3 gap-3">
            <select
              value={formCategoryId}
              onChange={(e) => setFormCategoryId(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
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
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <input
              type="number"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              placeholder="Price"
              step="0.01"
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <input
            type="text"
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateItem}
              disabled={saving || !itemName.trim() || !itemPrice}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Item"}
            </button>
            <button
              onClick={() => setShowItemForm(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Menu display */}
      {loadingMenu ? (
        <div className="animate-pulse space-y-3">
          <div className="h-32 rounded-lg bg-[var(--muted)]" />
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            No menu categories yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="rounded-xl border border-[var(--border)] overflow-hidden"
            >
              <div className="bg-[var(--muted)]/30 px-4 py-2.5 border-b border-[var(--border)]">
                <p className="text-sm font-semibold">{cat.name}</p>
                {cat.description && (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {cat.description}
                  </p>
                )}
              </div>
              {cat.items.length === 0 ? (
                <div className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                  No items in this category.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {cat.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-4 py-2.5"
                    >
                      <div>
                        <p
                          className={`text-sm font-medium ${!item.is_available ? "line-through text-[var(--muted-foreground)]" : "text-[var(--foreground)]"}`}
                        >
                          {item.name}
                        </p>
                        {item.description && (
                          <p className="text-xs text-[var(--muted-foreground)]">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">
                          ${Number(item.price).toFixed(2)}
                        </span>
                        <button
                          onClick={() =>
                            toggleItemAvailability(
                              item.id,
                              item.is_available
                            )
                          }
                          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                            item.is_available
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {item.is_available ? "Available" : "Unavailable"}
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
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

  useEffect(() => {
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
    fetchBookings();
  }, []);

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

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-16 rounded-lg bg-[var(--muted)]" />
        <div className="h-16 rounded-lg bg-[var(--muted)]" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-8 text-center">
        <p className="text-sm text-[var(--muted-foreground)]">
          No dining reservations found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bookings.map((booking) => (
        <div
          key={booking.id}
          className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-lg">
              🍽️
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {booking.member_first_name} {booking.member_last_name}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {booking.facility_name} &middot;{" "}
                {formatDate(booking.date)} &middot;{" "}
                {formatTime(booking.start_time)} &middot;{" "}
                {booking.party_size}{" "}
                {booking.party_size === 1 ? "guest" : "guests"}
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              booking.status === "confirmed"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {booking.status}
          </span>
        </div>
      ))}
    </div>
  );
}
