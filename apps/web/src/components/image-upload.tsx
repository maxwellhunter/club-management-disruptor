"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Trash2 } from "lucide-react";

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

      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", bucket);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
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
              <div className="text-white text-sm font-medium">
                Compressing & uploading...
              </div>
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
