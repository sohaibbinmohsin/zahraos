"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !data.session) {
        setError(signInError?.message ?? "login_failed");
        setLoading(false);
        return;
      }
      router.push("/modules/youth-republic/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "login_failed");
      setLoading(false);
    }
  }

  function fillCredentials(fillEmail: string, fillPass: string) {
    setEmail(fillEmail);
    setPassword(fillPass);
    setError(null);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2 font-medium">
          <svg className="w-4 h-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 font-['Oswald']">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:border-[#D3BD2A] focus:ring-2 focus:ring-[#D3BD2A]/20 transition"
          placeholder="admin@organization.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 font-['Oswald']">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:border-[#D3BD2A] focus:ring-2 focus:ring-[#D3BD2A]/20 transition"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 rounded-lg bg-[#14161B] hover:bg-[#232730] text-white py-2.5 font-medium text-sm transition duration-150 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
      >
        {loading ? "Logging in..." : "Log in"}
      </button>

      <div className="pt-3 border-t border-gray-100">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider font-['Oswald'] mb-2">
          Quick Fill Test Accounts:
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => fillCredentials("super-admin@example.com", "SuperAdmin123!")}
            className="text-[11px] px-2.5 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-yellow-50 hover:border-yellow-300 text-gray-700 transition"
          >
            🔑 Super Admin
          </button>
          <button
            type="button"
            onClick={() => fillCredentials("admin@rizq.example.com", "RizqAdmin123!")}
            className="text-[11px] px-2.5 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-yellow-50 hover:border-yellow-300 text-gray-700 transition"
          >
            🏢 Rizq Org Admin
          </button>
          <button
            type="button"
            onClick={() => fillCredentials("sohaibbinmohsin@gmail.com", "SuperAdmin123!")}
            className="text-[11px] px-2.5 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-yellow-50 hover:border-yellow-300 text-gray-700 transition"
          >
            👤 Sohaib
          </button>
        </div>
      </div>
    </form>
  );
}
