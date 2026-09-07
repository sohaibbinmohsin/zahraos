"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { setPassword } from "@/lib/platformFunctions";
import { LoadingButton } from "@/components/ui/LoadingButton";

export function SetPasswordForm() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isLenValid = newPassword.length >= 8;
  const isUpperValid = /[A-Z]/.test(newPassword);
  const isNumValid = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);
  const isMatchValid = newPassword.length > 0 && newPassword === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setError("unauthorized");
        return;
      }
      await setPassword({ newPassword }, sessionData.session.access_token);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2 font-medium">
          <svg className="w-4 h-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div>
        <label htmlFor="newPassword" className="block text-xs font-semibold text-[#4A4D57] mb-1.5 font-['Jost']">
          New password
        </label>
        <div className="relative flex items-center">
          <input
            id="newPassword"
            type={showNewPassword ? "text" : "password"}
            required
            className={`w-full rounded-lg border border-[#E2E4E8] px-3.5 pr-10 py-2.5 text-sm text-[#14161B] bg-white placeholder-[#8A8E99] focus:outline-none focus:border-[#14161B] focus:ring-2 focus:ring-[#D3BD2A]/20 transition ${
              showNewPassword ? "font-['Jost'] tracking-normal" : "font-sans tracking-[0.18em]"
            }`}
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            className="absolute right-3 text-[#8A8E99] hover:text-[#14161B] p-1 transition rounded-md focus:outline-none focus:ring-1 focus:ring-[#14161B]"
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

      {/* Password Requirements Checklist */}
      <ul className="rounded-lg border border-[#E2E4E8] bg-[#F8F9FA] p-3 space-y-1.5 text-xs text-[#8A8E99] font-['Jost']">
        <li className={`flex items-center gap-2 transition ${isLenValid ? "text-[#14161B] font-medium" : ""}`}>
          <span className={isLenValid ? "text-[#1B5E20] font-bold" : "text-[#8A8E99]"}>✓</span>
          <span>At least 8 characters</span>
        </li>
        <li className={`flex items-center gap-2 transition ${isUpperValid ? "text-[#14161B] font-medium" : ""}`}>
          <span className={isUpperValid ? "text-[#1B5E20] font-bold" : "text-[#8A8E99]"}>✓</span>
          <span>Contains uppercase letter</span>
        </li>
        <li className={`flex items-center gap-2 transition ${isNumValid ? "text-[#14161B] font-medium" : ""}`}>
          <span className={isNumValid ? "text-[#1B5E20] font-bold" : "text-[#8A8E99]"}>✓</span>
          <span>Contains number or symbol</span>
        </li>
        <li className={`flex items-center gap-2 transition ${isMatchValid ? "text-[#14161B] font-medium" : ""}`}>
          <span className={isMatchValid ? "text-[#1B5E20] font-bold" : "text-[#8A8E99]"}>✓</span>
          <span>Passwords match</span>
        </li>
      </ul>

      <div>
        <label htmlFor="confirmPassword" className="block text-xs font-semibold text-[#4A4D57] mb-1.5 font-['Jost']">
          Confirm password
        </label>
        <div className="relative flex items-center">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            required
            className={`w-full rounded-lg border border-[#E2E4E8] px-3.5 pr-10 py-2.5 text-sm text-[#14161B] bg-white placeholder-[#8A8E99] focus:outline-none focus:border-[#14161B] focus:ring-2 focus:ring-[#D3BD2A]/20 transition ${
              showConfirmPassword ? "font-['Jost'] tracking-normal" : "font-sans tracking-[0.18em]"
            }`}
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => setNewPasswordMatch(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 text-[#8A8E99] hover:text-[#14161B] p-1 transition rounded-md focus:outline-none focus:ring-1 focus:ring-[#14161B]"
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

      <LoadingButton
        type="submit"
        loading={submitting}
        loadingText="Setting password…"
        className="w-full mt-2 rounded-lg bg-[#D3BD2A] hover:bg-[#BFAB24] text-[#14161B] py-2.5 font-semibold text-sm transition duration-150 flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
      >
        Set password
      </LoadingButton>
    </form>
  );

  function setNewPasswordMatch(val: string) {
    setConfirmPassword(val);
  }
}
