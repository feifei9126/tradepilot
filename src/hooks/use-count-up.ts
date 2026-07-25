"use client";

import { useState, useEffect, useRef } from "react";

interface UseCountUpOptions {
  /** Target number to animate to */
  end: number;
  /** Duration in milliseconds (default 1200) */
  duration?: number;
  /** Start counting once (default true) */
  start?: boolean;
  /** Decimal places (default 0) */
  decimals?: number;
  /** Format as currency with prefix */
  prefix?: string;
  /** Text appended after the formatted value */
  suffix?: string;
}

export function useCountUp({
  end,
  duration = 1200,
  start = true,
  decimals = 0,
  prefix = "",
  suffix = "",
}: UseCountUpOptions) {
  const [display, setDisplay] = useState("0");
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  useEffect(() => {
    if (!start || end === 0) {
      rafRef.current = requestAnimationFrame(() => setDisplay(formatValue(end, decimals, prefix, suffix)));
      return () => cancelAnimationFrame(rafRef.current);
    }

    if (reducedMotion.current) {
      rafRef.current = requestAnimationFrame(() => setDisplay(formatValue(end, decimals, prefix, suffix)));
      return () => cancelAnimationFrame(rafRef.current);
    }

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // ease-out quartic
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = eased * end;

      setDisplay(formatValue(current, decimals, prefix, suffix));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startTimeRef.current = 0;
    };
  }, [end, duration, start, decimals, prefix, suffix]);

  return display;
}

function formatValue(value: number, decimals: number, prefix: string, suffix: string): string {
  const fixed = value.toFixed(decimals);
  const parts = fixed.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return prefix + parts.join(".") + suffix;
}
