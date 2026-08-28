"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { setPassword } from "@/lib/platformFunctions";

export function SetPasswordForm() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      <div>
        <label htmlFor="newPassword" className="block text-sm">New password</label>
        <input id="newPassword" type="password" className="mt-1 w-full rounded border px-3 py-2" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm">Confirm password</label>
        <input id="confirmPassword" type="password" className="mt-1 w-full rounded border px-3 py-2" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting} className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50">
        Set password
      </button>
    </form>
  );
}
