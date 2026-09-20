"use client";

import React, { useEffect, useState } from 'react';
import { useSelectedOrg } from '@/components/shell/AppShell';
import { InquiriesList } from '@/components/inquiries/InquiriesList';
import { fetchOrgInquiries, updateInquiryStatus } from '@/lib/inquiryService';
import type { PartnerInquiry, InquiryStatus } from '@/lib/inquiryTypes';

export default function InquiriesPage() {
  const selectedOrgId = useSelectedOrg();
  const [inquiries, setInquiries] = useState<PartnerInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData(orgId: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrgInquiries(orgId);
      setInquiries(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedOrgId) {
      loadData(selectedOrgId);
    }
  }, [selectedOrgId]);

  async function handleStatusChange(inquiryId: string, status: InquiryStatus) {
    if (!selectedOrgId) return;
    try {
      await updateInquiryStatus(inquiryId, selectedOrgId, status);
      setInquiries((prev) =>
        prev.map((item) => (item.id === inquiryId ? { ...item, status } : item))
      );
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  }

  if (!selectedOrgId) {
    return (
      <div className="p-8 text-neutral-500">
        Please select an organization from the switcher above.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Partner Inquiries</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Review and manage incoming partnership inquiries submitted through the website.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      <InquiriesList
        inquiries={inquiries}
        organizationId={selectedOrgId}
        onStatusChange={handleStatusChange}
        loading={loading}
      />
    </div>
  );
}
