import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchOrgInquiries } from './inquiryService';
import { getBrowserSupabaseClient } from '@/lib/supabase/browserClient';

vi.mock('@/lib/supabase/browserClient', () => ({
  getBrowserSupabaseClient: vi.fn(),
}));

function clientWithSession() {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'session-token' } } }),
    },
    from: vi.fn(),
  };
}

describe('fetchOrgInquiries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads inquiries through the service-role API so custom roles are not blocked by RLS', async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(clientWithSession() as never);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        inquiries: [{ id: 'inq-1', name: 'Sohaib Bin Mohsin', status: 'new' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const rows = await fetchOrgInquiries('org-1');

    expect(rows).toEqual([{ id: 'inq-1', name: 'Sohaib Bin Mohsin', status: 'new' }]);
    expect(fetchMock).toHaveBeenCalledWith('/api/platform/list-partner-inquiries', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer session-token' }),
    }));
  });

  it('does not hide a forbidden response behind an empty direct query', async () => {
    vi.mocked(getBrowserSupabaseClient).mockReturnValue(clientWithSession() as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'forbidden' }),
    }));

    await expect(fetchOrgInquiries('org-1')).rejects.toThrow('forbidden');
  });
});
