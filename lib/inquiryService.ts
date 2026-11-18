import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient';
import type { PartnerInquiry, InquiryStatus } from './inquiryTypes';

async function sessionToken(): Promise<string> {
  const supabase = getBrowserSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return token;
}

async function postPlatform<T>(name: string, body: unknown): Promise<T> {
  const token = await sessionToken();
  const response = await fetch(`/api/platform/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof payload.error === 'string' ? payload.error : 'request_failed') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

async function fetchOrgInquiriesDirect(organizationId: string): Promise<PartnerInquiry[]> {
  const supabase = getBrowserSupabaseClient();
  const { data, error } = await supabase
    .from('partner_inquiries')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as PartnerInquiry[]) || [];
}

export async function fetchOrgInquiries(organizationId: string): Promise<PartnerInquiry[]> {
  try {
    const payload = await postPlatform<{ inquiries?: PartnerInquiry[] }>('list-partner-inquiries', { organizationId });
    return payload.inquiries ?? [];
  } catch (err) {
    const status = (err as { status?: number }).status;
    // A denied token must not fall through to the browser query, which RLS
    // would silently empty. A missing server config can still use the direct
    // read so org admins keep working.
    if (status === 401 || status === 403) throw err;
    return fetchOrgInquiriesDirect(organizationId);
  }
}

export async function updateInquiryStatus(
  inquiryId: string,
  organizationId: string,
  status: InquiryStatus
): Promise<void> {
  await postPlatform('update-partner-inquiry', { inquiryId, organizationId, status });
}
