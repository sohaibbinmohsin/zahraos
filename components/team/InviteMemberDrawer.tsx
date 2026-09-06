"use client";

import { useEffect, useState } from "react";
import { useTeamAccess } from "./TeamAccessProvider";
import { useToast } from "@/components/shell/ToastContext";
import { inviteStaffMember } from "@/lib/platformFunctions";
import { RoleScopeRepeater, makeRoleScopeRow, rowsToAssignmentPayload, type RoleScopeRow } from "./RoleScopeRepeater";

export function InviteMemberDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { organizationId, accessToken, roles, chapters, refresh } = useTeamAccess();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [enforce2fa, setEnforce2fa] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");
  const [rows, setRows] = useState<RoleScopeRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(""); setEmail(""); setPhone(""); setSendEmail(true); setEnforce2fa(true); setExpiresAt("");
      setRows([makeRoleScopeRow(roles[0]?.id ?? "")]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roles.length]);

  async function submit() {
    if (!name.trim() || !email.trim()) {
      showToast("Please enter candidate full name and work email.");
      return;
    }
    if (!organizationId || !accessToken) return;
    setBusy(true);
    try {
      await inviteStaffMember({
        organizationId,
        fullName: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        roles: rowsToAssignmentPayload(rows),
        sendActivationEmail: sendEmail,
        enforce2fa,
        expiresAt: expiresAt || null,
      }, accessToken);
      await refresh();
      showToast(`Invitation sent to ${name.trim()} with ${rows.length} role assignment(s).`);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${open ? "open" : ""}`} style={{ maxWidth: 580 }}>
        <div className="drawer-header">
          <div>
            <h2 className="drawer-title">Invite New Team Member</h2>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
              Grant administrative access and assign multi-role chapter scopes
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="drawer-body">
          <div className="form-group">
            <label className="form-label" htmlFor="invite-name">Full Name *</label>
            <input id="invite-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tariq Mehmood" />
          </div>
          <div className="grid-2col">
            <div className="form-group">
              <label className="form-label" htmlFor="invite-email">Work Email *</label>
              <input id="invite-email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. tariq.m@youthrepublic.org" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="invite-phone">Phone Number</label>
              <input id="invite-phone" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0300-1234567" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="invite-expires">Access expires</label>
            <input id="invite-expires" type="date" className="form-input" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)", marginTop: ".35rem" }}>
              Leave blank for permanent access.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Assigned Roles &amp; Chapter Scopes *</label>
            <RoleScopeRepeater
              rows={rows}
              roles={roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem }))}
              chapters={chapters.map((c) => ({ id: c.id, name: c.name }))}
              onChange={setRows}
              addLabel="+ Add Another Role"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Security &amp; Invitation Settings</label>
            <div style={{ display: "flex", flexDirection: "column", gap: ".45rem", fontSize: "var(--text-sm)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
                <span>Send secure onboarding activation link via email</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                <input type="checkbox" checked={enforce2fa} onChange={(e) => setEnforce2fa(e.target.checked)} />
                <span>Enforce Two-Factor Authentication (2FA) on first login</span>
              </label>
            </div>
          </div>
        </div>

        <div className="drawer-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={submit}>
            Send Official Invitation →
          </button>
        </div>
      </div>
    </>
  );
}
