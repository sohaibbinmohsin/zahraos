"use client";

import { useEffect, useState } from "react";
import type { ModuleCatalog } from "@/registry/moduleCatalog";

export function useModuleCatalogs(
  organizationId: string | null | undefined,
  accessToken: string | null | undefined,
  enabled = true,
) {
  const [catalogs, setCatalogs] = useState<ModuleCatalog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !organizationId || !accessToken) {
      setCatalogs(null);
      setError(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(
          `/api/module-catalogs?organizationId=${encodeURIComponent(organizationId)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          if (!cancelled) {
            setCatalogs(null);
            setError(typeof body.error === "string" ? body.error : "module_catalog_unavailable");
          }
          return;
        }
        const data = (await response.json()) as { catalogs?: ModuleCatalog[] };
        if (!cancelled) {
          setCatalogs(data.catalogs ?? []);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setCatalogs(null);
          setError("module_catalog_unavailable");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, accessToken, enabled]);

  return { catalogs, error };
}