import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { mutate } from "swr";

// SWR's cache is module-global, so without this a page's data would leak
// into the next test in the same file.
beforeEach(async () => {
  await mutate(() => true, undefined, { revalidate: false });
});
