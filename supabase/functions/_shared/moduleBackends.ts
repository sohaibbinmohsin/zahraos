export function functionsUrlForModule(moduleKey: string): string | null {
  if (moduleKey === "youth-republic") {
    return Deno.env.get("YOUTH_REPUBLIC_BACKEND_FUNCTIONS_URL") ?? null;
  }
  return null;
}

export async function pushOrganizationSync(
  moduleKey: string,
  staffToken: string,
  organization: {
    id: string;
    name: string;
    slug: string;
    deactivatedAt: string | null;
    brandColor?: string | null;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    about?: string | null;
  },
): Promise<void> {
  const baseUrl = functionsUrlForModule(moduleKey);
  if (!baseUrl) return;

  await fetch(`${baseUrl}/sync-organization`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      deactivatedAt: organization.deactivatedAt,
      brandColor: organization.brandColor ?? null,
      logoUrl: organization.logoUrl ?? null,
      faviconUrl: organization.faviconUrl ?? null,
      about: organization.about ?? null,
    }),
  });
}
