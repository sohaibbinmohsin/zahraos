export interface StaffTokenClaims {
  actorType: string;
  staffId: string;
  platformOwner: boolean;
  orgRoles: { organizationId: string }[];
  moduleAccess: { organizationId: string; module: string; permissions: string[] }[];
}

export async function fetchStaffToken(platformAccessToken: string): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_FUNCTIONS_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_FUNCTIONS_URL is not set");
  }

  const response = await fetch(`${baseUrl}/mint-staff-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${platformAccessToken}`,
    },
    body: JSON.stringify({}),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "request_failed");
  }
  return data.token as string;
}

export function decodeStaffTokenClaims(token: string): StaffTokenClaims {
  const [, payloadSegment] = token.split(".");
  const payload = JSON.parse(atob(payloadSegment)) as Record<string, unknown>;

  return {
    actorType: String(payload.actor_type ?? "staff"),
    staffId: String(payload.staff_id ?? ""),
    platformOwner: Boolean(payload.platform_owner),
    orgRoles: Array.isArray(payload.org_roles)
      ? (payload.org_roles as Array<Record<string, unknown>>).map((r) => ({
        organizationId: String(r.organization_id),
      }))
      : [],
    moduleAccess: Array.isArray(payload.module_access)
      ? (payload.module_access as Array<Record<string, unknown>>).map((m) => ({
        organizationId: String(m.organization_id),
        module: String(m.module),
        permissions: Array.isArray(m.permissions) ? (m.permissions as unknown[]).map(String) : [],
      }))
      : [],
  };
}
