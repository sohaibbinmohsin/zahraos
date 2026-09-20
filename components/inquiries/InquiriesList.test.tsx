import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { InquiriesList } from './InquiriesList';
import type { PartnerInquiry } from '@/lib/inquiryTypes';

const mockInquiries: PartnerInquiry[] = [
  {
    id: 'inq-1',
    organization_id: 'org-grorizq',
    name: 'Ahmed Khan',
    email: 'ahmed@example.com',
    phone: '+923001234567',
    partner_organization: 'Agri Corp',
    category: 'Corporate Farming',
    message: 'Interested in partnering on 500 acres.',
    status: 'new',
    created_at: '2026-09-20T12:00:00Z',
    updated_at: '2026-09-20T12:00:00Z',
  },
  {
    id: 'inq-2',
    organization_id: 'other-org',
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '',
    partner_organization: 'Other Org',
    category: 'Other',
    message: 'Message for other org',
    status: 'new',
    created_at: '2026-09-20T12:00:00Z',
    updated_at: '2026-09-20T12:00:00Z',
  },
  {
    id: 'inq-3',
    organization_id: 'org-grorizq',
    name: 'Bilal Tariq',
    email: 'bilal@example.com',
    phone: '+923009876543',
    partner_organization: 'Solar Tech',
    category: 'Solar Tube Wells',
    message: 'We provide solar tube well installations.',
    status: 'contacted',
    created_at: '2026-09-20T14:00:00Z',
    updated_at: '2026-09-20T14:00:00Z',
  },
];

describe('InquiriesList Component', () => {
  it('renders only inquiries belonging to the current organizationId', () => {
    render(
      <InquiriesList
        inquiries={mockInquiries}
        organizationId="org-grorizq"
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText('Ahmed Khan')).toBeInTheDocument();
    expect(screen.getByText('Bilal Tariq')).toBeInTheDocument();
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
  });

  it('triggers onStatusChange when status dropdown changes', () => {
    const onStatusChange = vi.fn().mockResolvedValue(undefined);
    render(
      <InquiriesList
        inquiries={mockInquiries}
        organizationId="org-grorizq"
        onStatusChange={onStatusChange}
      />
    );

    const statusDropdown = screen.getByRole('combobox', { name: 'Status for Ahmed Khan' });
    fireEvent.click(statusDropdown);
    const contactedOption = screen.getByRole('option', { name: 'Contacted' });
    fireEvent.click(contactedOption);

    expect(onStatusChange).toHaveBeenCalledWith('inq-1', 'contacted');
  });

  it('shows loading state when loading is true', () => {
    render(
      <InquiriesList
        inquiries={[]}
        organizationId="org-grorizq"
        onStatusChange={vi.fn()}
        loading={true}
      />
    );

    expect(screen.getByText('Loading inquiries...')).toBeInTheDocument();
  });

  it('shows empty state when no inquiries match organization', () => {
    render(
      <InquiriesList
        inquiries={[]}
        organizationId="org-grorizq"
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText('No inquiries found')).toBeInTheDocument();
  });

  it('filters inquiries by status dropdown', () => {
    render(
      <InquiriesList
        inquiries={mockInquiries}
        organizationId="org-grorizq"
        onStatusChange={vi.fn()}
      />
    );

    const filterDropdown = screen.getByRole('combobox', { name: 'Filter by status' });
    fireEvent.click(filterDropdown);
    const contactedOption = screen.getByRole('option', { name: 'Contacted' });
    fireEvent.click(contactedOption);

    expect(screen.queryByText('Ahmed Khan')).not.toBeInTheDocument();
    expect(screen.getByText('Bilal Tariq')).toBeInTheDocument();
  });

  it('opens and closes message modal', () => {
    render(
      <InquiriesList
        inquiries={mockInquiries}
        organizationId="org-grorizq"
        onStatusChange={vi.fn()}
      />
    );

    const viewButtons = screen.getAllByRole('button', { name: /View Message/i });
    fireEvent.click(viewButtons[0]);

    expect(screen.getByText('Interested in partnering on 500 acres.')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeButton);

    expect(screen.queryByText('Interested in partnering on 500 acres.')).not.toBeInTheDocument();
  });

  it('preserves filter controls and allows clearing filter when filter returns 0 results', () => {
    render(
      <InquiriesList
        inquiries={mockInquiries}
        organizationId="org-grorizq"
        onStatusChange={vi.fn()}
      />
    );

    const filterDropdown = screen.getByRole('combobox', { name: 'Filter by status' });
    // None of org-grorizq inquiries have status 'archived'
    fireEvent.click(filterDropdown);
    const archivedOption = screen.getByRole('option', { name: 'Archived' });
    fireEvent.click(archivedOption);

    // Filter controls are still preserved
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveTextContent('Archived');
    expect(screen.getByText('Showing 0 inquiries')).toBeInTheDocument();
    expect(screen.getByText('No matching inquiries')).toBeInTheDocument();

    // Clear filter restores the list
    const clearButton = screen.getByRole('button', { name: /Clear filter/i });
    fireEvent.click(clearButton);

    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveTextContent('All Statuses');
    expect(screen.getByText('Ahmed Khan')).toBeInTheDocument();
    expect(screen.getByText('Bilal Tariq')).toBeInTheDocument();
  });
});
