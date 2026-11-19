"use client";

const ERROR_COPY: Record<string, string> = {
  module_catalog_unavailable:
    "Module permission catalogs could not be loaded. Check Youth Republic connectivity and try again.",
  forbidden: "You do not have access to load catalogs for this organization.",
};

export function moduleCatalogErrorMessage(error: string): string {
  return ERROR_COPY[error] ?? `Module catalogs are unavailable (${error}).`;
}

export function ModuleCatalogStatusBanner({
  error,
  loading,
}: {
  error: string | null;
  loading?: boolean;
}) {
  if (error) {
    return (
      <div
        className="rounded-lg p-3 text-sm font-medium"
        style={{
          backgroundColor: "var(--st-neg-bg)",
          color: "var(--st-neg-fg)",
          border: "1px solid var(--st-neg-bd)",
        }}
        role="alert"
      >
        {moduleCatalogErrorMessage(error)}
      </div>
    );
  }

  if (loading) {
    return (
      <p className="text-sm text-[var(--ink-2)]" aria-live="polite">
        Loading module permission catalogs…
      </p>
    );
  }

  return null;
}