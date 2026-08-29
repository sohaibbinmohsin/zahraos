import { DeactivateStaffButton } from "./DeactivateStaffButton";

export interface StaffSummary {
  id: string;
  fullName: string;
  email: string;
  status: "active" | "deactivated";
  orgTier: string | null;
}

export function StaffList({
  staff,
  accessToken,
  onDeactivated,
}: {
  staff: StaffSummary[];
  accessToken: string;
  onDeactivated: () => void;
}) {
  return (
    <ul className="divide-y divide-gray-200">
      {staff.map((member) => (
        <li key={member.id} className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium">{member.fullName}</p>
            <p className="text-sm text-gray-500">{member.email} {member.orgTier ? `· ${member.orgTier}` : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{member.status}</span>
            {member.status === "active" && (
              <DeactivateStaffButton targetStaffId={member.id} accessToken={accessToken} onDeactivated={onDeactivated} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
