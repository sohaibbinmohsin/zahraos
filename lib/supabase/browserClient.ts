import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let clientInstance: SupabaseClient | null = null;

function normalizeSessionSkew(jsonStr: string | null): string | null {
  if (!jsonStr || typeof jsonStr !== "string") return jsonStr;
  try {
    const session = JSON.parse(jsonStr);
    if (session && session.access_token && typeof session.expires_at === "number") {
      const parts = session.access_token.split(".");
      if (parts.length >= 2) {
        // Base64Url decode without external dependencies
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(b64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        const payload = JSON.parse(jsonPayload);
        if (payload && typeof payload.iat === "number") {
          const clientNowSec = Math.round(Date.now() / 1000);
          const skewSec = clientNowSec - payload.iat;
          // If the device clock is skewed relative to server token issuance by more than 30s,
          // shift expires_at to match the client device's clock frame of reference.
          if (Math.abs(skewSec) > 30) {
            session.expires_at = session.expires_at + skewSec;
            return JSON.stringify(session);
          }
        }
      }
    }
  } catch {
    // Return original unmodified string on any parse failure
  }
  return jsonStr;
}

export function getBrowserSupabaseClient(): SupabaseClient {
  if (clientInstance) return clientInstance;

  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Wrap client.auth.storage.getItem to adjust for client-side device clock skew.
  // When a user's device clock is ahead of server time (e.g. wrong timezone, AM/PM flipped,
  // or set in the future), the raw server `expires_at` causes GoTrue to perceive
  // valid tokens as expired immediately upon reading the cookie, triggering an infinite
  // refresh loop that exhausts refresh token reuse limits and forces unexpected logouts.
  if (client.auth && (client.auth as any).storage && typeof (client.auth as any).storage.getItem === "function") {
    const originalGetItem = (client.auth as any).storage.getItem.bind((client.auth as any).storage);
    (client.auth as any).storage.getItem = async (key: string) => {
      const raw = await originalGetItem(key);
      return normalizeSessionSkew(raw);
    };
  }

  clientInstance = client;
  return clientInstance;
}
