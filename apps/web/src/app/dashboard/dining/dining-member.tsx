"use client";

import { useState } from "react";
import ReservationBooking from "./reservation-booking";
import MenuOrder from "./menu-order";
import MyDining from "./my-dining";

export default function DiningMember() {
  const [showReservation, setShowReservation] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      {!showReservation && !showOrder && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setShowReservation(true)}
            className="rounded-xl border border-[var(--border)] p-6 text-left transition-all hover:border-[var(--primary)] hover:shadow-sm"
          >
            <p className="text-2xl mb-2">🍽️</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Reserve a Table
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Book a dining reservation
            </p>
          </button>
          <button
            onClick={() => setShowOrder(true)}
            className="rounded-xl border border-[var(--border)] p-6 text-left transition-all hover:border-[var(--primary)] hover:shadow-sm"
          >
            <p className="text-2xl mb-2">📋</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Order Food
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Browse menu and order to your table
            </p>
          </button>
        </div>
      )}

      {/* Reservation flow */}
      {showReservation && (
        <ReservationBooking
          onBooked={() => {
            setShowReservation(false);
            setRefreshKey((k) => k + 1);
          }}
          onClose={() => setShowReservation(false)}
        />
      )}

      {/* Order flow */}
      {showOrder && (
        <MenuOrder
          onOrdered={() => {
            setShowOrder(false);
            setRefreshKey((k) => k + 1);
          }}
          onClose={() => setShowOrder(false)}
        />
      )}

      {/* My reservations and orders */}
      <MyDining key={refreshKey} />
    </div>
  );
}
