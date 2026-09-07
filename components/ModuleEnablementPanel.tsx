"use client";

import { useState } from "react";
import { enableModule } from "@/lib/platformFunctions";
import { LoadingButton } from "@/components/ui/LoadingButton";

export interface ModuleSummary {
  id: string;
  key: string;
  displayName: string;
}

export function ModuleEnablementPanel({
  organizationId,
  allModules,
  enabledModuleKeys,
  accessToken,
  onEnabled,
}: {
  organizationId: string;
  allModules: ModuleSummary[];
  enabledModuleKeys: string[];
  accessToken: string;
  onEnabled: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [enablingKey, setEnablingKey] = useState<string | null>(null);

  async function handleEnable(moduleKey: string) {
    setError(null);
    setEnablingKey(moduleKey);
    try {
      await enableModule({ organizationId, moduleKey }, accessToken);
      onEnabled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setEnablingKey(null);
    }
  }

  return (
    <ul className="divide-y divide-gray-200">
      {allModules.map((module) => {
        const isEnabled = enabledModuleKeys.includes(module.key);
        return (
          <li key={module.id} className="flex items-center justify-between py-2">
            <span>{module.displayName}</span>
            {isEnabled ? (
              <span className="text-sm text-green-700">Enabled</span>
            ) : (
              <LoadingButton
                onClick={() => handleEnable(module.key)}
                loading={enablingKey === module.key}
                loadingText="Enabling…"
                disabled={enablingKey !== null}
                className="inline-flex items-center gap-2 rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                Enable
              </LoadingButton>
            )}
          </li>
        );
      })}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </ul>
  );
}
