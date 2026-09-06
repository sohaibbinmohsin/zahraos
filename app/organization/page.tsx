"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useSelectedOrg, useShellAccessToken, useIsOrgAdminOrAbove, useShellLoading } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/ToastContext";
import { updateOrganization, listChapters, type ChapterRow } from "@/lib/platformFunctions";
import { ChaptersPanel } from "@/components/team/ChaptersPanel";

interface Profile {
  name: string;
  about: string;
  brandColor: string;
  logoUrl: string;
  faviconUrl: string;
}

export default function OrganizationPage() {
  const organizationId = useSelectedOrg();
  const accessToken = useShellAccessToken();
  const isOrgAdminOrAbove = useIsOrgAdminOrAbove();
  const shellLoading = useShellLoading();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!organizationId) return;
    const supabase = getBrowserSupabaseClient();
    const { data: org } = await supabase.from("organizations")
      .select("name, about, brand_color, logo_url, favicon_url").eq("id", organizationId).single();
    setProfile({
      name: (org?.name as string) ?? "",
      about: (org?.about as string) ?? "",
      brandColor: (org?.brand_color as string) ?? "",
      logoUrl: (org?.logo_url as string) ?? "",
      faviconUrl: (org?.favicon_url as string) ?? "",
    });
    if (accessToken) {
      try {
        const res = await listChapters({ organizationId }, accessToken);
        setChapters(res.chapters);
      } catch { setChapters([]); }
    }
  }, [organizationId, accessToken]);

  const load = useCallback(async () => {
    if (!organizationId || shellLoading || !isOrgAdminOrAbove) { setLoading(false); return; }
    setLoading(true);
    try {
      await fetchAll();
    } finally {
      setLoading(false);
    }
  }, [organizationId, shellLoading, isOrgAdminOrAbove, fetchAll]);

  useEffect(() => { load(); }, [load]);

  async function saveProfile() {
    if (!organizationId || !accessToken || !profile) return;
    setSaving(true);
    try {
      await updateOrganization({
        organizationId,
        name: profile.name.trim(),
        about: profile.about.trim() || null,
        brandColor: profile.brandColor.trim() || null,
        logoUrl: profile.logoUrl.trim() || null,
        faviconUrl: profile.faviconUrl.trim() || null,
      }, accessToken);
      showToast("Organization profile saved.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save profile.");
    } finally { setSaving(false); }
  }

  if (!organizationId) return <div className="panel p-8 text-center"><p className="text-[var(--ink-2)] font-medium">Select an organization.</p></div>;
  if (shellLoading) return <p className="p-8 text-center text-[var(--ink-3)]">Loading organization…</p>;
  if (!isOrgAdminOrAbove) return <div className="panel p-8 text-center"><p className="text-[var(--ink-2)] font-medium">You need organization admin access to view this page.</p></div>;
  if (loading || !profile) return <p className="p-8 text-center text-[var(--ink-3)]">Loading organization…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Organization</h1>
          <div className="page-subtitle">Your organization&apos;s public profile and its chapters.</div>
        </div>
      </div>

      <div className="table-card" style={{ padding: "1.25rem" }}>
        <h2 className="panel-title" style={{ marginBottom: ".75rem" }}>Profile</h2>
        <div className="grid-2col">
          <div className="form-group">
            <label className="form-label" htmlFor="org-name">Organization name</label>
            <input id="org-name" className="form-input" value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="org-brand">Brand color</label>
            <input id="org-brand" className="form-input" placeholder="#1A73E8" value={profile.brandColor}
              onChange={(e) => setProfile({ ...profile, brandColor: e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="org-about">Description</label>
          <textarea id="org-about" className="form-textarea" rows={3} value={profile.about}
            onChange={(e) => setProfile({ ...profile, about: e.target.value })} />
        </div>
        <div className="grid-2col">
          <div className="form-group">
            <label className="form-label" htmlFor="org-logo">Logo URL</label>
            <input id="org-logo" className="form-input" value={profile.logoUrl}
              onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="org-favicon">Favicon URL</label>
            <input id="org-favicon" className="form-input" value={profile.faviconUrl}
              onChange={(e) => setProfile({ ...profile, faviconUrl: e.target.value })} />
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={saveProfile}>Save profile</button>
      </div>

      <ChaptersPanel
        organizationId={organizationId}
        accessToken={accessToken ?? ""}
        chapters={chapters}
        onChanged={fetchAll}
      />
    </div>
  );
}
