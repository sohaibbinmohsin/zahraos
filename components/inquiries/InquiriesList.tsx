"use client";

import React, { useState } from 'react';
import type { PartnerInquiry, InquiryStatus } from '@/lib/inquiryTypes';

interface InquiriesListProps {
  inquiries: PartnerInquiry[];
  organizationId: string;
  onStatusChange: (id: string, status: InquiryStatus) => Promise<void>;
  loading?: boolean;
}

const STATUS_BADGES: Record<InquiryStatus, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  in_review: 'bg-amber-100 text-amber-800 border-amber-200',
  contacted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  archived: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

export function InquiriesList({ inquiries, organizationId, onStatusChange, loading }: InquiriesListProps) {
  const [selectedInquiry, setSelectedInquiry] = useState<PartnerInquiry | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const orgInquiries = inquiries.filter((inq) => inq.organization_id === organizationId);
  const filtered = orgInquiries.filter((inq) => {
    if (filterStatus !== 'all' && inq.status !== filterStatus) return false;
    return true;
  });

  if (loading) {
    return <div className="p-8 text-center text-neutral-500">Loading inquiries...</div>;
  }

  if (orgInquiries.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed border-neutral-200 rounded-xl">
        <h3 className="text-base font-semibold text-neutral-800">No inquiries found</h3>
        <p className="text-sm text-neutral-500 mt-1">There are no partner submissions for this organization.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2">
        <div className="text-sm text-neutral-500">Showing {filtered.length} inquiries</div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-neutral-300 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="in_review">In Review</option>
          <option value="contacted">Contacted</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-neutral-200 rounded-xl bg-white space-y-3">
          <h3 className="text-base font-semibold text-neutral-800">No matching inquiries</h3>
          <p className="text-sm text-neutral-500">No inquiries match the selected status filter.</p>
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 rounded-xl bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 font-medium">
            <tr>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Contact</th>
              <th className="py-3 px-4">Organization</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-neutral-50/60 transition-colors">
                <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                  {new Date(item.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <div className="font-medium text-neutral-900">{item.name}</div>
                  <div className="text-xs text-neutral-500">{item.email}</div>
                  {item.phone && <div className="text-xs text-neutral-400">{item.phone}</div>}
                </td>
                <td className="py-3 px-4 text-neutral-700">{item.partner_organization || '-'}</td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-800">
                    {item.category}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <select
                    value={item.status}
                    onChange={(e) => onStatusChange(item.id, e.target.value as InquiryStatus)}
                    className={`text-xs font-medium px-2 py-1 rounded-full border ${STATUS_BADGES[item.status]} cursor-pointer`}
                  >
                    <option value="new">New</option>
                    <option value="in_review">In Review</option>
                    <option value="contacted">Contacted</option>
                    <option value="archived">Archived</option>
                  </select>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => setSelectedInquiry(item)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                  >
                    View Message
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* Message Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-lg text-neutral-900">{selectedInquiry.name}</h3>
                <p className="text-xs text-neutral-500">{selectedInquiry.email} • {selectedInquiry.category}</p>
              </div>
              <button
                onClick={() => setSelectedInquiry(null)}
                className="text-neutral-400 hover:text-neutral-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <div className="text-sm text-neutral-700 bg-neutral-50 p-4 rounded-xl whitespace-pre-wrap">
              {selectedInquiry.message}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedInquiry(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
