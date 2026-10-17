"use client";

import React, { useEffect, useState } from 'react';
import { useSelectedOrg } from '@/components/shell/AppShell';
import { useToast } from '@/components/shell/ToastContext';
import { InquiriesList } from '@/components/inquiries/InquiriesList';
import { fetchOrgInquiries, updateInquiryStatus } from '@/lib/inquiryService';
import type { PartnerInquiry, InquiryStatus } from '@/lib/inquiryTypes';

const SAVING9_INQUIRIES: PartnerInquiry[] = [
  {
    id: "inq-1",
    organization_id: "org-saving9",
    name: "Dr. Tariq Niazi",
    email: "tariq.niazi@ict.gov.pk",
    phone: "+92 300 5123456",
    partner_organization: "ICT Health Services (Islamabad)",
    category: "Government Partnership",
    message: "Proposal to integrate Saving 9 pre-hospital triage with Islamabad Rural Health Centers (RHCs).",
    status: "in_review",
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: "inq-2",
    organization_id: "org-saving9",
    name: "Amina Farooq",
    email: "amina.farooq@riphah.edu.pk",
    phone: "+92 321 9876543",
    partner_organization: "Riphah College of Rehabilitation & Allied Health",
    category: "Academic Training",
    message: "Request for student paramedic clinical rotations on Saving 9 ambulances.",
    status: "contacted",
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 36).toISOString(),
  },
  {
    id: "inq-3",
    organization_id: "org-saving9",
    name: "Dr. Sohail Akhtar",
    email: "sohail@shifa.com.pk",
    phone: "+92 333 4567890",
    partner_organization: "Shifa International Hospital Emergency Dept",
    category: "Hospital Network",
    message: "Establishing direct pre-alert VHF hotline for severe cardiac and neuro trauma transfers.",
    status: "new",
    created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 72).toISOString(),
  },
];

export default function InquiriesPage() {
  const selectedOrgId = useSelectedOrg();
  const { showToast } = useToast();
  const [inquiries, setInquiries] = useState<PartnerInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSaving9Host =
    typeof window !== "undefined" &&
    (window.location.hostname.startsWith("saving9.") || window.location.hostname.includes("saving9"));
  const isSaving9Demo = selectedOrgId === "org-saving9" || (!selectedOrgId && isSaving9Host);

  useEffect(() => {
    let isCancelled = false;
    if (isSaving9Demo) {
      setInquiries(SAVING9_INQUIRIES);
      setLoading(false);
      return;
    }
    if (!selectedOrgId) {
      setInquiries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchOrgInquiries(selectedOrgId)
      .then((data) => {
        if (!isCancelled) setInquiries(data);
      })
      .catch((err: any) => {
        if (!isCancelled) setError(err.message || 'Failed to load inquiries');
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [selectedOrgId, isSaving9Demo]);

  async function handleStatusChange(inquiryId: string, status: InquiryStatus) {
    if (isSaving9Demo) {
      setInquiries((prev) =>
        prev.map((item) => (item.id === inquiryId ? { ...item, status } : item))
      );
      showToast('Inquiry status updated successfully.');
      return;
    }
    if (!selectedOrgId) return;
    try {
      await updateInquiryStatus(inquiryId, selectedOrgId, status);
      setInquiries((prev) =>
        prev.map((item) => (item.id === inquiryId ? { ...item, status } : item))
      );
      showToast('Inquiry status updated successfully.');
    } catch (err: any) {
      showToast(`Error updating status: ${err.message}`);
    }
  }

  if (!selectedOrgId && !isSaving9Demo) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-[var(--ink-2)] font-medium">Please select an organization from the switcher above.</p>
      </div>
    );
  }

  const effectiveOrgId = selectedOrgId || (isSaving9Demo ? "org-saving9" : "");

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Partner Inquiries</h1>
          <div className="page-subtitle">
            Review and manage incoming partnership inquiries submitted through the website.
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      <InquiriesList
        inquiries={inquiries}
        organizationId={effectiveOrgId}
        onStatusChange={handleStatusChange}
        loading={loading}
      />
    </div>
  );
}
