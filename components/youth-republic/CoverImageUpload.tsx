"use client";

import { useRef, useState, useCallback } from "react";
import { requestPublicAssetUpload } from "@/lib/platformFunctions";
import { updateOpportunity } from "@/lib/youthRepublicFunctions";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_INPUT_BYTES = 10 * 1024 * 1024;   // 10 MB — picker limit
const MAX_OUTPUT_BYTES = 512 * 1024;          // 512 KB — enforced after canvas crop
const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = 720;
const CROP_ASPECT = OUTPUT_WIDTH / OUTPUT_HEIGHT; // 16/9

export interface CoverImageUploadProps {
  opportunityId: string | undefined;
  organizationId: string;
  staffToken: string;
  currentCoverUrl: string | null;
  onUploaded: (publicUrl: string) => void;
  onRemoved: () => void;
}

interface CropState {
  src: string;
  zoom: number;
  x: number;  // pan offset from centre, in CSS pixels
  y: number;
}

export function CoverImageUpload({
  opportunityId,
  organizationId,
  staffToken,
  currentCoverUrl,
  onUploaded,
  onRemoved,
}: CoverImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropState, setCropState] = useState<CropState | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentCoverUrl);

  // ---- file selection ----
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("Please select a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("File is too large. Maximum size is 10 MB.");
      return;
    }
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    setCropState({ src: objectUrl, zoom: 1, x: 0, y: 0 });
    // Reset the input so the same file can be re-selected after cancelling.
    e.target.value = "";
  }, []);

  // ---- crop + upload ----
  const handleCropComplete = useCallback(
    async (croppedBlob: Blob) => {
      if (!opportunityId) return;

      if (croppedBlob.size > MAX_OUTPUT_BYTES) {
        setError("Image could not be compressed enough — try a simpler photo.");
        setCropState(null);
        return;
      }

      setIsUploading(true);
      setError(null);
      try {
        const { uploadUrl, publicUrl } = await requestPublicAssetUpload(
          { domain: "opportunity_cover", contentType: "image/webp" },
          staffToken,
        );
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/webp" },
          body: croppedBlob,
        });
        if (!putRes.ok) throw new Error("Upload to storage failed.");
        await updateOpportunity(
          { opportunityId, organizationId, coverImageUrl: publicUrl },
          staffToken,
        );
        setPreviewUrl(publicUrl);
        setCropState(null);
        onUploaded(publicUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setIsUploading(false);
      }
    },
    [opportunityId, organizationId, staffToken, onUploaded],
  );

  // ---- remove ----
  const handleRemove = useCallback(async () => {
    if (!opportunityId) return;
    setIsRemoving(true);
    setError(null);
    try {
      await updateOpportunity(
        { opportunityId, organizationId, coverImageUrl: null },
        staffToken,
      );
      setPreviewUrl(null);
      onRemoved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove image.");
    } finally {
      setIsRemoving(false);
    }
  }, [opportunityId, organizationId, staffToken, onRemoved]);

  const isDisabled = !opportunityId;

  return (
    <div className="cover-image-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        disabled={isDisabled}
        onChange={handleFileChange}
        data-testid="cover-file-input"
      />

      {/* 16:9 frame */}
      <div
        className="cover-image-upload__frame"
        style={{
          aspectRatio: "16 / 9",
          position: "relative",
          borderRadius: "var(--radius-card, 12px)",
          overflow: "hidden",
          background: "var(--bg-2, #F1EDE5)",
          border: "1.5px dashed var(--line, #E2DFD7)",
          cursor: isDisabled ? "not-allowed" : "pointer",
        }}
        onClick={() => !isDisabled && fileInputRef.current?.click()}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Cover preview"
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "8px", color: "var(--ink-2)", fontSize: "0.88rem" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
            <span>Upload cover (optional)</span>
            {isDisabled && <span style={{ fontSize: "0.78rem", opacity: 0.6 }}>Save the drive first</span>}
          </div>
        )}
      </div>

      {/* Controls row */}
      {previewUrl && (
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => !isDisabled && fileInputRef.current?.click()}
            disabled={isDisabled || isUploading}
          >
            Change image
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRemove}
            aria-label="Remove cover image"
            disabled={isDisabled || isRemoving}
          >
            {isRemoving ? "Removing…" : "Remove"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>
      )}

      {/* 16:9 Crop Modal */}
      {cropState && (
        <CoverCropModal
          src={cropState.src}
          isUploading={isUploading}
          onClose={() => { setCropState(null); setError(null); }}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}

// ---- Inline 16:9 crop modal ----

interface CoverCropModalProps {
  src: string;
  isUploading: boolean;
  onClose: () => void;
  onCropComplete: (blob: Blob) => void;
}

const VIEWPORT_W = 480;
const VIEWPORT_H = Math.round(VIEWPORT_W / CROP_ASPECT); // 270px

function CoverCropModal({ src, isUploading, onClose, onCropComplete }: CoverCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight });
  };

  // Compute base rendered dimensions to fill the 16:9 viewport at zoom=1
  const { baseW, baseH } = (() => {
    if (!naturalDims) return { baseW: VIEWPORT_W, baseH: VIEWPORT_H };
    const scaleW = VIEWPORT_W / naturalDims.w;
    const scaleH = VIEWPORT_H / naturalDims.h;
    const scale = Math.max(scaleW, scaleH); // cover
    return { baseW: naturalDims.w * scale, baseH: naturalDims.h * scale };
  })();

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isUploading) return;
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPos({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    });
  };
  const handleMouseUp = () => setDragging(false);

  const handleCrop = () => {
    const img = imgRef.current;
    if (!img || isUploading) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mX = OUTPUT_WIDTH / VIEWPORT_W;
    const mY = OUTPUT_HEIGHT / VIEWPORT_H;
    const dW = baseW * zoom * mX;
    const dH = baseH * zoom * mY;
    const dX = (OUTPUT_WIDTH / 2 + pos.x * mX) - dW / 2;
    const dY = (OUTPUT_HEIGHT / 2 + pos.y * mY) - dH / 2;

    ctx.drawImage(img, dX, dY, dW, dH);

    // First attempt at 82% quality
    canvas.toBlob(
      (blob1) => {
        if (!blob1) return;
        if (blob1.size <= MAX_OUTPUT_BYTES) {
          onCropComplete(blob1);
          return;
        }
        // Fallback: reduce quality to 72%
        canvas.toBlob(
          (blob2) => { onCropComplete(blob2 ?? blob1); },
          "image/webp",
          0.72,
        );
      },
      "image/webp",
      0.82,
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop cover image"
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", maxWidth: "540px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.15rem", textTransform: "uppercase", letterSpacing: "0.03em", margin: 0 }}>
              Crop Cover Image
            </h2>
            <p style={{ fontSize: "0.82rem", color: "var(--ink-2)", marginTop: "4px", marginBottom: 0 }}>
              Drag to reframe. The category tag and organisation badge will overlay the edges.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close crop modal"
            onClick={onClose}
            disabled={isUploading}
            className="border border-[var(--line,#e2dfd7)] bg-white hover:bg-[var(--bg-2)] rounded-full p-2 shadow-xs transition-colors flex-shrink-0 cursor-pointer disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 16:9 viewport */}
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            width: `${VIEWPORT_W}px`,
            height: `${VIEWPORT_H}px`,
            position: "relative",
            overflow: "hidden",
            borderRadius: "10px",
            background: "#111",
            cursor: dragging ? "grabbing" : "grab",
            userSelect: "none",
            margin: "0 auto",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={handleLoad}
            style={{
              position: "absolute",
              width: `${baseW}px`,
              height: `${baseH}px`,
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
              transformOrigin: "center",
              pointerEvents: "none",
            }}
          />
          {/* Safe-zone hint overlays */}
          <div aria-hidden="true" style={{ position: "absolute", top: "8px", left: "8px", background: "rgba(243,145,4,0.35)", borderRadius: "6px", padding: "3px 8px", fontSize: "0.72rem", color: "#fff", pointerEvents: "none" }}>
            Category tag
          </div>
          <div aria-hidden="true" style={{ position: "absolute", bottom: "8px", left: "8px", display: "flex", gap: "6px", alignItems: "center", pointerEvents: "none" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "rgba(255,255,255,0.35)", border: "1.5px solid rgba(255,255,255,0.6)" }} />
            <div style={{ background: "rgba(255,255,255,0.35)", borderRadius: "5px", padding: "2px 8px", fontSize: "0.72rem", color: "#fff" }}>Org name</div>
          </div>
        </div>

        {/* Zoom */}
        <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--ink-2)" }}>Zoom</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1 }}
            disabled={isUploading}
          />
          <span style={{ fontSize: "0.78rem", color: "var(--ink-2)", width: "36px" }}>{zoom.toFixed(1)}×</span>
        </div>

        {/* Actions — no Cancel button; cross dismisses */}
        <div style={{ display: "flex", gap: "8px", marginTop: "16px", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleCrop}
            disabled={isUploading || !naturalDims}
          >
            {isUploading ? "Uploading…" : "Crop & Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
