"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/lib/i18n";
import { useState } from "react";
import { MotionConfig } from "motion/react";
import { motionTokens } from "@/lib/motion";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <MotionConfig
            reducedMotion="user"
            transition={{
              duration: motionTokens.duration.fast,
              ease: motionTokens.easing.smooth,
            }}
          >
            {children}
          </MotionConfig>
        </I18nProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
