"use client";

import { useEffect, useState } from "react";
import { useTeamAccess } from "./TeamAccessProvider";
import { useToast } from "@/components/shell/ToastContext";
import { inviteStaffMember } from "@/lib/platformFunctions";
import { RoleScopeRepeater, makeRoleScopeRow, rowsToAssignmentPayload, type RoleScopeRow } from "./RoleScopeRepeater";
import { LoadingButton } from "@/components/ui/LoadingButton";

interface CreatedMember {
  name: string;
  email: string;
  temporaryPassword: string;
}

export function InviteMemberDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { organizationId, accessToken, roles, chapters, refresh } = useTeamAccess();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [rows, setRows] = useState<RoleScopeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedMember | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setName(""); setEmail(""); setPhone(""); setExpiresAt("");
      setRows([makeRoleScopeRow(roles[0]?.id ?? "")]);
      setCreated(null);
      setCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roles.length]);

  async function submit() {
    if (!name.trim() || !email.trim()) {
      showToast("Please enter the member's full name and work email.");
      return;
    }
    if (!organizationId || !accessToken) return;
    setBusy(true);
    try {
      const res = await inviteStaffMember({
        organizationId,
        fullName: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        roles: rowsToAssignmentPayload(rows),
        expiresAt: expiresAt || null,
      }, accessToken);
      await refresh();
      setCreated({ name: name.trim(), email: email.trim(), temporaryPassword: res.temporaryPassword });
      showToast(`${name.trim()} added to the team.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add team member.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCredentials() {
    if (!created) return;
    const text =
      `Rizq Admin — sign in\n` +
      `Email: ${created.email}\n` +
      `Temporary password: ${created.temporaryPassword}\n` +
      `You'll be asked to set your own password on first login.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Couldn't copy — select the text manually.");
    }
  }

  return (
    <>
      <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${open ? "open" : ""}`} style={{ maxWidth: 580 }}>
        <div className="drawer-header">
          <div>
            <h2 className="drawer-title">{created ? "Team Member Created" : "Add New Team Member"}</h2>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
              {created
                ? "Share these sign-in details with the new member."
                : "Grant admin access with a temporary password and multi-role chapter scopes."}
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {created ? (
          <>
            <div className="drawer-body">
              <div className="rounded-lg border border-[var(--st-pos-bd)] bg-[var(--st-pos-bg)] p-3 text-sm text-[var(--st-pos-fg)] font-medium">
                {created.name} can sign in now. They&apos;ll be prompted to set their own password on first login.
              </div>

              <div className="rounded-lg border border-[var(--line)] bg-white divide-y divide-[var(--line-subtle)]">
                <div className="flex items-center justify-between gap-3 p-3">
                  <span className="text-xs font-semibold text-[var(--ink-3)]">Email</span>
                  <span className="font-mono text-sm text-[var(--ink)]">{created.email}</span>
                </div>
                <div className="flex items-center justify-between gap-3 p-3">
                  <span className="text-xs font-semibold text-[var(--ink-3)]">Temporary password</span>
                  <span className="font-mono text-sm font-bold text-[var(--ink)]">{created.temporaryPassword}</span>
                </div>
              </div>

              <button type="button" className="btn btn-secondary btn-sm" onClick={copyCredentials}>
                {copied ? "Copied ✓" : "Copy sign-in details"}
              </button>

              <p className="text-xs text-[var(--ink-2)]">
                This password is shown once. If it&apos;s lost, remove the member and add them again.
              </p>
            </div>

            <div className="drawer-footer">
              <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <>
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

              <p className="text-xs text-[var(--ink-2)]">
                A temporary password is generated for you to pass on. No email is sent.
              </p>
            </div>

            <div className="drawer-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
              <LoadingButton className="btn btn-primary btn-sm" disabled={busy} loading={busy} loadingText="Creating…" onClick={submit}>
                Create Member
              </LoadingButton>
            </div>
          </>
        )}
      </div>
    </>
  );
}
