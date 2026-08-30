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
    <div className="table-card">
      <div className="table-responsive-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Email Address</th>
              <th>Organization Role</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id}>
                <td>
                  <div className="font-bold text-[var(--ink)]">{member.fullName}</div>
                </td>
                <td>
                  <span className="font-mono text-xs text-[var(--ink-2)]">{member.email}</span>
                </td>
                <td>
                  {member.orgTier ? (
                    <span className="type-pill text-[10px] uppercase font-semibold">{member.orgTier}</span>
                  ) : (
                    <span className="text-xs text-[var(--ink-3)]">No org tier</span>
                  )}
                </td>
                <td>
                  <span
                    className={`badge ${member.status === "active" ? "badge-pos" : "badge-neg"}`}
                  >
                    {member.status}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  {member.status === "active" && (
                    <DeactivateStaffButton
                      targetStaffId={member.id}
                      accessToken={accessToken}
                      onDeactivated={onDeactivated}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
