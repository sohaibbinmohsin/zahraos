"use client";

import React, { useState } from 'react';
import type { PartnerInquiry, InquiryStatus } from '@/lib/inquiryTypes';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';

interface InquiriesListProps {
  inquiries: PartnerInquiry[];
  organizationId: string;
  onStatusChange: (id: string, status: InquiryStatus) => Promise<void>;
  loading?: boolean;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'new', label: 'New' },
  { value: 'in_review', label: 'In Review' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'archived', label: 'Archived' },
];

const FILTER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Statuses' },
  ...STATUS_OPTIONS,
];

export function InquiriesTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading inquiries">
      <span className="sr-only">Loading inquiries...</span>
      <div className="flex items-center justify-between pb-2">
        <Skeleton w={140} h={16} />
        <Skeleton w={176} h={36} style={{ borderRadius: 8 }} />
      </div>
      <div className="border border-neutral-200 rounded-xl bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600 border-b border-neutral-200 font-medium">
            <tr>
              <th className="py-3 px-4"><Skeleton w={50} h={12} /></th>
              <th className="py-3 px-4"><Skeleton w={80} h={12} /></th>
              <th className="py-3 px-4"><Skeleton w={100} h={12} /></th>
              <th className="py-3 px-4"><Skeleton w={70} h={12} /></th>
              <th className="py-3 px-4"><Skeleton w={60} h={12} /></th>
              <th className="py-3 px-4 text-right"><div className="flex justify-end"><Skeleton w={60} h={12} /></div></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                <td className="py-3.5 px-4"><Skeleton w={75} h={13} /></td>
                <td className="py-3.5 px-4">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton w={120} h={14} />
                    <Skeleton w={150} h={11} />
                  </div>
                </td>
                <td className="py-3.5 px-4"><Skeleton w={110} h={13} /></td>
                <td className="py-3.5 px-4"><Skeleton w={90} h={22} style={{ borderRadius: 4 }} /></td>
                <td className="py-3.5 px-4"><Skeleton w={120} h={32} style={{ borderRadius: 8 }} /></td>
                <td className="py-3.5 px-4 text-right">
                  <div className="flex justify-end">
                    <Skeleton w={85} h={26} style={{ borderRadius: 6 }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InquiriesList({ inquiries, organizationId, onStatusChange, loading }: InquiriesListProps) {
  const [selectedInquiry, setSelectedInquiry] = useState<PartnerInquiry | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const orgInquiries = inquiries.filter((inq) => inq.organization_id === organizationId);
  const filtered = orgInquiries.filter((inq) => {
    if (filterStatus !== 'all' && inq.status !== filterStatus) return false;
    return true;
  });

  if (loading) {
    return <InquiriesTableSkeleton />;
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
        <Select
          aria-label="Filter by status"
          value={filterStatus}
          onChange={setFilterStatus}
          options={FILTER_OPTIONS}
          className="w-44"
        />
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
        <div className="overflow-x-auto border border-neutral-200 rounded-xl bg-white shadow-xs min-h-[300px]">
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
                  <div className="flex flex-col gap-1 items-start">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-800">
                      {item.category}
                    </span>
                    {item.chapter_id && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        GroRizq
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <Select
                    aria-label={`Status for ${item.name}`}
                    value={item.status}
                    onChange={(val) => onStatusChange(item.id, val as InquiryStatus)}
                    options={STATUS_OPTIONS}
                    className="w-36"
                  />
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
                <p className="text-xs text-neutral-500">
                  {selectedInquiry.email} • {selectedInquiry.category}
                  {selectedInquiry.chapter_id ? ' • GroRizq Chapter' : ''}
                </p>
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
