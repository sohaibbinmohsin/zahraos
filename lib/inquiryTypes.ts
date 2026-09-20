export type InquiryStatus = 'new' | 'in_review' | 'contacted' | 'archived';

export interface PartnerInquiry {
  id: string;
  organization_id: string;
  chapter_id?: string | null;
  name: string;
  email: string;
  phone: string;
  partner_organization: string;
  category: string;
  message: string;
  status: InquiryStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateInquiryInput {
  organization_id: string;
  chapter_id?: string | null;
  name: string;
  email: string;
  phone?: string;
  partner_organization?: string;
  category?: string;
  message: string;
}
