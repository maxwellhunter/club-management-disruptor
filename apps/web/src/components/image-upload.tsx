"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";

// Best-effort client-side downscale + JPEG re-encode. Uses createImageBitmap
// (supported in all evergreen browsers + Safari 15+) so we don't pull in a
// dependency. On any failure we fall through to uploading the original file.
async function downscaleImage(file: File, maxEdge: number, quality: number): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return file;
  }
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  return blob ?? file;
}

async function safeJson(res: Response): Promise<any | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = await safeJson(res);
  if (data?.error) return String(data.error);
  if (res.status === 413) return "Image is too large — please choose a smaller file";
  return `${fallback} (status ${res.status})`;
}

interface ImageUploadProps {
  value: string; // current image URL
  onChange: (url: string) => void;
  bucket?: string;
  label?: string;
  height?: string; // tailwind height class e.g. "h-40"
  aspect?: "auto" | "square" | "video"; // preview aspect ratio
  placeholder?: string;
}

export function ImageUpload({
  value,
  onChange,
  bucket = "event-images",
  label = "Cover Image",
  height = "h-40",
  aspect = "auto",
  placeholder = "Click to upload an image",
}: ImageUploadProps) {
  const [preview, setPreview] = useState(value);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // Sync preview when parent value changes (e.g. after async load)
  useEffect(() => {
    if (!uploading) setPreview(value);
  }, [value]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");

    try {
      // Show local preview immediately
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);

      // Downscale on the client before uploading. Vercel's serverless body
      // limit is ~4.5MB, and modern phone cameras easily produce 5–12MB
      // JPEGs/HEICs — those get rejected before the route handler runs,
      // returning a non-JSON response that Safari surfaces as the cryptic
      // "The string did not match the expected pattern." We cap the long
      // edge at 2000px and re-encode as JPEG at 0.85 quality, which keeps
      // us comfortably under the limit while still looking great after the
      // server's sharp() re-encode.
      const uploadBlob = await downscaleImage(file, 2000, 0.85).catch(() => file);

      const formData = new FormData();
      // Always send a .jpg filename when we re-encoded; otherwise keep original.
      const filename = uploadBlob === file ? file.name : file.name.replace(/\.[^.]+$/, "") + ".jpg";
      formData.append("file", uploadBlob, filename);
      formData.append("bucket", bucket);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await extractErrorMessage(res, "Upload failed"));
      }

      const data = await safeJson(res);
      if (!data?.url) throw new Error("Upload succeeded but no URL returned");
      setPreview(data.url);
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
      setPreview("");
      onChange("");
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setPreview("");
    onChange("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium mb-1">{label}</label>
      )}

      {error && (
        <p className="text-xs text-red-600 mb-1">{error}</p>
      )}

      {preview ? (
        <div className={`relative rounded-lg overflow-hidden border border-[var(--border)] ${aspect === "square" ? "aspect-square max-w-[240px]" : aspect === "video" ? "aspect-video" : height}`}>
          <img
            src={preview}
            alt=""
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 rounded-full bg-black/60 text-white p-1.5 hover:bg-black/80 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`${aspect === "square" ? "aspect-square max-w-[240px]" : aspect === "video" ? "aspect-video w-full" : `w-full ${height}`} rounded-lg border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)] flex flex-col items-center justify-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors`}
        >
          <Upload className="h-6 w-6" />
          <span className="text-sm">{placeholder}</span>
          <span className="text-xs">JPG, PNG, WebP (max 10MB)</span>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />
    </div>
  );
}
