"use client";

import { SWRConfig } from "swr";

/**
 * Shared fetch cache for the console's list pages.
 *
 * The point is navigation: moving drives -> applications -> drives used to
 * refetch and flash a skeleton every time. With a cache, the second visit
 * renders the previous data immediately and revalidates underneath. A real
 * browser reload starts with an empty (in-memory) cache, so reloading still
 * does what the user expects and fetches fresh.
 */
export function SwrProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Show the cached page instantly, refresh in the background.
        keepPreviousData: true,
        // Tabbing back to the window shouldn't re-hit the edge functions.
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        // Collapse duplicate requests for the same key across components.
        dedupingInterval: 5000,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  );
}
