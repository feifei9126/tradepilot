"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "tradepilot_sidebar_order";
const HIDDEN_KEY = "tradepilot_sidebar_hidden";

function readStringArray(key: string) {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed)
      ? [
          ...new Set(
            parsed.filter((item): item is string => typeof item === "string"),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

export function getSidebarOrder(): string[] {
  if (typeof window === "undefined") return [];
  return readStringArray(STORAGE_KEY);
}

export function getHiddenItems(): string[] {
  if (typeof window === "undefined") return [];
  return readStringArray(HIDDEN_KEY);
}

export function saveSidebarConfig(order: string[], hidden: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
  } catch {}
}

export function resetSidebarConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HIDDEN_KEY);
  } catch {}
}

// Default order for all nav items
export const DEFAULT_ORDER = [
  "/app",
  "/app/contacts",
  "/app/products",
  "/app/product-video",
  "/app/inquiries",
  "/app/quotations",
  "/app/orders",
  "/app/suppliers",
  "/app/email",
  "/app/email/settings",
  "/app/settings/payments",
  "/app/bind",
  "/app/messages",
  "/app/leads",
  "/app/shipments",
  "/app/logistics",
  "/app/finance",
  "/app/reports",
  "/app/documents",
  "/app/plugins",
  "/app/settings",
];

// Hook to use sidebar config
export function useSidebarConfig(defaultOrder: string[]) {
  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [hidden, setHidden] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedOrder = getSidebarOrder();
      const savedHidden = getHiddenItems();
      const knownItems = new Set(defaultOrder);
      const validSavedOrder = savedOrder.filter((item) => knownItems.has(item));
      const mergedOrder = [
        ...validSavedOrder,
        ...defaultOrder.filter((item) => !validSavedOrder.includes(item)),
      ];
      setOrder(mergedOrder);
      setHidden(savedHidden.filter((item) => knownItems.has(item)));
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [defaultOrder]);

  const updateOrder = useCallback(
    (newOrder: string[]) => {
      setOrder(newOrder);
      saveSidebarConfig(newOrder, hidden);
    },
    [hidden],
  );

  const toggleVisibility = useCallback(
    (href: string) => {
      const newHidden = hidden.includes(href)
        ? hidden.filter((h) => h !== href)
        : [...hidden, href];
      setHidden(newHidden);
      saveSidebarConfig(order, newHidden);
    },
    [order, hidden],
  );

  const moveUp = useCallback(
    (href: string) => {
      const idx = order.indexOf(href);
      if (idx <= 0) return;
      const newOrder = [...order];
      [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
      setOrder(newOrder);
      saveSidebarConfig(newOrder, hidden);
    },
    [order, hidden],
  );

  const moveDown = useCallback(
    (href: string) => {
      const idx = order.indexOf(href);
      if (idx < 0 || idx >= order.length - 1) return;
      const newOrder = [...order];
      [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
      setOrder(newOrder);
      saveSidebarConfig(newOrder, hidden);
    },
    [order, hidden],
  );

  const reset = useCallback(() => {
    resetSidebarConfig();
    setOrder(defaultOrder);
    setHidden([]);
  }, [defaultOrder]);

  return {
    order,
    hidden,
    loaded,
    updateOrder,
    toggleVisibility,
    moveUp,
    moveDown,
    reset,
  };
}
