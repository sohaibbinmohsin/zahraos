"use client";

import { useState } from "react";
import { deactivateStaff } from "@/lib/platformFunctions";
import { LoadingButton } from "@/components/ui/LoadingButton";

export function DeactivateStaffButton({
  targetStaffId,
  accessToken,
  onDeactivated,
}: {
  targetStaffId: string;
  accessToken: string;
  onDeactivated: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setError(null);
    setBusy(true);
    try {
      await deactivateStaff({ targetStaffId }, accessToken);
      onDeactivated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <LoadingButton
        onClick={handleClick}
        loading={busy}
        loadingText="Deactivating…"
        className="inline-flex items-center gap-2 rounded border border-red-300 px-3 py-1 text-sm text-red-700 disabled:opacity-50"
      >
        Deactivate
      </LoadingButton>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
