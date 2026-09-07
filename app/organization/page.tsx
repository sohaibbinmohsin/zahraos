"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/browserClient";
import { useSelectedOrg, useShellAccessToken, useIsOrgAdminOrAbove, useShellLoading } from "@/components/shell/AppShell";
import { useToast } from "@/components/shell/ToastContext";
import { updateOrganization, listChapters, type ChapterRow } from "@/lib/platformFunctions";
import { ChaptersPanel } from "@/components/team/ChaptersPanel";
import { isDisplayableLogo } from "@/lib/orgLogo";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { FormSkeleton } from "@/components/ui/skeletons";

interface Profile {
  name: string;
  about: string;
  brandColor: string;
  logoUrl: string;
}

const MAX_LOGO_BYTES = 512 * 1024;

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
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    if (!organizationId) return;
    const supabase = getBrowserSupabaseClient();
    const { data: org } = await supabase.from("organizations")
      .select("name, about, brand_color, logo_url").eq("id", organizationId).single();
    setProfile({
      name: (org?.name as string) ?? "",
      about: (org?.about as string) ?? "",
      brandColor: (org?.brand_color as string) ?? "",
      logoUrl: (org?.logo_url as string) ?? "",
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

  async function pickLogo(file: File | undefined) {
    if (!file || !profile || !organizationId) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      showToast("Logo must be 512 KB or smaller.");
      return;
    }
    setLogoUploading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const ext = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `${organizationId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("org-logos").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("org-logos").getPublicUrl(path);
      setProfile({ ...profile, logoUrl: pub.publicUrl });
    } catch (err) {
      showToast(err instanceof Error ? `Logo upload failed: ${err.message}` : "Logo upload failed.");
    } finally {
      setLogoUploading(false);
    }
  }

  async function saveProfile() {
    if (!organizationId || !accessToken || !profile) return;
    setSaving(true);
    try {
      await updateOrganization({
        organizationId,
        name: profile.name.trim(),
        about: profile.about.trim() || null,
        brandColor: profile.brandColor.trim() || null,
        logoUrl: isDisplayableLogo(profile.logoUrl) ? profile.logoUrl.trim() : null,
      }, accessToken);
      showToast("Organization profile saved.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save profile.");
    } finally { setSaving(false); }
  }

  if (!organizationId) return <div className="panel p-8 text-center"><p className="text-[var(--ink-2)] font-medium">Select an organization.</p></div>;
  if (shellLoading) return <FormSkeleton />;
  if (!isOrgAdminOrAbove) return <div className="panel p-8 text-center"><p className="text-[var(--ink-2)] font-medium">You need organization admin access to view this page.</p></div>;
  if (loading || !profile) return <FormSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header" style={{ marginBottom: 0 }}>
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
        <div className="form-group">
          <label className="form-label">Logo</label>
          <div className="flex items-center gap-3 flex-wrap">
            {isDisplayableLogo(profile.logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.logoUrl}
                alt="Organization logo"
                className="rounded-md border border-[var(--line)] bg-white object-contain"
                style={{ width: 56, height: 56 }}
              />
            ) : (
              <div
                className="rounded-md border border-dashed border-[var(--line)] bg-[var(--bg-page)] flex items-center justify-center text-[10px] text-[var(--ink-3)]"
                style={{ width: 56, height: 56 }}
              >
                No logo
              </div>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ""; }}
            />
            <LoadingButton className="btn btn-secondary btn-sm" disabled={logoUploading}
              loading={logoUploading} loadingText="Uploading…"
              onClick={() => logoInputRef.current?.click()}>
              {isDisplayableLogo(profile.logoUrl) ? "Replace logo" : "Upload logo"}
            </LoadingButton>
            {isDisplayableLogo(profile.logoUrl) && !logoUploading && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setProfile({ ...profile, logoUrl: "" })}>
                Remove
              </button>
            )}
          </div>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-2)", marginTop: ".4rem" }}>
            PNG, JPG, WebP or SVG, up to 512 KB. Shown in the sidebar and on the volunteer-facing Youth Republic pages.
          </p>
        </div>
        <div className="flex justify-end" style={{ marginTop: ".25rem" }}>
          <LoadingButton className="btn btn-primary btn-sm" disabled={saving} loading={saving} loadingText="Saving…" onClick={saveProfile}>Save profile</LoadingButton>
        </div>
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
