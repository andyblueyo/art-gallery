"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/resize";
import type { DashboardArtwork } from "@/lib/types";

const MEDIUM_SUGGESTIONS = [
  "watercolor",
  "ink",
  "oil",
  "acrylic",
  "pencil",
  "charcoal",
  "collage",
  "digital",
  "oil pastel",
  "gouache",
  "other",
];

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

interface UploadZoneProps {
  artistId: string;
  nextDisplayOrder: number;
  onUploaded: (artwork: DashboardArtwork, tempId: string) => void;
  onOptimisticAdd: (artwork: DashboardArtwork) => void;
  onOptimisticFail: (tempId: string) => void;
}

export function UploadZone({
  artistId,
  nextDisplayOrder,
  onUploaded,
  onOptimisticAdd,
  onOptimisticFail,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [medium, setMedium] = useState("");
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const isPdf = file?.type === "application/pdf";
  const canSubmit = Boolean(file && title.trim() && !uploading);

  const clearForm = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setTitle("");
    setMedium("");
    setSuccess(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [previewUrl]);

  const pickFile = useCallback(
    (picked: File | null) => {
      if (!picked) return;
      const ok =
        picked.type.startsWith("image/") || picked.type === "application/pdf";
      if (!ok) {
        setError("Please upload a JPG, PNG, or PDF.");
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(picked);
      setError(null);
      setSuccess(false);
      if (picked.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(picked));
      } else {
        setPreviewUrl(null);
      }
    },
    [previewUrl]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      pickFile(e.dataTransfer.files[0] ?? null);
    },
    [pickFile]
  );

  async function handleUpload() {
    if (!file || !title.trim()) return;
    setUploading(true);
    setError(null);
    setSuccess(false);

    const tempId = crypto.randomUUID();
    const fileType = isPdf ? "pdf" : "image";
    const localPreview =
      previewUrl || (fileType === "pdf" ? "" : URL.createObjectURL(file));

    const optimistic: DashboardArtwork = {
      id: tempId,
      artist_id: artistId,
      title: title.trim(),
      medium: medium.trim(),
      description: "",
      file_url: localPreview || "/frames/frame1.png",
      file_type: fileType,
      display_order: nextDisplayOrder,
      heart_count: 0,
      created_at: new Date().toISOString(),
      _uploading: true,
    };

    onOptimisticAdd(optimistic);

    try {
      const supabase = createClient();
      const artworkId = crypto.randomUUID();
      let uploadBody: Blob | File = file;
      let ext = file.name.split(".").pop()?.toLowerCase() || "jpg";

      if (fileType === "image") {
        uploadBody = await resizeImage(file);
        ext = "jpg";
      } else {
        ext = "pdf";
      }

      const storagePath = `${artistId}/${artworkId}.${ext}`;
      const { error: storageError } = await supabase.storage
        .from("artworks")
        .upload(storagePath, uploadBody, {
          contentType: fileType === "pdf" ? "application/pdf" : "image/jpeg",
          upsert: false,
        });

      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from("artworks")
        .getPublicUrl(storagePath);

      const row = {
        id: artworkId,
        artist_id: artistId,
        title: title.trim(),
        medium: medium.trim(),
        description: "",
        file_url: urlData.publicUrl,
        file_type: fileType,
        display_order: nextDisplayOrder,
      };

      const { data, error: insertError } = await supabase
        .from("artworks")
        .insert(row)
        .select()
        .single();

      if (insertError) throw insertError;

      onUploaded({ ...(data as DashboardArtwork), heart_count: 0 }, tempId);
      setSuccess(true);
      clearForm();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      onOptimisticFail(tempId);
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-xl text-brown">upload new artwork</h2>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragOver
            ? "border-[#c8a040] bg-[#faf7f0]"
            : "border-[#c8a040] bg-[#faf7f0]/80 hover:bg-[#faf7f0]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-brown">
          drop your artwork here or{" "}
          <span className="text-[#c8a040] underline underline-offset-2">
            click to browse
          </span>
        </p>
        <p className="mt-2 text-xs text-brown-muted">JPG, PNG, or PDF</p>
      </div>

      {file && (
        <div className="rounded-xl border border-[#d8ceb8] bg-white/50 p-4">
          {isPdf ? (
            <div className="flex items-center gap-3 rounded-lg bg-[#ede7da] p-4">
              <PdfIcon />
              <span className="text-sm text-brown truncate">{file.name}</span>
            </div>
          ) : previewUrl ? (
            <div className="relative mx-auto aspect-[4/5] max-h-48 w-full max-w-[160px] overflow-hidden rounded-md bg-[#ede7da]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-brown-muted">
                title <span className="text-red-600">*</span>
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#d8ceb8] bg-white/60 px-3 py-2.5 text-brown focus:border-[#c8a040] focus:outline-none"
                placeholder="Afternoon Light"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-brown-muted">
                medium
              </span>
              <input
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                list="medium-suggestions"
                className="mt-1 w-full rounded-lg border border-[#d8ceb8] bg-white/60 px-3 py-2.5 text-brown focus:border-[#c8a040] focus:outline-none"
                placeholder="watercolor"
              />
              <datalist id="medium-suggestions">
                {MEDIUM_SUGGESTIONS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={!canSubmit}
            className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-[#c8a040] px-6 py-2.5 text-sm font-medium text-[#1a1208] hover:bg-[#e0c060] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading && <Spinner />}
            {uploading ? "uploading…" : "upload piece"}
          </button>
        </div>
      )}

      {success && (
        <p className="flex items-center gap-2 text-sm text-badge-green">
          <CheckIcon />
          piece added to your gallery
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </section>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[#c8a040]">
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
