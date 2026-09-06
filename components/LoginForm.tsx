"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        <label htmlFor="email" className="block text-xs font-semibold text-[#4A4D57] mb-1.5 font-['Jost']">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-[#E2E4E8] px-3.5 py-2.5 text-sm text-[#14161B] bg-white placeholder-[#8A8E99] focus:outline-none focus:border-[#14161B] focus:ring-2 focus:ring-[#D3BD2A]/20 transition"
          placeholder="admin@rizq.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label htmlFor="password" className="block text-xs font-semibold text-[#4A4D57] font-['Jost']">
            Password
          </label>
        </div>
        <div className="relative flex items-center">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            className={`w-full rounded-lg border border-[#E2E4E8] px-3.5 pr-10 py-2.5 text-sm text-[#14161B] bg-white placeholder-[#8A8E99] focus:outline-none focus:border-[#14161B] focus:ring-2 focus:ring-[#D3BD2A]/20 transition dots-placeholder ${
              showPassword ? "font-['Jost'] tracking-normal" : "font-sans tracking-[0.18em]"
            }`}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 text-[#8A8E99] hover:text-[#14161B] p-1 transition rounded-md focus:outline-none focus:ring-1 focus:ring-[#14161B]"
            title={showPassword ? "Hide password" : "Show password"}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
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

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 rounded-lg bg-[#14161B] hover:bg-[#232730] text-white py-2.5 font-medium text-sm transition duration-150 flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
      >
        {loading ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
