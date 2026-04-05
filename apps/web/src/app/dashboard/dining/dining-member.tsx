"use client";

import { useState } from "react";
import { UtensilsCrossed, ShoppingBag } from "lucide-react";
import ReservationBooking from "./reservation-booking";
import MenuOrder from "./menu-order";
import MyDining from "./my-dining";

export default function DiningMember() {
  const [showReservation, setShowReservation] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      {/* Action cards */}
      {!showReservation && !showOrder && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setShowReservation(true)}
            className="group rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[var(--outline-variant)]/30 p-6 text-left transition-all"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] mb-3">
              <UtensilsCrossed className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <p className="font-[family-name:var(--font-headline)] font-bold text-base text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
              Reserve a Table
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Book a dining reservation
            </p>
          </button>
          <button
            onClick={() => setShowOrder(true)}
            className="group rounded-2xl bg-[var(--surface-lowest)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[var(--outline-variant)]/30 p-6 text-left transition-all"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--tertiary-fixed)] mb-3">
              <ShoppingBag className="h-5 w-5 text-[var(--tertiary)]" />
            </div>
            <p className="font-[family-name:var(--font-headline)] font-bold text-base text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
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
