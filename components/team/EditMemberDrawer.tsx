"use client";

import { useEffect, useMemo, useState } from "react";
import { useTeamAccess } from "./TeamAccessProvider";
import { useToast } from "@/components/shell/ToastContext";
import { removeStaffMember, updateStaffAccess } from "@/lib/platformFunctions";
import { effectivePermissionTags } from "@/lib/capabilityMap";
import { RoleScopeRepeater, rowsToAssignmentPayload, type RoleScopeRow } from "./RoleScopeRepeater";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function EditMemberDrawer({ memberId, onClose }: { memberId: string | null; onClose: () => void }) {
  const { organizationId, accessToken, roles, chapters, members, refresh } = useTeamAccess();
  const { showToast } = useToast();
  const member = members.find((m) => m.id === memberId) ?? null;
  const [rows, setRows] = useState<RoleScopeRow[]>([]);
  const [status, setStatus] = useState<"active" | "invited" | "deactivated">("active");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (member) {
      setRows(member.assignments.map((a) => ({
        key: a.id,
        roleId: a.roleId,
        scopeKind: a.scopeKind,
        chapterId: a.chapterId,
        scopeLabel: a.scopeLabel,
      })));
      setStatus(member.status);
      setExpiresAt(member.expiresAt ? member.expiresAt.slice(0, 10) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const permKeysByRoleId = useMemo(() => new Map(roles.map((r) => [r.id, r.permissionKeys])), [roles]);
  const tags = effectivePermissionTags(rows.map((r) => permKeysByRoleId.get(r.roleId) ?? []));

  async function save() {
    if (!member || !organizationId || !accessToken) return;
    setBusy(true);
    try {
      await updateStaffAccess({
        staffId: member.id,
        organizationId,
        roles: rowsToAssignmentPayload(rows),
        status,
        expiresAt: expiresAt || null,
      }, accessToken);
      await refresh();
      showToast(`Saved access changes for ${member.fullName}.`);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!member || !organizationId || !accessToken) return;
    if (!window.confirm(`Remove ${member.fullName} from the team?`)) return;
    setBusy(true);
    try {
      await removeStaffMember({ staffId: member.id, organizationId }, accessToken);
      await refresh();
      showToast(`Removed ${member.fullName} from the team.`);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setBusy(false);
    }
  }

  const open = member !== null;
  return (
    <>
      <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${open ? "open" : ""}`} style={{ maxWidth: 580 }}>
        {member && (
          <>
            <div className="drawer-header">
              <div>
                <h2 className="drawer-title">Edit Team Member Access</h2>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
                  Configure multi-roles, chapter scopes, and account status
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close">✕</button>
            </div>

            <div className="drawer-body">
              <div style={{ background: "var(--bg-page)", border: "1px solid var(--line)", borderRadius: 8, padding: ".85rem", display: "flex", alignItems: "center", gap: ".75rem" }}>
                <div className="avatar" style={{ width: 36, height: 36, fontSize: "var(--text-base)" }}>{initials(member.fullName)}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "var(--text-base)" }}>{member.fullName}</div>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>{member.email}</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Roles &amp; Operational Scopes</label>
                <RoleScopeRepeater
                  rows={rows}
                  roles={roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem }))}
                  chapters={chapters.map((c) => ({ id: c.id, name: c.name }))}
                  onChange={setRows}
                  addLabel="+ Add Role"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-mem-status">Account Access Status</label>
                <select
                  id="edit-mem-status"
                  aria-label="Account Access Status"
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "invited" | "deactivated")}
                >
                  <option value="active">Active &amp; Verified</option>
                  <option value="invited">Pending Invitation</option>
                  <option value="deactivated">Suspended / Deactivated</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-mem-expires">Access expires</label>
                <input
                  id="edit-mem-expires"
                  type="date"
                  className="form-input"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)", marginTop: ".35rem" }}>
                  Leave blank for permanent access.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Effective Permission Privileges</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
                  {tags.map((t) => <span className="perm-tag" key={t}>{t}</span>)}
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <button type="button" className="btn btn-danger btn-xs" disabled={busy} onClick={remove}>Remove from Team</button>
              <div style={{ display: "flex", gap: ".45rem" }}>
                <button type="button" className="btn btn-secondary btn-xs" onClick={onClose}>Cancel</button>
                <button type="button" className="btn btn-primary btn-xs" disabled={busy} onClick={save}>Save Changes</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
