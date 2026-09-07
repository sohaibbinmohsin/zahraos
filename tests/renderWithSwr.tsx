import { render } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { ReactElement } from "react";

/**
 * Renders a page inside a throwaway SWR cache.
 *
 * SWR's default cache — and its request de-duplication window — are
 * module-global, so without this a page's data (or an in-flight request)
 * leaks into the next test in the same file and the new mock is ignored.
 */
export function renderWithSwr(ui: ReactElement) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {ui}
    </SWRConfig>,
  );
}
