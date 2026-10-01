# Cloudflare R2 Public Assets & Chapter Roster Omni-Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a unified, zero-egress Cloudflare R2 asset storage pipeline for public media (volunteer avatars, organization logos, and chapter logos) and implement debounced omni-search autocomplete (by Name, Email, or Volunteer ID) in the ZahraOS Chapter Leadership drawer.

**Architecture:** A shared Supabase Edge Function `upload-public-asset` in `youth-republic` generates direct presigned S3 PUT URLs to Cloudflare R2 with content-type validation and canonical CDN URLs. Volunteers in Youth Republic can upload profile pictures directly to R2 and persist the URL in `volunteers.profile_picture_url`. ZahraOS Organization Profile and Edit Chapter Drawer migrate their logo upload pipelines from Supabase Storage (`org-logos`) to R2. Finally, `lookup-youth-republic-member` is enhanced with omni-search querying (`full_name`, `email`, `volunteer_code` with `status = 'active'`), powering a 300ms debounced accessible autocomplete dropdown with avatar preview in `EditChapterDrawer`.

**Tech Stack:** Next.js 16 (React 19), Supabase Edge Functions (Deno, `aws4fetch`), Cloudflare R2 (S3-compatible API), Tailwind CSS, Vitest & Testing Library.

**Spec:** [In-chat validated design: Unified R2 Storage & Omni-Search Autocomplete]

## Global Constraints

- **Protected Branches:** STRICT PROHIBITION. NEVER push directly to `main`, `master`, or production branches. Work on `feat/volunteer-id-search-and-lookup` in `youth-republic` and `feat/access-controls-and-role-permissions` in `zahraos`.
- **Custom Select Dropdowns:** In ZahraOS UI, always use the custom `Select` component (`@/components/ui/Select`) instead of native HTML `<select>` tags.
- **Fail-Safe & Debounced Requests:** Client searches must be debounced by 300ms with a minimum query length of 2 characters and clean error handling.
- **Zero Orphaned Headers & Unforced Rules:** Pure capability and role checks, no arbitrary string checks or counts.
- **Strict Active Filter:** Only active, verified volunteers can be discovered via autocomplete or assigned to chapter leadership rosters.

---

### Task 1: R2 Public Asset Upload Edge Function (`upload-public-asset`)

**Files:**
- Create: `youth-republic/backend/supabase/functions/upload-public-asset/handler.ts`
- Create: `youth-republic/backend/supabase/functions/upload-public-asset/index.ts`
- Create: `youth-republic/backend/supabase/functions/upload-public-asset/handler.test.ts`
- Test: `youth-republic/backend/supabase/functions/upload-public-asset/handler.test.ts`

**Interfaces:**
- Consumes: `youth-republic/backend/supabase/functions/_shared/r2.ts` (`R2Client`, `buildR2Client`)
- Produces:
  ```ts
  export interface UploadPublicAssetInput {
    domain: "avatar" | "logo";
    contentType: "image/jpeg" | "image/png" | "image/webp" | "image/svg+xml";
    fileName?: string;
  }
  export interface UploadPublicAssetResult {
    uploadUrl: string;
    publicUrl: string;
    objectKey: string;
  }
  ```

- [ ] **Step 1: Write failing handler tests**
  Create `youth-republic/backend/supabase/functions/upload-public-asset/handler.test.ts` testing:
  1. Valid avatar request generates `avatars/${callerId}/${uuid}.${ext}` presigned PUT URL and canonical public URL.
  2. Valid logo request generates `logos/${callerId}/${uuid}.${ext}` presigned PUT URL and canonical public URL.
  3. Rejects invalid MIME types (e.g. `application/pdf`, `text/html`) with `invalid_content_type`.
  4. Rejects invalid domain with `invalid_domain`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `deno test backend/supabase/functions/upload-public-asset/handler.test.ts`
  Expected: FAIL (files do not exist yet).

- [ ] **Step 3: Implement handler and index**
  Implement `youth-republic/backend/supabase/functions/upload-public-asset/handler.ts` and `index.ts`:
  - Validate authenticated user (volunteer auth or staff token claims).
  - Map extension from `contentType` (`image/jpeg` -> `jpg`, `image/png` -> `png`, `image/webp` -> `webp`, `image/svg+xml` -> `svg`).
  - Generate key: `${domain === "avatar" ? "avatars" : "logos"}/${callerId}/${crypto.randomUUID()}.${ext}`.
  - Sign PUT request with 900s expiry via `r2Client.putSignedUrl(objectKey, 900)`.
  - Construct `publicUrl`: `${Deno.env.get("R2_PUBLIC_URL") || Deno.env.get("R2_BUCKET_URL")}/${objectKey}`.
  - Return `{ uploadUrl, publicUrl, objectKey }`.

- [ ] **Step 4: Run tests and verify they pass**
  Run: `deno test backend/supabase/functions/upload-public-asset/handler.test.ts`
  Expected: PASS.

- [ ] **Step 5: Deploy Edge Function to Supabase**
  Run: `SUPABASE_ACCESS_TOKEN=... npx supabase functions deploy upload-public-asset --project-ref kbotpktgojpvkotigrjh --no-verify-jwt`
  Expected: Deployment succeeds with code 0.

- [ ] **Step 6: Commit and push**
  ```bash
  git add backend/supabase/functions/upload-public-asset/
  git commit -m "feat(r2): add upload-public-asset edge function for avatars and logos"
  git push origin feat/volunteer-id-search-and-lookup
  ```

---

### Task 2: Volunteer Profile Picture Upload & Persistence (`youth-republic`)

**Files:**
- Modify: `youth-republic/backend/supabase/functions/update-profile-field/handler.ts:18-26`
- Modify: `youth-republic/backend/supabase/functions/update-profile-field/handler.test.ts`
- Modify: `youth-republic/frontend/app/portfolio/page.tsx:580-620`
- Create: `youth-republic/frontend/components/AvatarUpload.tsx`
- Modify: `youth-republic/frontend/lib/api.ts` (or profile update helper)
- Test: `youth-republic/frontend/app/portfolio/page.test.tsx`

**Interfaces:**
- Consumes: `upload-public-asset` edge function (Task 1)
- Produces: `volunteers.profile_picture_url` updated with public R2 URL; avatar displayed with upload control in portfolio.

- [ ] **Step 1: Allow `profile_picture_url` in `update-profile-field` handler**
  In `youth-republic/backend/supabase/functions/update-profile-field/handler.ts`:
  Add `"profile_picture_url"` to `ProfileFieldName` and `ALLOWED_FIELDS`.
  Update tests in `handler.test.ts` to assert that updating `profile_picture_url` succeeds.
  Deploy `update-profile-field` to `kbotpktgojpvkotigrjh`.

- [ ] **Step 2: Create `AvatarUpload` component**
  Create `youth-republic/frontend/components/AvatarUpload.tsx`:
  - Renders avatar image if `profilePictureUrl` exists, else renders fallback initials (`getAvatarInitials`).
  - Provides a hover / click overlay button: `<input type="file" accept="image/png,image/jpeg,image/webp" />`.
  - When a file is chosen:
    1. Validates file size ($\le 5\text{MB}$) and MIME type.
    2. Requests presigned upload URL from `upload-public-asset` (`domain: "avatar"`, `contentType`).
    3. Performs direct `fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })`.
    4. Calls `updateProfileField({ fieldName: "profile_picture_url", newValue: publicUrl })`.
    5. Triggers `onSuccess(publicUrl)`.

- [ ] **Step 3: Integrate `AvatarUpload` in `frontend/app/portfolio/page.tsx`**
  Replace static initials circle `<div className="avatar">{avatarInitials}</div>` with `<AvatarUpload profilePictureUrl={volunteer.profile_picture_url} fullName={volunteer.full_name} onAvatarChange={...} />`.

- [ ] **Step 4: Run frontend tests**
  Run: `npm test` in `youth-republic/frontend`.
  Expected: PASS.

- [ ] **Step 5: Commit and push**
  ```bash
  git add backend/supabase/functions/update-profile-field/ frontend/
  git commit -m "feat(profile): allow volunteers to upload profile pictures to R2"
  git push origin feat/volunteer-id-search-and-lookup
  ```

---

### Task 3: Migrate Org & Chapter Logo Uploads to R2 (`zahraos`)

**Files:**
- Modify: `zahraos/lib/platformFunctions.ts:240-290`
- Modify: `zahraos/app/organization/page.tsx:75-105`
- Modify: `zahraos/components/team/EditChapterDrawer.tsx:140-170`
- Modify: `zahraos/components/team/EditChapterDrawer.test.tsx`
- Modify: `zahraos/app/organization/page.test.tsx`

**Interfaces:**
- Consumes: `upload-public-asset` edge function in Youth Republic
- Produces:
  ```ts
  export function requestPublicAssetUpload(
    payload: { domain: "avatar" | "logo"; contentType: string; fileName?: string },
    accessToken: string,
  ): Promise<{ uploadUrl: string; publicUrl: string; objectKey: string }>;
  ```

- [ ] **Step 1: Add `requestPublicAssetUpload` helper to `zahraos/lib/platformFunctions.ts`**
  Implement `requestPublicAssetUpload` pointing to `${process.env.NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL}/upload-public-asset`.
  Add unit tests in `lib/platformFunctions.test.ts`.

- [ ] **Step 2: Update Organization Profile logo upload in `app/organization/page.tsx`**
  Replace Supabase Storage `supabase.storage.from("org-logos").upload(...)` with:
  1. `const { uploadUrl, publicUrl } = await requestPublicAssetUpload({ domain: "logo", contentType: file.type }, staffToken)`.
  2. Direct `fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })`.
  3. Save `publicUrl` to organization metadata.

- [ ] **Step 3: Update Chapter logo upload in `components/team/EditChapterDrawer.tsx`**
  Replace Supabase Storage `supabase.storage.from("org-logos")` in `handleLogoUpload` with the R2 direct upload pipeline, saving `publicUrl` to `setLogoUrl(publicUrl)`.

- [ ] **Step 4: Update mocks & tests**
  Update `components/team/EditChapterDrawer.test.tsx` and `app/organization/page.test.tsx` to verify R2 upload helper invocation instead of `supabase.storage`.
  Run: `npx vitest run components/team/EditChapterDrawer.test.tsx app/organization/page.test.tsx`.
  Expected: PASS.

- [ ] **Step 5: Commit and push**
  ```bash
  git add lib/platformFunctions.ts app/organization/ components/team/
  git commit -m "feat(storage): migrate organization and chapter logo uploads to Cloudflare R2"
  git push origin feat/access-controls-and-role-permissions
  ```

---

### Task 4: Omni-Search Autocomplete in Chapter Leadership Drawer (`zahraos`)

**Files:**
- Modify: `youth-republic/backend/supabase/functions/lookup-youth-republic-member/handler.ts`
- Modify: `youth-republic/backend/supabase/functions/lookup-youth-republic-member/index.ts`
- Modify: `youth-republic/backend/supabase/functions/lookup-youth-republic-member/handler.test.ts`
- Modify: `zahraos/lib/platformFunctions.ts:245-290`
- Modify: `zahraos/components/team/EditChapterDrawer.tsx:165-240`
- Modify: `zahraos/components/team/EditChapterDrawer.test.tsx`

**Interfaces:**
- Consumes: Enhanced `lookup-youth-republic-member` supporting omni-search
- Produces:
  ```ts
  export interface SearchYouthRepublicMembersPayload {
    organizationId: string;
    query: string;
    limit?: number;
  }
  export function searchYouthRepublicMembers(
    payload: SearchYouthRepublicMembersPayload,
    accessToken: string,
  ): Promise<{ members: YouthRepublicMemberLookupResult[] }>;
  ```

- [ ] **Step 1: Enhance `lookup-youth-republic-member` with omni-search in `youth-republic`**
  Update `handler.ts`:
  - Accept `query: string`, `limit = 8`.
  - Filter: `status = 'active'` (reject unverified / pending).
  - Search expression:
    ```ts
    const q = input.query.trim();
    // Match volunteer_code, full_name, or email
    const { data } = await supabase
      .from("volunteers")
      .select("volunteer_code, full_name, email, profile_picture_url, status")
      .eq("status", "active")
      .or(`volunteer_code.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(limit);
    ```
  - Map records to `{ volunteerCode, fullName, email, avatarUrl }`.
  - Support both backwards-compatible single lookup `{ organizationId, youthRepublicId }` and list search `{ organizationId, query }`.
  - Add tests in `handler.test.ts`. Deploy function to `kbotpktgojpvkotigrjh`.

- [ ] **Step 2: Add `searchYouthRepublicMembers` to `zahraos/lib/platformFunctions.ts`**
  Add typed client wrapper calling `lookup-youth-republic-member` with `{ organizationId, query, limit }`.
  Add unit tests in `lib/platformFunctions.test.ts`.

- [ ] **Step 3: Build debounced autocomplete UI in `EditChapterDrawer.tsx`**
  In `EditChapterDrawer.tsx`:
  - Add states: `searchQuery: string`, `searchResults: YouthRepublicMemberLookupResult[]`, `isSearching: boolean`, `isDropdownOpen: boolean`.
  - Debounce search execution by 300ms using a `useEffect` with cleanup timer when `searchQuery.length >= 2`.
  - Floating dropdown list (`absolute z-50 mt-1 w-full bg-white border rounded-xl shadow-lg`):
    - Each result row:
      - Avatar: `<img src={m.avatarUrl} className="w-8 h-8 rounded-full object-cover" />` or initials fallback circle.
      - Name: `<div className="font-bold text-sm text-[var(--ink)]">{m.fullName}</div>`.
      - Badges: `<span className="font-mono text-xs bg-[var(--surface-sunken)] px-1.5 py-0.5 rounded border">{m.volunteerCode}</span>`.
      - Email: `<span className="text-xs text-[var(--ink-2)]">{m.email}</span>`.
    - Clicking an item selects them as `verifiedVolunteer`, populates input with `${m.fullName} (${m.volunteerCode})`, closes dropdown, and focuses Designation input.
  - If no results found after query: display *"No active verified members found matching '{query}'"*.

- [ ] **Step 4: Update automated tests in `EditChapterDrawer.test.tsx`**
  Add unit tests covering:
  1. Typing $\ge 2$ characters debounces and queries `searchYouthRepublicMembers`.
  2. Dropdown renders matching volunteer cards with avatars/initials and ID badges.
  3. Selecting a result from the dropdown populates the verified volunteer card and clears the dropdown.
  4. Adding the selected member to the active roster preserves their `volunteerCode`, designation, and term.
  5. Run tests: `npx vitest run components/team/EditChapterDrawer.test.tsx`.
  Expected: PASS.

- [ ] **Step 5: Run full test suite & build verification**
  Run: `npm test` across all 51 test suites.
  Run: `npm run build` to verify clean Next.js Turbopack compilation.
  Expected: 0 errors.

- [ ] **Step 6: Commit and push**
  ```bash
  git add components/team/ lib/platformFunctions.ts
  git commit -m "feat(chapter): add omni-search autocomplete for verified chapter leaders"
  git push origin feat/access-controls-and-role-permissions
  ```

---

## Self-Review Checklist

1. **Spec Coverage:**
   - Unified R2 upload function? Yes (Task 1).
   - Volunteer profile picture upload? Yes (Task 2).
   - Migrate org and chapter logos to R2? Yes (Task 3).
   - Autocomplete search by name, email, or ID in chapter drawer? Yes (Task 4).
2. **Placeholder Scan:** No "TBD", "TODO", or vague requirements. Every step defines exact files, types, and verification commands.
3. **Type Consistency:** `UploadPublicAssetResult`, `YouthRepublicMemberLookupResult`, and `ParticipantOption` definitions match identically across all tasks.
