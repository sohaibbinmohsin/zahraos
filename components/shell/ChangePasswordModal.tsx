"use client";

import { useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useToast } from "./ToastContext";
import { LoadingButton } from "@/components/ui/LoadingButton";

export function ChangePasswordModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Supabase password requirements:
  // 1. Minimum 8 characters
  // 2. At least one lowercase letter
  // 3. At least one uppercase letter
  // 4. At least one digit (0-9)
  // 5. At least one symbol / special character
  const isMinLen = newPassword.length >= 8;
  const hasLower = /[a-z]/.test(newPassword);
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasDigit = /[0-9]/.test(newPassword);
  const hasSymbol = /[^a-zA-Z0-9]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

  if (!isOpen) return null;

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!currentPassword.trim()) {
      setError("Current password is required");
      return;
    }

    if (!isMinLen) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!hasLower) {
      setError("Password must include at least one lowercase letter");
      return;
    }

    if (!hasUpper) {
      setError("Password must include at least one uppercase letter");
      return;
    }

    if (!hasDigit) {
      setError("Password must include at least one number (0-9)");
      return;
    }

    if (!hasSymbol) {
      setError("Password must include at least one symbol or special character");
      return;
    }

    if (newPassword === currentPassword) {
      setError("New password must be different from current password");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setError("Unauthorized session");
        return;
      }

      // Supabase updateUser enforces 'Require current password when updating'
      // and password complexity rules set in the Supabase Auth configuration.
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // If user had must_change_password flag set, clear it now
      if (sessionData.session.user?.id) {
        await supabase
          .from("staff")
          .update({ must_change_password: false })
          .eq("auth_user_id", sessionData.session.user.id);
      }

      showToast("Password updated successfully.");
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="drawer-backdrop open" onClick={handleClose} />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-[var(--line)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-4">
          <h2 id="change-password-title" className="font-semibold text-lg tracking-normal text-[var(--ink)]">
            Change Password
          </h2>
          <button
            type="button"
            className="text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="modal-current-password">Current Password</label>
            <div className="relative flex items-center">
              <input
                id="modal-current-password"
                type={showCurrentPassword ? "text" : "password"}
                className={`form-input pr-10 ${
                  showCurrentPassword ? "font-['Jost'] tracking-normal" : "font-sans tracking-[0.18em]"
                }`}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-2.5 text-[#8A8E99] hover:text-[#14161B] p-1 transition rounded-md cursor-pointer"
                title={showCurrentPassword ? "Hide password" : "Show password"}
                aria-label={showCurrentPassword ? "Hide password" : "Show password"}
              >
                {showCurrentPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* New Password Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="modal-new-password">New Password</label>
            <div className="relative flex items-center">
              <input
                id="modal-new-password"
                type={showNewPassword ? "text" : "password"}
                className={`form-input pr-10 ${
                  showNewPassword ? "font-['Jost'] tracking-normal" : "font-sans tracking-[0.18em]"
                }`}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min. 8 characters)"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2.5 text-[#8A8E99] hover:text-[#14161B] p-1 transition rounded-md cursor-pointer"
                title={showNewPassword ? "Hide password" : "Show password"}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Supabase Password Requirements Checklist */}
          <ul className="rounded-lg border border-[var(--line)] bg-[var(--bg-page)] p-3 space-y-1.5 text-xs text-[var(--ink-3)] font-['Jost']">
            <li className={`flex items-center gap-2 transition ${isMinLen ? "text-[var(--ink)] font-medium" : ""}`}>
              <span className={isMinLen ? "text-[#1B5E20] font-bold" : "text-[var(--ink-3)]"}>✓</span>
              <span>At least 8 characters</span>
            </li>
            <li className={`flex items-center gap-2 transition ${hasLower ? "text-[var(--ink)] font-medium" : ""}`}>
              <span className={hasLower ? "text-[#1B5E20] font-bold" : "text-[var(--ink-3)]"}>✓</span>
              <span>At least one lowercase letter (a-z)</span>
            </li>
            <li className={`flex items-center gap-2 transition ${hasUpper ? "text-[var(--ink)] font-medium" : ""}`}>
              <span className={hasUpper ? "text-[#1B5E20] font-bold" : "text-[var(--ink-3)]"}>✓</span>
              <span>At least one uppercase letter (A-Z)</span>
            </li>
            <li className={`flex items-center gap-2 transition ${hasDigit ? "text-[var(--ink)] font-medium" : ""}`}>
              <span className={hasDigit ? "text-[#1B5E20] font-bold" : "text-[var(--ink-3)]"}>✓</span>
              <span>At least one number (0-9)</span>
            </li>
            <li className={`flex items-center gap-2 transition ${hasSymbol ? "text-[var(--ink)] font-medium" : ""}`}>
              <span className={hasSymbol ? "text-[#1B5E20] font-bold" : "text-[var(--ink-3)]"}>✓</span>
              <span>At least one special character / symbol</span>
            </li>
            <li className={`flex items-center gap-2 transition ${isMatch ? "text-[var(--ink)] font-medium" : ""}`}>
              <span className={isMatch ? "text-[#1B5E20] font-bold" : "text-[var(--ink-3)]"}>✓</span>
              <span>Passwords match</span>
            </li>
          </ul>

          {/* Confirm Password Field */}
          <div className="form-group">
            <label className="form-label" htmlFor="modal-confirm-password">Confirm Password</label>
            <div className="relative flex items-center">
              <input
                id="modal-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                className={`form-input pr-10 ${
                  showConfirmPassword ? "font-['Jost'] tracking-normal" : "font-sans tracking-[0.18em]"
                }`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 text-[#8A8E99] hover:text-[#14161B] p-1 transition rounded-md cursor-pointer"
                title={showConfirmPassword ? "Hide password" : "Show password"}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line-subtle)]">
            <button
              type="button"
              className="btn btn-secondary btn-sm cursor-pointer"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              className="btn btn-primary btn-sm cursor-pointer"
              loading={submitting}
              loadingText="Updating…"
            >
              Update Password
            </LoadingButton>
          </div>
        </form>
      </div>
    </>
  );
}
