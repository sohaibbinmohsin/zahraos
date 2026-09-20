import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient';
import type { PartnerInquiry, InquiryStatus } from './inquiryTypes';

export async function fetchOrgInquiries(organizationId: string): Promise<PartnerInquiry[]> {
  const supabase = getBrowserSupabaseClient();
  const { data, error } = await supabase
    .from('partner_inquiries')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as PartnerInquiry[]) || [];
}

export async function updateInquiryStatus(
  inquiryId: string,
  organizationId: string,
  status: InquiryStatus
): Promise<void> {
  const supabase = getBrowserSupabaseClient();
  const { error } = await supabase
    .from('partner_inquiries')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', inquiryId)
    .eq('organization_id', organizationId);

  if (error) throw error;
}
