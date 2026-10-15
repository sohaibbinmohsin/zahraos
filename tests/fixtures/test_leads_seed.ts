import type { StaffTokenClaims } from "@/lib/staffToken";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Fixed Seed Identifiers
// ---------------------------------------------------------------------------

export const SEED_ORGS = {
  rizq: "10000000-0000-4000-8000-000000000001",
  greenCrescent: "10000000-0000-4000-8000-000000000002",
  sehatFirst: "10000000-0000-4000-8000-000000000003",
  readFoundation: "10000000-0000-4000-8000-000000000004",
} as const;

export const SEED_CHAPTERS = {
  lahoreCentral: {
    id: "20000000-0000-4000-8000-000000000001",
    name: "Lahore Central",
    city: "Lahore",
    organizationId: SEED_ORGS.rizq,
  },
  lahoreNorth: {
    id: "20000000-0000-4000-8000-000000000002",
    name: "Lahore North",
    city: "Lahore",
    organizationId: SEED_ORGS.rizq,
  },
  karachiCentral: {
    id: "20000000-0000-4000-8000-000000000003",
    name: "Karachi Central",
    city: "Karachi",
    organizationId: SEED_ORGS.rizq,
  },
} as const;

export const LEAD_PERMISSIONS = [
  "opportunities:write",
  "opportunities:read",
  "noticeboard:write",
  "noticeboard:read",
  "applications:update",
  "applications:read",
  "hours:update",
  "hours:read",
  "chapters:write",
  "chapters:read",
] as const;

// ---------------------------------------------------------------------------
// Credentials Definitions
// ---------------------------------------------------------------------------

export interface LeadCredentials {
  email: string;
  password: string;
  fullName: string;
  role: "Chapter Lead" | "City Lead";
  organizationId: string;
  staffId: string;
  authUserId: string;
  chapterId?: string;
  chapterName?: string;
  chapterIds?: string[];
  chapterNames?: string[];
}

export const CHAPTER_LEAD_CREDENTIALS: LeadCredentials = {
  email: "chapterlead@rizq.org",
  password: "TestPassword123!",
  fullName: "Rizq Chapter Lead",
  role: "Chapter Lead",
  organizationId: SEED_ORGS.rizq,
  staffId: "30000000-0000-4000-8000-000000000001",
  authUserId: "40000000-0000-4000-8000-000000000001",
  chapterId: SEED_CHAPTERS.lahoreCentral.id,
  chapterName: SEED_CHAPTERS.lahoreCentral.name,
};

export const CITY_LEAD_CREDENTIALS: LeadCredentials = {
  email: "citylead@rizq.org",
  password: "TestPassword123!",
  fullName: "Rizq City Lead",
  role: "City Lead",
  organizationId: SEED_ORGS.rizq,
  staffId: "30000000-0000-4000-8000-000000000002",
  authUserId: "40000000-0000-4000-8000-000000000002",
  chapterIds: [SEED_CHAPTERS.lahoreCentral.id, SEED_CHAPTERS.lahoreNorth.id],
  chapterNames: [SEED_CHAPTERS.lahoreCentral.name, SEED_CHAPTERS.lahoreNorth.name],
};

export function getChapterLeadCredentials(): LeadCredentials {
  return { ...CHAPTER_LEAD_CREDENTIALS };
}

export function getCityLeadCredentials(): LeadCredentials {
  return {
    ...CITY_LEAD_CREDENTIALS,
    chapterIds: [...CITY_LEAD_CREDENTIALS.chapterIds!],
    chapterNames: [...CITY_LEAD_CREDENTIALS.chapterNames!],
  };
}

// ---------------------------------------------------------------------------
// Claims & Token Helpers
// ---------------------------------------------------------------------------

export interface LeadClaimsOptions {
  staffId?: string;
  organizationId?: string;
  chapterId?: string;
  permissions?: string[];
}

export interface CityLeadClaimsOptions {
  staffId?: string;
  organizationId?: string;
  chapterIds?: string[];
  permissions?: string[];
}

export function makeChapterLeadClaims(options?: LeadClaimsOptions): StaffTokenClaims {
  const staffId = options?.staffId ?? CHAPTER_LEAD_CREDENTIALS.staffId;
  const organizationId = options?.organizationId ?? SEED_ORGS.rizq;
  const chapterId = options?.chapterId ?? SEED_CHAPTERS.lahoreCentral.id;
  const permissions = options?.permissions ? [...options.permissions] : [...LEAD_PERMISSIONS];

  const chapterScopes: Record<string, string[]> = {};
  for (const perm of permissions) {
    chapterScopes[perm] = [chapterId];
  }

  return {
    actorType: "staff",
    staffId,
    platformOwner: false,
    orgRoles: [{ organizationId }],
    moduleAccess: [
      {
        organizationId,
        module: "youth-republic",
        permissions,
        chapterScopes,
      },
    ],
  };
}

export function makeCityLeadClaims(options?: CityLeadClaimsOptions): StaffTokenClaims {
  const staffId = options?.staffId ?? CITY_LEAD_CREDENTIALS.staffId;
  const organizationId = options?.organizationId ?? SEED_ORGS.rizq;
  const chapterIds = options?.chapterIds ? [...options.chapterIds] : [...CITY_LEAD_CREDENTIALS.chapterIds!];
  const permissions = options?.permissions ? [...options.permissions] : [...LEAD_PERMISSIONS];

  const chapterScopes: Record<string, string[]> = {};
  for (const perm of permissions) {
    chapterScopes[perm] = [...chapterIds];
  }

  return {
    actorType: "staff",
    staffId,
    platformOwner: false,
    orgRoles: [{ organizationId }],
    moduleAccess: [
      {
        organizationId,
        module: "youth-republic",
        permissions,
        chapterScopes,
      },
    ],
  };
}

export function makeChapterLeadTokenPayload(options?: LeadClaimsOptions): Record<string, unknown> {
  const staffId = options?.staffId ?? CHAPTER_LEAD_CREDENTIALS.staffId;
  const organizationId = options?.organizationId ?? SEED_ORGS.rizq;
  const chapterId = options?.chapterId ?? SEED_CHAPTERS.lahoreCentral.id;
  const permissions = options?.permissions ? [...options.permissions] : [...LEAD_PERMISSIONS];

  const chapter_scopes: Record<string, string[]> = {};
  for (const perm of permissions) {
    chapter_scopes[perm] = [chapterId];
  }

  return {
    exp: Math.floor(Date.now() / 1000) + 3600,
    actor_type: "staff",
    staff_id: staffId,
    platform_owner: false,
    can_verify_identity: false,
    org_roles: [{ organization_id: organizationId }],
    module_access: [
      {
        organization_id: organizationId,
        module: "youth-republic",
        permissions,
        chapter_scopes,
      },
    ],
  };
}

export function makeCityLeadTokenPayload(options?: CityLeadClaimsOptions): Record<string, unknown> {
  const staffId = options?.staffId ?? CITY_LEAD_CREDENTIALS.staffId;
  const organizationId = options?.organizationId ?? SEED_ORGS.rizq;
  const chapterIds = options?.chapterIds ? [...options.chapterIds] : [...CITY_LEAD_CREDENTIALS.chapterIds!];
  const permissions = options?.permissions ? [...options.permissions] : [...LEAD_PERMISSIONS];

  const chapter_scopes: Record<string, string[]> = {};
  for (const perm of permissions) {
    chapter_scopes[perm] = [...chapterIds];
  }

  return {
    exp: Math.floor(Date.now() / 1000) + 3600,
    actor_type: "staff",
    staff_id: staffId,
    platform_owner: false,
    can_verify_identity: false,
    org_roles: [{ organization_id: organizationId }],
    module_access: [
      {
        organization_id: organizationId,
        module: "youth-republic",
        permissions,
        chapter_scopes,
      },
    ],
  };
}

export function encodeFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

export function makeChapterLeadToken(options?: LeadClaimsOptions): string {
  return encodeFakeJwt(makeChapterLeadTokenPayload(options));
}

export function makeCityLeadToken(options?: CityLeadClaimsOptions): string {
  return encodeFakeJwt(makeCityLeadTokenPayload(options));
}

// ---------------------------------------------------------------------------
// Database Seeding Helper
// ---------------------------------------------------------------------------

export interface SeedLeadsResult {
  chapterLead: {
    email: string;
    staffId: string;
    authUserId: string;
    role: string;
    chapterName: string;
    chapterId: string;
  };
  cityLead: {
    email: string;
    staffId: string;
    authUserId: string;
    role: string;
    chapterNames: string[];
    chapterIds: string[];
  };
  chapters: Array<{ id: string; name: string; city: string; organizationId: string }>;
}

async function ensureAuthUser(
  supabase: SupabaseClient,
  email: string,
  password: string,
  authUserIdFallback: string,
): Promise<string> {
  // Check if user already exists
  let existingUserId: string | null = null;
  let page = 1;
  while (true) {
    const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (listErr || !listData?.users || listData.users.length === 0) break;
    const found = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      existingUserId = found.id;
      break;
    }
    if (listData.users.length < 100) break;
    page++;
  }

  if (existingUserId) {
    await supabase.auth.admin.updateUserById(existingUserId, {
      password,
      email_confirm: true,
      user_metadata: { email_verified: true },
    });
    return existingUserId;
  }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    id: authUserIdFallback,
    email,
    password,
    email_confirm: true,
    user_metadata: { email_verified: true },
  });

  if (createErr) {
    // If id conflict or already registered, fallback without specified ID or search
    const { data: retryCreated, error: retryErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { email_verified: true },
    });
    if (retryErr) throw retryErr;
    return retryCreated.user.id;
  }

  return created.user.id;
}

export async function seedChapterAndCityLeads(
  supabase: SupabaseClient,
): Promise<SeedLeadsResult> {
  const rizqOrgId = SEED_ORGS.rizq;

  // 1. Ensure Chapters exist
  const chaptersToSeed = [
    SEED_CHAPTERS.lahoreCentral,
    SEED_CHAPTERS.lahoreNorth,
    SEED_CHAPTERS.karachiCentral,
  ];

  for (const chap of chaptersToSeed) {
    await supabase.from("chapters").upsert(
      {
        id: chap.id,
        organization_id: chap.organizationId,
        name: chap.name,
        city: chap.city,
        status: "active",
      },
      { onConflict: "id" },
    );
  }

  // 2. Lookup youth-republic module
  const { data: moduleRow } = await supabase
    .from("modules")
    .select("id")
    .eq("key", "youth-republic")
    .maybeSingle();

  const moduleId = moduleRow?.id ?? "m1000000-0000-4000-8000-000000000001";

  // Ensure system roles are seeded if rpc is available
  try {
    await supabase.rpc("seed_youth_republic_system_roles", {
      p_org_id: rizqOrgId,
      p_module_id: moduleId,
    });
  } catch {
    // Ignore if RPC does not exist in testing mock
  }

  // Lookup role IDs for Chapter Lead & City Lead
  const { data: roles } = await supabase
    .from("roles")
    .select("id, name")
    .eq("organization_id", rizqOrgId)
    .in("name", ["Chapter Lead", "City Lead"]);

  let chapterLeadRoleId = roles?.find((r) => r.name === "Chapter Lead")?.id;
  let cityLeadRoleId = roles?.find((r) => r.name === "City Lead")?.id;

  if (!chapterLeadRoleId) {
    const { data: newRole } = await supabase
      .from("roles")
      .upsert(
        {
          organization_id: rizqOrgId,
          module_id: moduleId,
          name: "Chapter Lead",
          description: "Oversees local chapter operations, drive execution, applicant selection, hours verification, and chapter roster governance.",
        },
        { onConflict: "organization_id,module_id,name" },
      )
      .select("id")
      .single();
    chapterLeadRoleId = newRole?.id ?? "r1000000-0000-4000-8000-000000000001";
  }

  if (!cityLeadRoleId) {
    const { data: newRole } = await supabase
      .from("roles")
      .upsert(
        {
          organization_id: rizqOrgId,
          module_id: moduleId,
          name: "City Lead",
          description: "Oversees multi-chapter regional operations, drive execution, applicant selection, hours verification, and chapter roster governance.",
        },
        { onConflict: "organization_id,module_id,name" },
      )
      .select("id")
      .single();
    cityLeadRoleId = newRole?.id ?? "r1000000-0000-4000-8000-000000000002";
  }

  // 3. Seed Chapter Lead User
  let clAuthUserId = CHAPTER_LEAD_CREDENTIALS.authUserId;
  try {
    clAuthUserId = await ensureAuthUser(
      supabase,
      CHAPTER_LEAD_CREDENTIALS.email,
      CHAPTER_LEAD_CREDENTIALS.password,
      CHAPTER_LEAD_CREDENTIALS.authUserId,
    );
  } catch (e) {
    console.warn("Auth user creation skipped or mock environment:", e);
  }

  // Ensure staff row
  const { data: clStaffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("email", CHAPTER_LEAD_CREDENTIALS.email)
    .maybeSingle();

  const clStaffId = clStaffRow?.id ?? CHAPTER_LEAD_CREDENTIALS.staffId;

  await supabase.from("staff").upsert(
    {
      id: clStaffId,
      auth_user_id: clAuthUserId,
      email: CHAPTER_LEAD_CREDENTIALS.email,
      full_name: CHAPTER_LEAD_CREDENTIALS.fullName,
      platform_owner: false,
      status: "active",
    },
    { onConflict: "id" },
  );

  // Staff org role (member tier)
  await supabase.from("staff_org_roles").upsert(
    {
      staff_id: clStaffId,
      organization_id: rizqOrgId,
      org_tier: "member",
    },
    { onConflict: "staff_id,organization_id" },
  );

  // Staff role assignment for Chapter Lead (Lahore Central)
  await supabase.from("staff_role_assignments").upsert(
    {
      staff_id: clStaffId,
      organization_id: rizqOrgId,
      module_id: moduleId,
      role_id: chapterLeadRoleId,
      scope_kind: "chapter",
      chapter_id: SEED_CHAPTERS.lahoreCentral.id,
      scope_label: SEED_CHAPTERS.lahoreCentral.name,
    },
    { onConflict: "staff_id,role_id,chapter_id" },
  );

  // 4. Seed City Lead User
  let cityLeadAuthUserId = CITY_LEAD_CREDENTIALS.authUserId;
  try {
    cityLeadAuthUserId = await ensureAuthUser(
      supabase,
      CITY_LEAD_CREDENTIALS.email,
      CITY_LEAD_CREDENTIALS.password,
      CITY_LEAD_CREDENTIALS.authUserId,
    );
  } catch (e) {
    console.warn("Auth user creation skipped or mock environment:", e);
  }

  const { data: cityStaffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("email", CITY_LEAD_CREDENTIALS.email)
    .maybeSingle();

  const cityStaffId = cityStaffRow?.id ?? CITY_LEAD_CREDENTIALS.staffId;

  await supabase.from("staff").upsert(
    {
      id: cityStaffId,
      auth_user_id: cityLeadAuthUserId,
      email: CITY_LEAD_CREDENTIALS.email,
      full_name: CITY_LEAD_CREDENTIALS.fullName,
      platform_owner: false,
      status: "active",
    },
    { onConflict: "id" },
  );

  // Staff org role (member tier)
  await supabase.from("staff_org_roles").upsert(
    {
      staff_id: cityStaffId,
      organization_id: rizqOrgId,
      org_tier: "member",
    },
    { onConflict: "staff_id,organization_id" },
  );

  // Staff role assignments for City Lead: Row 1 = Lahore Central, Row 2 = Lahore North
  await supabase.from("staff_role_assignments").upsert(
    {
      staff_id: cityStaffId,
      organization_id: rizqOrgId,
      module_id: moduleId,
      role_id: cityLeadRoleId,
      scope_kind: "chapter",
      chapter_id: SEED_CHAPTERS.lahoreCentral.id,
      scope_label: SEED_CHAPTERS.lahoreCentral.name,
    },
    { onConflict: "staff_id,role_id,chapter_id" },
  );

  await supabase.from("staff_role_assignments").upsert(
    {
      staff_id: cityStaffId,
      organization_id: rizqOrgId,
      module_id: moduleId,
      role_id: cityLeadRoleId,
      scope_kind: "chapter",
      chapter_id: SEED_CHAPTERS.lahoreNorth.id,
      scope_label: SEED_CHAPTERS.lahoreNorth.name,
    },
    { onConflict: "staff_id,role_id,chapter_id" },
  );

  return {
    chapterLead: {
      email: CHAPTER_LEAD_CREDENTIALS.email,
      staffId: clStaffId,
      authUserId: clAuthUserId,
      role: "Chapter Lead",
      chapterName: SEED_CHAPTERS.lahoreCentral.name,
      chapterId: SEED_CHAPTERS.lahoreCentral.id,
    },
    cityLead: {
      email: CITY_LEAD_CREDENTIALS.email,
      staffId: cityStaffId,
      authUserId: cityLeadAuthUserId,
      role: "City Lead",
      chapterNames: [SEED_CHAPTERS.lahoreCentral.name, SEED_CHAPTERS.lahoreNorth.name],
      chapterIds: [SEED_CHAPTERS.lahoreCentral.id, SEED_CHAPTERS.lahoreNorth.id],
    },
    chapters: chaptersToSeed,
  };
}
