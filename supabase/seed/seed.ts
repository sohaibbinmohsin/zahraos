// supabase/seed/seed.ts — Platform Database Seeder
//
// Seeds canonical organizations, modules, system roles, chapters,
// and staff accounts including dedicated Chapter Lead and City Lead accounts.
//
// Usage:
//   deno run -A supabase/seed/seed.ts
//   npx tsx supabase/seed/seed.ts
//
// Or import:
//   import { runSeed } from "./seed";
//   await runSeed(supabaseClient);

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Fixed Identifiers
// ---------------------------------------------------------------------------

export const SEED_ORGS = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    slug: "rizq",
    name: "Rizq",
    brand_color: "#D3BD2A",
    about: "Rizq is a Lahore-based non-profit working on food security and hunger relief.",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    slug: "green-crescent",
    name: "Green Crescent",
    brand_color: "#0B7A3B",
    about: "Environmental non-profit focused on urban forestry and clean water.",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    slug: "sehat-first",
    name: "Sehat First",
    brand_color: "#B02A2A",
    about: "Community health clinics and mobile dispensaries across Pakistan.",
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    slug: "read-foundation",
    name: "Read Foundation",
    brand_color: "#6E1560",
    about: "Educational equity and schooling for out-of-school children.",
  },
] as const;

export const SEED_CHAPTERS = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    name: "Lahore Central",
    city: "Lahore",
    organization_id: SEED_ORGS[0].id,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    name: "Lahore North",
    city: "Lahore",
    organization_id: SEED_ORGS[0].id,
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    name: "Karachi Central",
    city: "Karachi",
    organization_id: SEED_ORGS[0].id,
  },
] as const;

export const LEAD_ACCOUNTS = {
  chapterLead: {
    email: "chapterlead@rizq.org",
    password: "TestPassword123!",
    fullName: "Rizq Chapter Lead",
    role: "Chapter Lead",
    staffId: "30000000-0000-4000-8000-000000000001",
    authUserId: "40000000-0000-4000-8000-000000000001",
    chapterId: "20000000-0000-4000-8000-000000000001",
    chapterName: "Lahore Central",
  },
  cityLead: {
    email: "citylead@rizq.org",
    password: "TestPassword123!",
    fullName: "Rizq City Lead",
    role: "City Lead",
    staffId: "30000000-0000-4000-8000-000000000002",
    authUserId: "40000000-0000-4000-8000-000000000002",
    chapterIds: [
      "20000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000002",
    ],
    chapterNames: ["Lahore Central", "Lahore North"],
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function upsertAuthUser(
  supabase: SupabaseClient,
  email: string,
  password: string,
  preferredId: string,
): Promise<string> {
  let userId: string | null = null;
  let page = 1;
  while (true) {
    const { data: listData } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    const users = listData?.users ?? [];
    if (users.length === 0) break;
    const found = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      userId = found.id;
      break;
    }
    if (users.length < 100) break;
    page++;
  }

  if (userId) {
    await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { email_verified: true },
    });
    return userId;
  }

  const { data: created, error } = await supabase.auth.admin.createUser({
    id: preferredId,
    email,
    password,
    email_confirm: true,
    user_metadata: { email_verified: true },
  });

  if (error) {
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

async function ensureStaffRoleAssignment(
  supabase: SupabaseClient,
  assignment: {
    staff_id: string;
    organization_id: string;
    module_id: string;
    role_id: string;
    scope_kind: "chapter" | "org_wide";
    chapter_id: string | null;
    scope_label: string;
  },
): Promise<void> {
  let query = supabase
    .from("staff_role_assignments")
    .select("id")
    .eq("staff_id", assignment.staff_id)
    .eq("role_id", assignment.role_id);

  if (assignment.chapter_id) {
    query = query.eq("chapter_id", assignment.chapter_id);
  } else {
    query = query.is("chapter_id", null);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    await supabase
      .from("staff_role_assignments")
      .update({
        organization_id: assignment.organization_id,
        module_id: assignment.module_id,
        scope_kind: assignment.scope_kind,
        scope_label: assignment.scope_label,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("staff_role_assignments").insert(assignment);
  }
}

// ---------------------------------------------------------------------------
// Main Seed Function
// ---------------------------------------------------------------------------

export async function runSeed(supabase: SupabaseClient) {
  console.log("Seeding platform organizations...");
  for (const org of SEED_ORGS) {
    await supabase.from("organizations").upsert(
      {
        id: org.id,
        slug: org.slug,
        name: org.name,
        brand_color: org.brand_color,
        about: org.about,
      },
      { onConflict: "id" },
    );
  }

  console.log("Ensuring youth-republic module enablement & system roles...");
  const { data: moduleRow } = await supabase
    .from("modules")
    .select("id")
    .eq("key", "youth-republic")
    .maybeSingle();

  const moduleId = moduleRow?.id ?? "50000000-0000-4000-8000-000000000001";

  for (const org of SEED_ORGS) {
    await supabase.from("org_modules").upsert(
      { organization_id: org.id, module_id: moduleId },
      { onConflict: "organization_id,module_id", ignoreDuplicates: true },
    );

    try {
      await supabase.rpc("seed_youth_republic_system_roles", {
        p_org_id: org.id,
        p_module_id: moduleId,
      });
    } catch {
      // Ignore if RPC already seeded or not present
    }
  }

  console.log("Seeding chapters for Rizq...");
  for (const chap of SEED_CHAPTERS) {
    await supabase.from("chapters").upsert(
      {
        id: chap.id,
        organization_id: chap.organization_id,
        name: chap.name,
        city: chap.city,
        status: "active",
      },
      { onConflict: "id" },
    );
  }

  // Lookup Role IDs for Chapter Lead & City Lead
  const rizqOrgId = SEED_ORGS[0].id;
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
    chapterLeadRoleId = newRole?.id ?? "60000000-0000-4000-8000-000000000001";
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
    cityLeadRoleId = newRole?.id ?? "60000000-0000-4000-8000-000000000002";
  }

  console.log("Seeding Chapter Lead: chapterlead@rizq.org...");
  let clAuthUserId: string = LEAD_ACCOUNTS.chapterLead.authUserId;
  try {
    clAuthUserId = await upsertAuthUser(
      supabase,
      LEAD_ACCOUNTS.chapterLead.email,
      LEAD_ACCOUNTS.chapterLead.password,
      LEAD_ACCOUNTS.chapterLead.authUserId,
    );
  } catch (err) {
    console.warn("Auth user creation error (may be test/mock):", err);
  }

  const { data: clStaffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("email", LEAD_ACCOUNTS.chapterLead.email)
    .maybeSingle();

  const clStaffId = clStaffRow?.id ?? LEAD_ACCOUNTS.chapterLead.staffId;

  await supabase.from("staff").upsert(
    {
      id: clStaffId,
      auth_user_id: clAuthUserId,
      email: LEAD_ACCOUNTS.chapterLead.email,
      full_name: LEAD_ACCOUNTS.chapterLead.fullName,
      platform_owner: false,
      status: "active",
    },
    { onConflict: "id" },
  );

  await supabase.from("staff_org_roles").upsert(
    {
      staff_id: clStaffId,
      organization_id: rizqOrgId,
      org_tier: "member",
    },
    { onConflict: "staff_id,organization_id" },
  );

  await ensureStaffRoleAssignment(supabase, {
    staff_id: clStaffId,
    organization_id: rizqOrgId,
    module_id: moduleId,
    role_id: chapterLeadRoleId,
    scope_kind: "chapter",
    chapter_id: LEAD_ACCOUNTS.chapterLead.chapterId,
    scope_label: LEAD_ACCOUNTS.chapterLead.chapterName,
  });

  console.log("Seeding City Lead: citylead@rizq.org...");
  let cityLeadAuthUserId: string = LEAD_ACCOUNTS.cityLead.authUserId;
  try {
    cityLeadAuthUserId = await upsertAuthUser(
      supabase,
      LEAD_ACCOUNTS.cityLead.email,
      LEAD_ACCOUNTS.cityLead.password,
      LEAD_ACCOUNTS.cityLead.authUserId,
    );
  } catch (err) {
    console.warn("Auth user creation error (may be test/mock):", err);
  }

  const { data: cityStaffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("email", LEAD_ACCOUNTS.cityLead.email)
    .maybeSingle();

  const cityStaffId = cityStaffRow?.id ?? LEAD_ACCOUNTS.cityLead.staffId;

  await supabase.from("staff").upsert(
    {
      id: cityStaffId,
      auth_user_id: cityLeadAuthUserId,
      email: LEAD_ACCOUNTS.cityLead.email,
      full_name: LEAD_ACCOUNTS.cityLead.fullName,
      platform_owner: false,
      status: "active",
    },
    { onConflict: "id" },
  );

  await supabase.from("staff_org_roles").upsert(
    {
      staff_id: cityStaffId,
      organization_id: rizqOrgId,
      org_tier: "member",
    },
    { onConflict: "staff_id,organization_id" },
  );

  // Multi-chapter assignments for City Lead: Lahore Central & Lahore North
  await ensureStaffRoleAssignment(supabase, {
    staff_id: cityStaffId,
    organization_id: rizqOrgId,
    module_id: moduleId,
    role_id: cityLeadRoleId,
    scope_kind: "chapter",
    chapter_id: LEAD_ACCOUNTS.cityLead.chapterIds[0],
    scope_label: LEAD_ACCOUNTS.cityLead.chapterNames[0],
  });

  await ensureStaffRoleAssignment(supabase, {
    staff_id: cityStaffId,
    organization_id: rizqOrgId,
    module_id: moduleId,
    role_id: cityLeadRoleId,
    scope_kind: "chapter",
    chapter_id: LEAD_ACCOUNTS.cityLead.chapterIds[1],
    scope_label: LEAD_ACCOUNTS.cityLead.chapterNames[1],
  });

  console.log("Seeding completed successfully.");
  return {
    chapterLead: {
      email: LEAD_ACCOUNTS.chapterLead.email,
      password: LEAD_ACCOUNTS.chapterLead.password,
      role: "Chapter Lead",
      scope: LEAD_ACCOUNTS.chapterLead.chapterName,
    },
    cityLead: {
      email: LEAD_ACCOUNTS.cityLead.email,
      password: LEAD_ACCOUNTS.cityLead.password,
      role: "City Lead",
      scopes: LEAD_ACCOUNTS.cityLead.chapterNames,
    },
  };
}

export async function main() {
  const getEnv = (key: string): string | undefined => {
    if (typeof process !== "undefined" && process.env) {
      return process.env[key];
    }
    // @ts-ignore Deno global support
    if (typeof Deno !== "undefined" && Deno.env) {
      // @ts-ignore
      return Deno.env.get(key);
    }
    return undefined;
  };

  const url =
    getEnv("SUPABASE_URL") ||
    getEnv("ADMIN_SUPABASE_URL") ||
    getEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    "https://pavejgcutmzzolyyoutg.supabase.co";

  const key =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    getEnv("ADMIN_SERVICE_ROLE_KEY") ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdmVqZ2N1dG16em9seXlvdXRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzgyNjYzNiwiZXhwIjoyMTAzNDAyNjM2fQ.-J5Li4RppY7epoBL2Kh1Jv7aFdq1oDppJs4Vd0GMtoM";

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await runSeed(supabase);
  console.log("Seed verification info:", JSON.stringify(result, null, 2));
}

// Auto-run if executed as script
if (
  (typeof process !== "undefined" && process.argv && process.argv[1]?.endsWith("seed.ts")) ||
  // @ts-ignore Deno main check
  (typeof import.meta !== "undefined" && import.meta.main)
) {
  main().catch(console.error);
}
