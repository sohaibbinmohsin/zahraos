"use client";

export function OrgSwitcher({
  orgIds,
  selectedOrgId,
  orgNames,
  onSelect,
}: {
  orgIds: string[];
  selectedOrgId: string;
  orgNames: Record<string, string>;
  onSelect: (orgId: string) => void;
}) {
  if (orgIds.length <= 1) {
    return null;
  }

  return (
    <select
      aria-label="Organization"
      className="rounded border px-2 py-1 text-sm"
      value={selectedOrgId}
      onChange={(e) => onSelect(e.target.value)}
    >
      {orgIds.map((orgId) => (
        <option key={orgId} value={orgId}>
          {orgNames[orgId] ?? orgId}
        </option>
      ))}
    </select>
  );
}
