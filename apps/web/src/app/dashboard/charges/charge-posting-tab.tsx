"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Plus, Minus, Trash2, ShoppingCart } from "lucide-react";

interface SearchMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  tier_name: string | null;
  tier_level: string | null;
}

interface PosConfig {
  id: string;
  name: string;
  location_type: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category_name?: string;
}

interface CartItem {
  id: string;
  name: string;
  qty: number;
  unit_price: number;
}

interface MemberTab {
  total: number;
  charge_count: number;
}

const TAX_RATE = 0.08;

export default function ChargePostingTab() {
  // Member search
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedMember, setSelectedMember] = useState<SearchMember | null>(
    null
  );
  const [memberTab, setMemberTab] = useState<MemberTab | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Location
  const [posConfigs, setPosConfigs] = useState<PosConfig[]>([]);
  const [selectedPos, setSelectedPos] = useState<string>("");
  const [loadingPos, setLoadingPos] = useState(true);

  // Menu items
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tip, setTip] = useState<string>("");
  const [description, setDescription] = useState("");

  // Manual entry
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualPrice, setManualPrice] = useState("");

  // Posting
  const [posting, setPosting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load POS configs and menu items on mount
  useEffect(() => {
    async function fetchPosConfigs() {
      try {
        const res = await fetch("/api/pos/config");
        if (res.ok) {
          const data = await res.json();
          setPosConfigs(data.configs ?? data ?? []);
        }
      } catch {
        // silent
      } finally {
        setLoadingPos(false);
      }
    }

    async function fetchMenu() {
      try {
        const res = await fetch("/api/dining/menu");
        if (res.ok) {
          const data = await res.json();
          // Flatten categories into items
          const items: MenuItem[] = [];
          if (Array.isArray(data.categories)) {
            for (const cat of data.categories) {
              if (Array.isArray(cat.items)) {
                for (const item of cat.items) {
                  items.push({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    category_name: cat.name,
                  });
                }
              }
            }
          } else if (Array.isArray(data.items)) {
            items.push(...data.items);
          } else if (Array.isArray(data)) {
            items.push(...data);
          }
          setMenuItems(items);
        }
      } catch {
        // silent
      } finally {
        setLoadingMenu(false);
      }
    }

    fetchPosConfigs();
    fetchMenu();
  }, []);

  // Click outside to close search dropdown
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch member tab when member is selected
  const fetchMemberTab = useCallback(async (memberId: string) => {
    try {
      const res = await fetch(
        `/api/pos/charges/tab?member_id=${memberId}`
      );
      if (res.ok) {
        const data = await res.json();
        setMemberTab({
          total: data.total ?? 0,
          charge_count: data.charge_count ?? data.charges?.length ?? 0,
        });
      }
    } catch {
      // silent
    }
  }, []);

  // Debounced member search
  const searchMembers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/members/search?q=${encodeURIComponent(query)}&limit=8`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.members ?? []);
      }
    } catch {
      // silent
    } finally {
      setSearching(false);
    }
  }, []);

  function handleSearchInput(value: string) {
    setMemberSearch(value);
    setShowDropdown(true);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchMembers(value), 300);
  }

  function selectMember(member: SearchMember) {
    setSelectedMember(member);
    setMemberSearch("");
    setSearchResults([]);
    setShowDropdown(false);
    fetchMemberTab(member.id);
  }

  function clearMember() {
    setSelectedMember(null);
    setMemberTab(null);
    setMemberSearch("");
  }

  // Cart functions
  function addToCart(item: { name: string; price: number }) {
    setCart((prev) => {
      const existing = prev.find(
        (c) => c.name === item.name && c.unit_price === item.price
      );
      if (existing) {
        return prev.map((c) =>
          c.id === existing.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          name: item.name,
          qty: 1,
          unit_price: item.price,
        },
      ];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c))
        .filter((c) => c.qty > 0)
    );
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }

  function addManualItem() {
    const name = manualName.trim();
    const qty = parseInt(manualQty) || 1;
    const price = parseFloat(manualPrice);
    if (!name || isNaN(price) || price <= 0) return;
    setCart((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}-${Math.random()}`,
        name,
        qty,
        unit_price: price,
      },
    ]);
    setManualName("");
    setManualQty("1");
    setManualPrice("");
  }

  // Totals
  const subtotal = cart.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
  const tax = subtotal * TAX_RATE;
  const tipAmount = parseFloat(tip) || 0;
  const grandTotal = subtotal + tax + tipAmount;

  // Post charge
  async function handlePostCharge() {
    if (!selectedMember || !selectedPos || cart.length === 0) return;

    setPosting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/pos/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: selectedMember.id,
          pos_config_id: selectedPos,
          items: cart.map((c) => ({
            name: c.name,
            quantity: c.qty,
            unit_price: c.unit_price,
            total: c.qty * c.unit_price,
          })),
          subtotal,
          tax,
          tip: tipAmount,
          description: description.trim() || undefined,
        }),
      });

      if (res.ok) {
        setSuccessMessage(
          `Charge of $${grandTotal.toFixed(2)} posted to ${selectedMember.first_name} ${selectedMember.last_name}'s account.`
        );
        setCart([]);
        setTip("");
        setDescription("");
        fetchMemberTab(selectedMember.id);
        // Auto-dismiss success after 5s
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Failed to post charge.");
      }
    } catch {
      setErrorMessage("Failed to post charge. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  const locationBadgeColor: Record<string, string> = {
    dining: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    bar: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    pro_shop: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    snack_bar: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column: Member + Location + Items */}
      <div className="lg:col-span-2 space-y-5">
        {/* Success banner */}
        {successMessage && (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-300 flex items-center justify-between">
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-500 hover:text-green-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Error banner */}
        {errorMessage && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 1: Select Member */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h3 className="text-sm font-semibold mb-3">1. Select Member</h3>

          {selectedMember ? (
            <div className="flex items-center justify-between rounded-lg bg-[var(--muted)] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-bold">
                  {selectedMember.first_name[0]}
                  {selectedMember.last_name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {selectedMember.first_name} {selectedMember.last_name}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {selectedMember.tier_name ?? "Member"}
                    {memberTab
                      ? ` -- This month: $${memberTab.total.toFixed(2)} (${memberTab.charge_count} charges)`
                      : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={clearMember}
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div ref={searchRef} className="relative">
              <div className="flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-900 focus-within:ring-2 focus-within:ring-[var(--ring)]">
                <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => {
                    if (memberSearch.length >= 2) setShowDropdown(true);
                  }}
                  placeholder="Search by name or email..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
                />
                {searching && (
                  <div className="animate-spin h-4 w-4 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
                )}
              </div>

              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg max-h-56 overflow-auto">
                  {searchResults.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => selectMember(member)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--muted)] transition-colors"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold">
                        {member.first_name[0]}
                        {member.last_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.first_name} {member.last_name}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] truncate">
                          {member.tier_name ?? "Member"} &middot; {member.email}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showDropdown &&
                memberSearch.length >= 2 &&
                !searching &&
                searchResults.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg px-3 py-3 text-sm text-[var(--muted-foreground)] text-center">
                    No members found
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Step 2: Select Location */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h3 className="text-sm font-semibold mb-3">2. Select Location</h3>
          {loadingPos ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {posConfigs.map((config) => (
                <button
                  key={config.id}
                  onClick={() => setSelectedPos(config.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all border ${
                    selectedPos === config.id
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "border-zinc-200 dark:border-zinc-700 text-[var(--foreground)] hover:border-[var(--primary)]"
                  }`}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full mr-2 ${
                      locationBadgeColor[config.location_type]
                        ? locationBadgeColor[config.location_type].split(" ")[0]
                        : "bg-gray-300"
                    }`}
                  />
                  {config.name}
                </button>
              ))}
              {posConfigs.length === 0 && (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No POS locations configured.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Add Items */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h3 className="text-sm font-semibold mb-3">3. Add Items</h3>

          {/* Quick items grid */}
          {loadingMenu ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full" />
            </div>
          ) : menuItems.length > 0 ? (
            <div className="mb-4">
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2 uppercase tracking-wider">
                Quick Add
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {menuItems.slice(0, 12).map((item) => (
                  <button
                    key={item.id}
                    onClick={() =>
                      addToCart({ name: item.name, price: item.price })
                    }
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-2.5 text-left hover:border-[var(--primary)] hover:shadow-sm transition-all"
                  >
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-[var(--primary)] font-semibold mt-0.5">
                      ${item.price.toFixed(2)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Manual entry */}
          <div>
            <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2 uppercase tracking-wider">
              Manual Entry
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-[var(--muted-foreground)]">
                  Item name
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addManualItem();
                  }}
                  placeholder="e.g., Draft Beer"
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
              <div className="w-16">
                <label className="text-xs text-[var(--muted-foreground)]">
                  Qty
                </label>
                <input
                  type="number"
                  min="1"
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value)}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
              <div className="w-24">
                <label className="text-xs text-[var(--muted-foreground)]">
                  Price
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addManualItem();
                  }}
                  placeholder="0.00"
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
              <button
                onClick={addManualItem}
                disabled={
                  !manualName.trim() ||
                  !manualPrice ||
                  parseFloat(manualPrice) <= 0
                }
                className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right column: Cart */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 sticky top-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-4 w-4 text-[var(--muted-foreground)]" />
            <h3 className="text-sm font-semibold">Cart</h3>
            {cart.length > 0 && (
              <span className="ml-auto text-xs bg-[var(--primary)] text-[var(--primary-foreground)] rounded-full px-2 py-0.5 font-medium">
                {cart.reduce((sum, c) => sum + c.qty, 0)} items
              </span>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-8 w-8 text-[var(--muted-foreground)]/30 mx-auto mb-2" />
              <p className="text-sm text-[var(--muted-foreground)]">
                Cart is empty
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Add items from the menu or enter manually
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Cart items */}
              <div className="space-y-2 max-h-64 overflow-auto">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg bg-[var(--muted)] p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        ${item.unit_price.toFixed(2)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--background)] transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-medium w-6 text-center tabular-nums">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--background)] transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-sm font-semibold tabular-nums w-16 text-right">
                      ${(item.qty * item.unit_price).toFixed(2)}
                    </p>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="rounded p-1 text-[var(--muted-foreground)] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--muted-foreground)]">
                    Subtotal
                  </span>
                  <span className="font-medium tabular-nums">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--muted-foreground)]">
                    Tax (8%)
                  </span>
                  <span className="font-medium tabular-nums">
                    ${tax.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-[var(--muted-foreground)]">Tip</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-[var(--muted-foreground)]">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tip}
                      onChange={(e) => setTip(e.target.value)}
                      placeholder="0.00"
                      className="w-20 border border-zinc-300 dark:border-zinc-700 rounded-md px-2 py-1 bg-white dark:bg-zinc-900 text-sm text-right outline-none focus:ring-2 focus:ring-[var(--ring)] tabular-nums"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-zinc-200 dark:border-zinc-700">
                  <span>Total</span>
                  <span className="tabular-nums">
                    ${grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Note (optional)"
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>

              {/* Post button */}
              <button
                onClick={handlePostCharge}
                disabled={posting || !selectedMember || !selectedPos}
                className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {posting
                  ? "Posting..."
                  : !selectedMember
                    ? "Select a member first"
                    : !selectedPos
                      ? "Select a location first"
                      : `Post Charge -- $${grandTotal.toFixed(2)}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
