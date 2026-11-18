import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('0016_partner_inquiries migration', () => {
  it('defines valid multi-tenant table and RLS policies', () => {
    const migrationPath = join(process.cwd(), 'supabase/migrations/0016_partner_inquiries.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('create table if not exists partner_inquiries');
    expect(sql).toContain('organization_id uuid not null references organizations(id)');
    expect(sql).toContain('alter table partner_inquiries enable row level security');
    expect(sql).toContain('is_org_admin_or_above(organization_id)');
  });

  it('0020 widens select RLS to inquiries permission holders', () => {
    const migrationPath = join(process.cwd(), 'supabase/migrations/0020_partner_inquiries_permission_rls.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain("staff_has_org_permission(organization_id, 'inquiries', 'read')");
  });
});
