"use client";

import { useState, useEffect } from "react";
import type { BookingWithDetails, DiningOrderWithItems } from "@club/shared";

export default function MyDining() {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [orders, setOrders] = useState<DiningOrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingBooking, setCancellingBooking] = useState<string | null>(
    null
  );
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);

  async function fetchData() {
    try {
      const [bookingsRes, ordersRes] = await Promise.all([
        fetch("/api/bookings/my"),
        fetch("/api/dining/orders/my"),
      ]);

      if (bookingsRes.ok) {
        const data = await bookingsRes.json();
        // Filter to dining bookings only
        setBookings(
          (data.bookings ?? []).filter(
            (b: BookingWithDetails) => b.facility_type === "dining"
          )
        );
      }

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch dining data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleCancelBooking(bookingId: string) {
    setCancellingBooking(bookingId);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "PATCH",
      });
      if (res.ok) {
        setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      }
    } catch (err) {
      console.error("Failed to cancel booking:", err);
    } finally {
      setCancellingBooking(null);
    }
  }

  async function handleCancelOrder(orderId: string) {
    setCancellingOrder(orderId);
    try {
      const res = await fetch(`/api/dining/orders/${orderId}/cancel`, {
        method: "PATCH",
      });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      }
    } catch (err) {
      console.error("Failed to cancel order:", err);
    } finally {
      setCancellingOrder(null);
    }
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

  function formatPrice(price: number) {
    return `$${Number(price).toFixed(2)}`;
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    confirmed: "bg-blue-100 text-blue-700",
    preparing: "bg-orange-100 text-orange-700",
    ready: "bg-green-100 text-green-700",
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 rounded bg-[var(--muted)]" />
          <div className="h-16 rounded bg-[var(--muted)]" />
          <div className="h-16 rounded bg-[var(--muted)]" />
        </div>
      </div>
    );
  }

  if (bookings.length === 0 && orders.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-8 text-center">
        <p className="text-3xl mb-2">🍽️</p>
        <p className="font-medium text-[var(--foreground)]">
          No dining activity
        </p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Reserve a table or place an order to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Upcoming Reservations */}
      {bookings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Upcoming Reservations</h2>
          <div className="space-y-2">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3 transition-colors hover:bg-[var(--muted)]/30"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-lg">
                    🍽️
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {booking.facility_name}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {formatDate(booking.date)} &middot;{" "}
                      {formatTime(booking.start_time)} &middot;{" "}
                      {booking.party_size}{" "}
                      {booking.party_size === 1 ? "guest" : "guests"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelBooking(booking.id)}
                  disabled={cancellingBooking === booking.id}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                >
                  {cancellingBooking === booking.id
                    ? "Cancelling..."
                    : "Cancel"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Orders */}
      {orders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Active Orders</h2>
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-[var(--border)] px-4 py-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {order.facility_name}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {order.items.length} item
                        {order.items.length !== 1 ? "s" : ""} &middot;{" "}
                        {formatPrice(order.total)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[order.status] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {order.status}
                    </span>
                    {order.status === "pending" && (
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        disabled={cancellingOrder === order.id}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                      >
                        {cancellingOrder === order.id
                          ? "Cancelling..."
                          : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {order.items.map((item) => (
                    <span key={item.id} className="mr-3">
                      {item.quantity}x {item.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
