"use client";

import { useState, useEffect } from "react";
import type { MenuItem, MenuCategory } from "@club/shared";

interface Facility {
  id: string;
  name: string;
  type: string;
  description: string | null;
}

interface CartItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  special_instructions: string;
}

interface MenuOrderProps {
  onOrdered: () => void;
  onClose: () => void;
}

type Step = "venue" | "menu" | "cart";

const TAX_RATE = 0.08;

export default function MenuOrder({ onOrdered, onClose }: MenuOrderProps) {
  const [step, setStep] = useState<Step>("venue");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(
    null
  );
  const [categories, setCategories] = useState<
    (MenuCategory & { items: MenuItem[] })[]
  >([]);
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFacilities() {
      try {
        const res = await fetch("/api/facilities?type=dining");
        if (res.ok) {
          const data = await res.json();
          setFacilities(data.facilities);
        }
      } catch {
        setError("Failed to load dining venues");
      } finally {
        setLoadingFacilities(false);
      }
    }
    fetchFacilities();
  }, []);

  async function fetchMenu(facilityId: string) {
    setLoadingMenu(true);
    setError(null);
    try {
      const res = await fetch(`/api/dining/menu?facility_id=${facilityId}`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
        if (data.categories.length > 0) {
          setSelectedCategory(data.categories[0].id);
        }
      } else {
        setError("Failed to load menu");
      }
    } catch {
      setError("Failed to load menu");
    } finally {
      setLoadingMenu(false);
    }
  }

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menu_item_id === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          special_instructions: "",
        },
      ];
    });
  }

  function updateQuantity(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menu_item_id === menuItemId
            ? { ...c, quantity: c.quantity + delta }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  }

  function updateInstructions(menuItemId: string, instructions: string) {
    setCart((prev) =>
      prev.map((c) =>
        c.menu_item_id === menuItemId
          ? { ...c, special_instructions: instructions }
          : c
      )
    );
  }

  const subtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  async function handlePlaceOrder() {
    if (!selectedFacility || cart.length === 0) return;
    setPlacing(true);
    setError(null);
    try {
      const res = await fetch("/api/dining/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: selectedFacility.id,
          table_number: tableNumber || undefined,
          notes: orderNotes || undefined,
          items: cart.map((c) => ({
            menu_item_id: c.menu_item_id,
            quantity: c.quantity,
            special_instructions: c.special_instructions || undefined,
          })),
        }),
      });

      if (res.ok) {
        onOrdered();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to place order");
      }
    } catch {
      setError("Failed to place order");
    } finally {
      setPlacing(false);
    }
  }

  function formatPrice(price: number) {
    return `$${price.toFixed(2)}`;
  }

  const activeCategory = categories.find((c) => c.id === selectedCategory);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Order Food</h2>
          {step !== "venue" && selectedFacility && (
            <span className="text-xs text-[var(--muted-foreground)]">
              — {selectedFacility.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {step === "menu" && cartCount > 0 && (
            <button
              onClick={() => setStep("cart")}
              className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
            >
              Cart ({cartCount})
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-[var(--muted)] text-[var(--muted-foreground)] text-lg leading-none"
          >
            &times;
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Step 1: Select Venue */}
      {step === "venue" && (
        <div className="p-5 space-y-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            Select a dining venue
          </p>
          {loadingFacilities ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
            </div>
          ) : facilities.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] py-4">
              No dining venues available.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {facilities.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setSelectedFacility(f);
                    setStep("menu");
                    fetchMenu(f.id);
                  }}
                  className="rounded-xl border border-[var(--border)] p-4 text-left transition-all hover:border-[var(--primary)] hover:shadow-sm"
                >
                  <p className="text-2xl mb-2">🍽️</p>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {f.name}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    {f.description}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Browse Menu */}
      {step === "menu" && (
        <div className="p-5 space-y-4">
          <button
            onClick={() => {
              setStep("venue");
              setSelectedFacility(null);
              setCategories([]);
              setCart([]);
            }}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            &larr; Back
          </button>

          {loadingMenu ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
            </div>
          ) : categories.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] py-4">
              No menu items available.
            </p>
          ) : (
            <>
              {/* Category tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      selectedCategory === cat.id
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)]"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Items grid */}
              {activeCategory && (
                <div className="space-y-2">
                  {activeCategory.items.map((item) => {
                    const inCart = cart.find(
                      (c) => c.menu_item_id === item.id
                    );
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-medium text-[var(--foreground)]">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">
                              {item.description}
                            </p>
                          )}
                          <p className="text-sm font-semibold text-[var(--primary)] mt-1">
                            {formatPrice(item.price)}
                          </p>
                        </div>
                        {inCart ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="h-7 w-7 rounded-md border border-[var(--border)] text-sm font-medium hover:bg-[var(--muted)]"
                            >
                              -
                            </button>
                            <span className="text-sm font-medium w-5 text-center">
                              {inCart.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="h-7 w-7 rounded-md border border-[var(--border)] text-sm font-medium hover:bg-[var(--muted)]"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(item)}
                            className="rounded-lg border border-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] transition-colors"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 3: Cart / Checkout */}
      {step === "cart" && (
        <div className="p-5 space-y-4">
          <button
            onClick={() => setStep("menu")}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            &larr; Back to menu
          </button>

          {cart.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] py-4">
              Your cart is empty.
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.menu_item_id}
                    className="rounded-lg border border-[var(--border)] p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {item.name}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {formatPrice(item.price)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateQuantity(item.menu_item_id, -1)
                          }
                          className="h-7 w-7 rounded-md border border-[var(--border)] text-sm font-medium hover:bg-[var(--muted)]"
                        >
                          -
                        </button>
                        <span className="text-sm font-medium w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.menu_item_id, 1)
                          }
                          className="h-7 w-7 rounded-md border border-[var(--border)] text-sm font-medium hover:bg-[var(--muted)]"
                        >
                          +
                        </button>
                        <span className="text-sm font-semibold w-16 text-right">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={item.special_instructions}
                      onChange={(e) =>
                        updateInstructions(
                          item.menu_item_id,
                          e.target.value
                        )
                      }
                      placeholder="Special instructions..."
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[var(--ring)]"
                    />
                  </div>
                ))}
              </div>

              <div className="border-t border-[var(--border)] pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Table Number{" "}
                      <span className="font-normal text-[var(--muted-foreground)]">
                        (optional)
                      </span>
                    </p>
                    <input
                      type="text"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder="e.g., 12"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Notes{" "}
                      <span className="font-normal text-[var(--muted-foreground)]">
                        (optional)
                      </span>
                    </p>
                    <input
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="e.g., Allergies"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-[var(--muted-foreground)]">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--muted-foreground)]">
                    <span>Tax (8%)</span>
                    <span>{formatPrice(tax)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-[var(--foreground)] pt-1 border-t border-[var(--border)]">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={placing || cart.length === 0}
                  className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {placing
                    ? "Placing Order..."
                    : `Place Order — ${formatPrice(total)}`}
                </button>
                <p className="text-xs text-center text-[var(--muted-foreground)]">
                  Charged to your member account
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
