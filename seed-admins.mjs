import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pavejgcutmzzolyyoutg.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdmVqZ2N1dG16em9seXlvdXRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzgyNjYzNiwiZXhwIjoyMTAzNDAyNjM2fQ.-J5Li4RppY7epoBL2Kh1Jv7aFdq1oDppJs4Vd0GMtoM";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedAdmin(email, password, fullName, platformOwner, orgRoles = []) {
  // 1. Check if auth user exists, delete or update password
  let userId = null;
  let page = 1;
  while (true) {
    const { data: listData } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    const users = listData?.users ?? [];
    if (users.length === 0) break;
    const found = users.find((u) => u.email === email);
    if (found) {
      userId = found.id;
      break;
    }
    if (users.length < 100) break;
    page++;
  }

  if (userId) {
    console.log(`Updating password for existing auth user ${email} (${userId})...`);
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { email_verified: true },
    });
    if (error) console.error("Error updating user:", error);
  } else {
    console.log(`Creating auth user ${email}...`);
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { email_verified: true },
    });
    if (error) {
      console.error("Error creating user:", error);
      throw error;
    }
    userId = created.user.id;
  }

  // 2. Ensure staff row
  const { data: staffRow, error: staffErr } = await supabase
    .from("staff")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  let staffId;
  if (staffRow) {
    staffId = staffRow.id;
    await supabase.from("staff").update({
      email,
      full_name: fullName,
      platform_owner: platformOwner,
      deactivated_at: null,
    }).eq("id", staffId);
  } else {
    const { data: newStaff, error: insertErr } = await supabase
      .from("staff")
      .insert({
        auth_user_id: userId,
        email,
        full_name: fullName,
        platform_owner: platformOwner,
      })
      .select()
      .single();
    if (insertErr) throw insertErr;
    staffId = newStaff.id;
  }

  // 3. Org roles
  for (const { orgId, tier } of orgRoles) {
    await supabase.from("staff_org_roles").upsert(
      {
        staff_id: staffId,
        organization_id: orgId,
        org_tier: tier,
      },
      { onConflict: "staff_id,organization_id" }
    );
  }

  console.log(`Successfully seeded ${email} (staff_id: ${staffId}, platform_owner: ${platformOwner})`);
}

async function seedLead(email, password, fullName, roleName, orgId, chapterSpecs) {
  // 1. Ensure auth user
  let userId = null;
  let page = 1;
  while (true) {
    const { data: listData } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    const users = listData?.users ?? [];
    if (users.length === 0) break;
    const found = users.find((u) => u.email === email);
    if (found) {
      userId = found.id;
      break;
    }
    if (users.length < 100) break;
    page++;
  }

  if (userId) {
    console.log(`Updating password for existing auth user ${email} (${userId})...`);
    await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { email_verified: true },
    });
  } else {
    console.log(`Creating auth user ${email}...`);
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { email_verified: true },
    });
    if (error) throw error;
    userId = created.user.id;
  }

  // 2. Ensure chapters exist
  for (const chap of chapterSpecs) {
    await supabase.from("chapters").upsert(
      {
        id: chap.id,
        organization_id: orgId,
        name: chap.name,
        city: chap.city,
        status: "active",
      },
      { onConflict: "id" }
    );
  }

  // 3. Ensure staff row
  const { data: staffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  let staffId;
  if (staffRow) {
    staffId = staffRow.id;
    await supabase.from("staff").update({
      email,
      full_name: fullName,
      platform_owner: false,
      status: "active",
      deactivated_at: null,
    }).eq("id", staffId);
  } else {
    const { data: newStaff, error: insertErr } = await supabase
      .from("staff")
      .insert({
        auth_user_id: userId,
        email,
        full_name: fullName,
        platform_owner: false,
        status: "active",
      })
      .select()
      .single();
    if (insertErr) throw insertErr;
    staffId = newStaff.id;
  }

  // 4. Staff org role (member tier)
  await supabase.from("staff_org_roles").upsert(
    {
      staff_id: staffId,
      organization_id: orgId,
      org_tier: "member",
    },
    { onConflict: "staff_id,organization_id" }
  );

  // 5. Lookup youth-republic module and role
  const { data: moduleRow } = await supabase
    .from("modules")
    .select("id")
    .eq("key", "youth-republic")
    .maybeSingle();

  const moduleId = moduleRow?.id;
  if (!moduleId) {
    console.warn(`Youth Republic module not found; skipping role assignment for ${email}`);
    return;
  }

  const { data: roleRow } = await supabase
    .from("roles")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", roleName)
    .maybeSingle();

  if (!roleRow) {
    console.warn(`Role ${roleName} not found in org ${orgId}; skipping role assignment for ${email}`);
    return;
  }

  // 6. Role assignments per chapter
  for (const chap of chapterSpecs) {
    await supabase.from("staff_role_assignments").upsert(
      {
        staff_id: staffId,
        organization_id: orgId,
        module_id: moduleId,
        role_id: roleRow.id,
        scope_kind: "chapter",
        chapter_id: chap.id,
        scope_label: chap.name,
      },
      { onConflict: "staff_id,role_id,chapter_id" }
    );
  }

  console.log(`Successfully seeded ${roleName}: ${email} (staff_id: ${staffId})`);
}

async function main() {
  const rizqOrgId = "10000000-0000-4000-8000-000000000001";
  const greenCrescentOrgId = "10000000-0000-4000-8000-000000000002";
  const sehatFirstOrgId = "10000000-0000-4000-8000-000000000003";
  const readFoundationOrgId = "10000000-0000-4000-8000-000000000004";

  await seedAdmin("super-admin@example.com", "SuperAdmin123!", "Super Admin", true, [
    { orgId: rizqOrgId, tier: "super_admin" },
    { orgId: greenCrescentOrgId, tier: "super_admin" },
    { orgId: sehatFirstOrgId, tier: "super_admin" },
    { orgId: readFoundationOrgId, tier: "super_admin" },
  ]);

  await seedAdmin("admin@rizq.example.com", "RizqAdmin123!", "Rizq Admin", false, [
    { orgId: rizqOrgId, tier: "super_admin" },
  ]);

  await seedAdmin("sohaibbinmohsin@gmail.com", "SuperAdmin123!", "Sohaib Bin Mohsin", true, [
    { orgId: rizqOrgId, tier: "super_admin" },
    { orgId: greenCrescentOrgId, tier: "super_admin" },
    { orgId: sehatFirstOrgId, tier: "super_admin" },
    { orgId: readFoundationOrgId, tier: "super_admin" },
  ]);

  const lahoreCentral = {
    id: "20000000-0000-4000-8000-000000000001",
    name: "Lahore Central",
    city: "Lahore",
  };
  const lahoreNorth = {
    id: "20000000-0000-4000-8000-000000000002",
    name: "Lahore North",
    city: "Lahore",
  };

  await seedLead(
    "chapterlead@rizq.org",
    "TestPassword123!",
    "Rizq Chapter Lead",
    "Chapter Lead",
    rizqOrgId,
    [lahoreCentral]
  );

  await seedLead(
    "citylead@rizq.org",
    "TestPassword123!",
    "Rizq City Lead",
    "City Lead",
    rizqOrgId,
    [lahoreCentral, lahoreNorth]
  );
}

main().catch(console.error);
