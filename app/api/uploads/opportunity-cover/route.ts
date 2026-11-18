import { NextRequest, NextResponse } from "next/server";

const MAX_BYTES = 512 * 1024;

function isR2UploadUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      url.hostname === "r2.cloudflarestorage.com" ||
      url.hostname.endsWith(".r2.cloudflarestorage.com")
    );
  } catch {
    return false;
  }
}

/**
 * Browser PUTs to R2 are blocked when the bucket CORS list does not include
 * the admin origin. This route asks the Youth Republic function for a signed
 * URL, then uploads the cropped WebP from the server.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "missing_authorization" }, { status: 401 });
  }
  if (request.headers.get("Content-Type") !== "image/webp") {
    return NextResponse.json({ error: "invalid_content_type" }, { status: 400 });
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "invalid_file_size" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_YOUTH_REPUBLIC_FUNCTIONS_URL || process.env.NEXT_PUBLIC_FUNCTIONS_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const presign = await fetch(`${baseUrl}/upload-public-asset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ domain: "opportunity_cover", contentType: "image/webp" }),
  });
  const signed = await presign.json().catch(() => ({}));
  if (!presign.ok || typeof signed.uploadUrl !== "string" || typeof signed.publicUrl !== "string") {
    return NextResponse.json({ error: signed.error || "upload_url_failed" }, { status: presign.status || 502 });
  }
  if (!isR2UploadUrl(signed.uploadUrl)) {
    return NextResponse.json({ error: "upload_url_rejected" }, { status: 502 });
  }

  const put = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/webp" },
    body: bytes,
  });
  if (!put.ok) {
    return NextResponse.json({ error: "Upload to storage failed." }, { status: 502 });
  }

  return NextResponse.json({ publicUrl: signed.publicUrl });
}
