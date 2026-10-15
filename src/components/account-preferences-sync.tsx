"use client";

import { useEffect } from "react";
import { setLocale, type Locale } from "@/lib/i18n";

/** Restore the account's language preference on this browser after sign-in. */
export function AccountPreferencesSync() {
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/account", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((profile: { locale?: Locale } | null) => {
        if (!controller.signal.aborted && (profile?.locale === "zh" || profile?.locale === "en")) {
          setLocale(profile.locale);
        }
      })
      .catch(() => {}); // Profile page displays actionable errors; shell can keep its local preference.
    return () => controller.abort();
  }, []);
  return null;
}
