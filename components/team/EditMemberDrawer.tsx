"use client";

import { useEffect, useMemo, useState } from "react";
import { useTeamAccess } from "./TeamAccessProvider";
import { useToast } from "@/components/shell/ToastContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { issueStaffTemporaryPassword, removeStaffMember, updateStaffAccess } from "@/lib/platformFunctions";
import { effectivePermissionTags } from "@/lib/capabilityMap";
import { RoleScopeRepeater, rowsToAssignmentPayload, groupAssignmentsToRows, type RoleScopeRow } from "./RoleScopeRepeater";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Select } from "@/components/ui/Select";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function EditMemberDrawer({ memberId, onClose }: { memberId: string | null; onClose: () => void }) {
  const { organizationId, accessToken, roles, chapters, members, refresh } = useTeamAccess();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const member = members.find((m) => m.id === memberId) ?? null;
  const [rows, setRows] = useState<RoleScopeRow[]>([]);
  const [status, setStatus] = useState<"active" | "invited" | "deactivated">("active");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState<"save" | "remove" | "password" | null>(null);
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (member) {
      setRows(groupAssignmentsToRows(member.assignments, chapters));
      setStatus(member.status);
      setExpiresAt(member.expiresAt ? member.expiresAt.slice(0, 10) : "");
      setIssuedPassword(null);
      setCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const permKeysByRoleId = useMemo(() => new Map(roles.map((r) => [r.id, r.permissionKeys])), [roles]);
  const tags = effectivePermissionTags(rows.map((r) => permKeysByRoleId.get(r.roleId) ?? []));

  async function save() {
    if (!member || !organizationId || !accessToken) return;
    setBusy("save");
    try {
      await updateStaffAccess({
        staffId: member.id,
        organizationId,
        roles: rowsToAssignmentPayload(rows, chapters),
        status,
        expiresAt: expiresAt || null,
      }, accessToken);

      await refresh();
      showToast(`Saved access changes for ${member.fullName}.`);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save changes.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!member || !organizationId || !accessToken) return;
    const ok = await confirm({
      title: "Remove team member?",
      message: `${member.fullName} will lose access to this organization's console.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setBusy("remove");
    try {
      await removeStaffMember({ staffId: member.id, organizationId }, accessToken);
      await refresh();
      showToast(`Removed ${member.fullName} from the team.`);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove member.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function issuePassword() {
    if (!member || !organizationId || !accessToken) return;
    const ok = await confirm({
      title: "Issue a new temporary password?",
      message: `${member.fullName}'s current password will stop working. Share the new one with them. They set their own password the next time they sign in.`,
      confirmLabel: "Issue password",
    });
    if (!ok) return;
    setBusy("password");
    try {
      const res = await issueStaffTemporaryPassword({
        staffId: member.id,
        organizationId,
      }, accessToken);
      setIssuedPassword(res.temporaryPassword);
      showToast(`New temporary password issued for ${member.fullName}.`);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      const message = code === "member_deactivated"
        ? "Restore this member before issuing a password."
        : code === "member_has_no_sign_in"
          ? "This member has no sign-in yet."
          : code === "forbidden"
            ? "You can't issue a password for this member."
            : code || "Failed to issue a temporary password.";
      showToast(message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function copyPassword() {
    if (!member || !issuedPassword) return;
    const text =
      `Rizq Admin — sign in\n` +
      `Email: ${member.email}\n` +
      `Temporary password: ${issuedPassword}\n` +
      `You'll be asked to set your own password on first login.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Couldn't copy — select the text manually.", "error");
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
                <label className="form-label">Sign-in password</label>
                {issuedPassword ? (
                  <div className="rounded-lg border border-[var(--line)] bg-white p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-[var(--ink-3)]">Temporary password</span>
                      <span className="font-mono text-sm font-bold text-[var(--ink)]">{issuedPassword}</span>
                    </div>
                    <button type="button" className="btn btn-secondary btn-xs" onClick={copyPassword}>
                      {copied ? "Copied ✓" : "Copy sign-in details"}
                    </button>
                    <p className="text-xs text-[var(--ink-2)]">Shown once. They set their own password on next sign-in.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <LoadingButton
                      className="btn btn-secondary btn-xs"
                      disabled={busy !== null}
                      loading={busy === "password"}
                      loadingText="Issuing…"
                      onClick={issuePassword}
                    >
                      Issue new temporary password
                    </LoadingButton>
                    <p className="text-xs text-[var(--ink-2)]">
                      Use this when the password from creating the member was never shown.
                    </p>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Roles</label>
                <RoleScopeRepeater
                  rows={rows}
                  roles={roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem, permissionKeys: r.permissionKeys }))}
                  chapters={chapters.map((c) => ({ id: c.id, name: c.name }))}
                  onChange={setRows}
                  addLabel="+ Add Role"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-mem-status">Account Access Status</label>
                <Select
                  id="edit-mem-status"
                  aria-label="Account Access Status"
                  value={status}
                  onChange={(val) => setStatus(val as "active" | "invited" | "deactivated")}
                  options={[
                    { value: "active", label: "Active & Verified" },
                    { value: "invited", label: "Pending Invitation" },
                    { value: "deactivated", label: "Suspended / Deactivated" },
                  ]}
                />
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
              <LoadingButton className="btn btn-danger btn-xs" disabled={busy !== null} loading={busy === "remove"} loadingText="Removing…" onClick={remove}>Remove from Team</LoadingButton>
              <div style={{ display: "flex", gap: ".45rem" }}>
                <button type="button" className="btn btn-secondary btn-xs" onClick={onClose} disabled={busy !== null}>Cancel</button>
                <LoadingButton className="btn btn-primary btn-xs" disabled={busy !== null} loading={busy === "save"} loadingText="Saving…" onClick={save}>Save Changes</LoadingButton>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
