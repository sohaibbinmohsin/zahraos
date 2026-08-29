"use client";

import { useState } from "react";
import { deactivateStaff } from "@/lib/platformFunctions";

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

  async function handleClick() {
    setError(null);
    try {
      await deactivateStaff({ targetStaffId }, accessToken);
      onDeactivated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    }
  }

  return (
    <div>
      <button type="button" onClick={handleClick} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700">
        Deactivate
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
