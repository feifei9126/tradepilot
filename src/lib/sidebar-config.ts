"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "tradepilot_sidebar_order";
const HIDDEN_KEY = "tradepilot_sidebar_hidden";

export function getSidebarOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

export function getHiddenItems(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(HIDDEN_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
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
  "/app", "/app/contacts", "/app/products", "/app/inquiries",
  "/app/quotations", "/app/orders", "/app/suppliers",
  "/app/email", "/app/bind", "/app/messages", "/app/leads",
  "/app/shipments", "/app/logistics", "/app/finance",
  "/app/reports", "/app/documents", "/app/plugins", "/app/settings",
];

// Hook to use sidebar config
export function useSidebarConfig(defaultOrder: string[]) {
  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [hidden, setHidden] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const savedOrder = getSidebarOrder();
    const savedHidden = getHiddenItems();
    setOrder(savedOrder.length > 0 ? savedOrder : defaultOrder);
    setHidden(savedHidden);
    setLoaded(true);
  }, []);

  const updateOrder = useCallback((newOrder: string[]) => {
    setOrder(newOrder);
    saveSidebarConfig(newOrder, hidden);
  }, [hidden]);

  const toggleVisibility = useCallback((href: string) => {
    const newHidden = hidden.includes(href)
      ? hidden.filter(h => h !== href)
      : [...hidden, href];
    setHidden(newHidden);
    saveSidebarConfig(order, newHidden);
  }, [order, hidden]);

  const moveUp = useCallback((href: string) => {
    const idx = order.indexOf(href);
    if (idx <= 0) return;
    const newOrder = [...order];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    setOrder(newOrder);
    saveSidebarConfig(newOrder, hidden);
  }, [order, hidden]);

  const moveDown = useCallback((href: string) => {
    const idx = order.indexOf(href);
    if (idx < 0 || idx >= order.length - 1) return;
    const newOrder = [...order];
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    setOrder(newOrder);
    saveSidebarConfig(newOrder, hidden);
  }, [order, hidden]);

  const reset = useCallback(() => {
    resetSidebarConfig();
    setOrder(defaultOrder);
    setHidden([]);
  }, []);

  return { order, hidden, loaded, updateOrder, toggleVisibility, moveUp, moveDown, reset };
}
