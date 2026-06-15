"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { createClient } from "@/lib/supabase/client";
import { FRAMES, DEFAULT_FRAME_FILE, type FrameConfig } from "@/lib/frames";
import type { DashboardArtwork } from "@/lib/types";

const IMAGE_LIMIT = 25;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

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

type Step = "pick" | "frame" | "crop" | "meta";

interface UploadZoneProps {
  artistId: string;
  onUploaded: (artwork: DashboardArtwork, tempId: string) => void;
  onOptimisticAdd: (artwork: DashboardArtwork) => void;
  onOptimisticFail: (tempId: string) => void;
}

export function UploadZone({
  artistId,
  onUploaded,
  onOptimisticAdd,
  onOptimisticFail,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploadingRef = useRef(false);
  const cropImgRef = useRef<HTMLImageElement>(null);

  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<FrameConfig | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [pixelCrop, setPixelCrop] = useState<PixelCrop | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(
    null
  );
  const [title, setTitle] = useState("");
  const [medium, setMedium] = useState("");
  const [editionTotal, setEditionTotal] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [editionTouched, setEditionTouched] = useState(false);

  const isPdf = file?.type === "application/pdf";
  const isGalleryFull = false;

  const resetAll = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    setStep("pick");
    setFile(null);
    setPreviewUrl(null);
    setSelectedFrame(null);
    setCrop(undefined);
    setPixelCrop(null);
    setCroppedBlob(null);
    setCroppedPreviewUrl(null);
    setTitle("");
    setMedium("");
    setEditionTotal(0);
    setSuccess(false);
    setError(null);
    setEditionTouched(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [previewUrl, croppedPreviewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickFile = useCallback(
    (picked: File | null) => {
      if (!picked) return;
      const ok =
        picked.type.startsWith("image/") || picked.type === "application/pdf";
      if (!ok) {
        setError("Please upload an image in an acceptable format like JPG or PNG");
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
      setStep("frame");
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

  const onSelectFrame = useCallback((f: FrameConfig) => {
    setSelectedFrame(f);
    setCrop(undefined);
    setPixelCrop(null);
    setCroppedBlob(null);
  }, []);

  const onCropImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (!selectedFrame) return;
      const { width, height } = e.currentTarget;
      const initial = centerCrop(
        makeAspectCrop(
          { unit: "%", width: selectedFrame.shape === "circle" || selectedFrame.shape === "oval" ? 60 : 80 },
          selectedFrame.aspect,
          width,
          height
        ),
        width,
        height
      );
      setCrop(initial);
    },
    [selectedFrame]
  );

  const confirmCrop = useCallback(async () => {
    if (!cropImgRef.current || !pixelCrop || pixelCrop.width === 0) {
      setError("Please draw a crop region before continuing.");
      return;
    }
    try {
      const blob = await getCroppedBlob(cropImgRef.current, pixelCrop);
      if (blob.size > MAX_UPLOAD_BYTES) {
        setError("this image is too large to upload — try a smaller file or lower resolution");
        return;
      }
      if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
      setCroppedBlob(blob);
      setCroppedPreviewUrl(URL.createObjectURL(blob));
      setStep("meta");
    } catch (err) {
      console.error("[upload] crop failed:", err);
      setError(err instanceof Error ? err.message : "Could not crop image.");
    }
  }, [pixelCrop, croppedPreviewUrl]);

  async function handleUpload() {
    if (!file || !selectedFrame || !title.trim()) return;
    if (isUploadingRef.current) {
      console.warn(
        "[upload] handleUpload re-entry blocked — already uploading"
      );
      return;
    }
    isUploadingRef.current = true;
    setUploading(true);
    setError(null);
    setSuccess(false);

    const tempId = crypto.randomUUID();
    const fileType: "image" | "pdf" = isPdf ? "pdf" : "image";

    const localPreview =
      croppedPreviewUrl ||
      previewUrl ||
      (fileType === "pdf" ? "" : URL.createObjectURL(file));

    const optimistic: DashboardArtwork = {
      id: tempId,
      artist_id: artistId,
      title: title.trim(),
      medium: medium.trim(),
      description: "",
      file_url: localPreview || `/frames/${selectedFrame.file}`,
      file_type: fileType,
      frame_file: selectedFrame.file,
      heart_count: 0,
      created_at: new Date().toISOString(),
      _uploading: true,
    };

    onOptimisticAdd(optimistic);

    try {
      const supabase = createClient();

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getUser();
      if (sessionError) {
        console.error("[upload] auth.getUser error:", sessionError);
        throw sessionError;
      }
      const sessionUserId = sessionData.user?.id;
      console.log(
        "[upload] session user id:",
        sessionUserId,
        "prop artistId:",
        artistId
      );
      if (!sessionUserId) {
        throw new Error(
          "Not signed in — no Supabase session on the browser client."
        );
      }
      if (sessionUserId !== artistId) {
        console.error(
          "[upload] artistId prop does not match session user — RLS will reject insert",
          { sessionUserId, artistId }
        );
      }
      const effectiveArtistId = sessionUserId;

      const artworkId = crypto.randomUUID();
      let uploadBody: Blob | File;
      let ext: string;

      if (fileType === "image") {
        if (!croppedBlob) {
          throw new Error("Missing cropped image data.");
        }
        uploadBody = croppedBlob;
        ext = "jpg";
      } else {
        uploadBody = file;
        ext = "pdf";
      }

      const storagePath = `${effectiveArtistId}/${artworkId}.${ext}`;
      console.log("[upload] uploading to storage:", storagePath);
      const { data: storageData, error: storageError } = await supabase.storage
        .from("artworks")
        .upload(storagePath, uploadBody, {
          contentType: fileType === "pdf" ? "application/pdf" : "image/jpeg",
          upsert: false,
        });

      if (storageError) {
        console.error("[upload] storage upload error:", storageError);
        throw storageError;
      }
      console.log("[upload] storage upload ok:", storageData);

      const { data: urlData } = supabase.storage
        .from("artworks")
        .getPublicUrl(storagePath);
      console.log("[upload] getPublicUrl result:", urlData);

      const fileUrl = urlData?.publicUrl ?? "";
      if (!fileUrl) {
        console.error("[upload] file_url is empty — refusing to insert");
        throw new Error("Could not resolve public URL for uploaded file.");
      }

      const row = {
        id: artworkId,
        artist_id: effectiveArtistId,
        title: title.trim(),
        medium: medium.trim(),
        description: "",
        file_url: fileUrl,
        file_type: fileType,
        frame_file: selectedFrame.file,
        edition_total: editionTotal,
        editions_remaining: editionTotal,
      };
      console.log("[upload] inserting artwork row:", row);

      const { data, error: insertError } = await supabase
        .from("artworks")
        .insert(row)
        .select()
        .single();

      if (insertError) {
        console.error("[upload] artworks insert error:", insertError);
        throw insertError;
      }
      console.log("[upload] insert ok:", data);

      const failedEditions: number[] = [];
      for (let i = 0; i <= editionTotal; i++) {
        const { error: inventoryError } = await supabase
          .from("inventory_items")
          .insert({
            owned_by: effectiveArtistId,
            artwork_id: artworkId,
            edition_number: i,
          });
        if (inventoryError) {
          console.error(`[upload] inventory_items insert error (edition ${i}):`, inventoryError);
          failedEditions.push(i);
        }
      }
      if (failedEditions.length > 0) {
        setError(
          "your artwork was uploaded, but something went wrong setting up its listing. " +
          "the piece is in your gallery — please contact support if you want to list it for sale."
        );
      }

      onUploaded({ ...(data as DashboardArtwork), heart_count: 0 }, tempId);
      setSuccess(true);
      resetAll();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("[upload] failed:", err);
      onOptimisticFail(tempId);
      setError(formatUploadError(err));
    } finally {
      setUploading(false);
      isUploadingRef.current = false;
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-xl text-brown">upload new artwork</h2>

      <StepIndicator step={step} isPdf={isPdf} />

      {step === "pick" && (
        isGalleryFull ? (
          <div className="rounded-xl border-2 border-dashed border-[#d8ceb8] bg-[#faf7f0]/40 px-6 py-12 text-center">
            <p className="text-brown-muted">
              your gallery is full ({IMAGE_LIMIT}/{IMAGE_LIMIT}) — remove a piece to add a new one
            </p>
          </div>
        ) : (
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
            <p className="mt-2 text-xs text-brown-muted">JPG, PNG</p>
          </div>
        )
      )}

      {step === "frame" && file && (
        <div className="rounded-xl border border-[#d8ceb8] bg-white/50 p-4">
          <p className="mb-3 text-sm text-brown">
            choose a frame for{" "}
            <span className="font-medium">{file.name}</span>
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {FRAMES.map((f) => {
              const isSelected = selectedFrame?.file === f.file;
              return (
                <button
                  key={f.file}
                  type="button"
                  onClick={() => onSelectFrame(f)}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 bg-[#faf7f0] p-2 transition-colors ${
                    isSelected
                      ? "border-[#c8a040] ring-2 ring-[#c8a040]/40"
                      : "border-transparent hover:border-[#c8a040]/40"
                  }`}
                >
                  <div className="aspect-square w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/frames/${f.file}`}
                      alt={f.label}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-brown-muted">
                    {f.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={resetAll}
              className="rounded-lg border border-[#d8ceb8] px-4 py-2 text-sm text-brown hover:bg-[#faf7f0]"
            >
              cancel
            </button>
            <button
              type="button"
              disabled={!selectedFrame}
              onClick={() => setStep(isPdf ? "meta" : "crop")}
              className="rounded-lg bg-[#c8a040] px-6 py-2 text-sm font-medium text-[#1a1208] hover:bg-[#e0c060] disabled:cursor-not-allowed disabled:opacity-50"
            >
              next
            </button>
          </div>
        </div>
      )}

      {step === "crop" && previewUrl && selectedFrame && (
        <div className="rounded-xl border border-[#d8ceb8] bg-white/50 p-4">
          <p className="mb-3 text-sm text-brown">
            crop your art to fit the{" "}
            <span className="font-medium">{selectedFrame.label}</span> frame.
            drag the corners; the frame is shown semi-transparent so you can
            see the result.
          </p>
          <div className="flex justify-center">
            <div
              style={{ position: "relative", display: "inline-block" }}
              className="max-w-full"
            >
              <ReactCrop
                crop={crop}
                aspect={selectedFrame.aspect}
                circularCrop={
                  selectedFrame.shape === "circle" ||
                  selectedFrame.shape === "oval"
                }
                onChange={(_pixel, percent) => setCrop(percent)}
                onComplete={(pixel) => setPixelCrop(pixel)}
                keepSelection
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={cropImgRef}
                  src={previewUrl}
                  alt="to crop"
                  onLoad={onCropImageLoad}
                  style={{ maxHeight: 480, display: "block" }}
                />
              </ReactCrop>
              {pixelCrop && pixelCrop.width > 0 && (() => {
  const p = selectedFrame.cropPadding;
  return (
    <img
      src={`/frames/${selectedFrame.file}`}
      alt=""
      aria-hidden
      style={{
        position: "absolute",
        top:  pixelCrop.y - pixelCrop.height * selectedFrame.cropPadding.top,
        left: pixelCrop.x - pixelCrop.width  * selectedFrame.cropPadding.left,
        width:  pixelCrop.width  * (1 + selectedFrame.cropPadding.left + selectedFrame.cropPadding.right),
        height: "auto",
        pointerEvents: "none",
        opacity: 0.6,
        zIndex: 5,
      }}
    />
  );
})()}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep("frame")}
              className="rounded-lg border border-[#d8ceb8] px-4 py-2 text-sm text-brown hover:bg-[#faf7f0]"
            >
              back
            </button>
            <button
              type="button"
              onClick={confirmCrop}
              disabled={!pixelCrop || pixelCrop.width === 0}
              className="rounded-lg bg-[#c8a040] px-6 py-2 text-sm font-medium text-[#1a1208] hover:bg-[#e0c060] disabled:cursor-not-allowed disabled:opacity-50"
            >
              looks good
            </button>
          </div>
        </div>
      )}

      {step === "meta" && file && selectedFrame && (
        <div className="rounded-xl border border-[#d8ceb8] bg-white/50 p-4">
          {isPdf ? (
            <div className="flex items-center gap-3 rounded-lg bg-[#ede7da] p-4">
              <PdfIcon />
              <span className="text-sm text-brown truncate">{file.name}</span>
            </div>
          ) : croppedPreviewUrl ? (
            <div className="relative mx-auto aspect-[4/5] max-h-48 w-full max-w-[160px] overflow-hidden rounded-md bg-[#ede7da]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={croppedPreviewUrl}
                alt="Cropped preview"
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
                maxLength={50}
                className="mt-1 w-full rounded-lg border border-[#d8ceb8] bg-white/60 px-3 py-2.5 text-brown focus:border-[#c8a040] focus:outline-none"
                placeholder="my really cool art"
              />
              <p className="text-right text-xs text-brown-muted">{title.length}/50</p>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-brown-muted">
                medium
              </span>
              <input
                value={medium}
                onChange={(e) => setMedium(e.target.value)}
                maxLength={50}
                list="medium-suggestions"
                className="mt-1 w-full rounded-lg border border-[#d8ceb8] bg-white/60 px-3 py-2.5 text-brown focus:border-[#c8a040] focus:outline-none"
                placeholder="pencils, markers"
              />
              <p className="text-right text-xs text-brown-muted">{medium.length}/50</p>
              <datalist id="medium-suggestions">
                {MEDIUM_SUGGESTIONS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium uppercase tracking-wide text-brown-muted">
                editions
              </span>
              <input
                type="number"
                value={editionTouched ? editionTotal : ""}
                onChange={(e) => {
                  setEditionTouched(true);
                  const val = e.target.value;
                  if (val === "") {
                    setEditionTotal(0);
                  } else {
                    setEditionTotal(Math.min(10, Math.max(0, parseInt(val) || 0)));
                  }
                }}
                min={0}
                max={10}
                className="mt-1 w-full rounded-lg border border-[#d8ceb8] bg-white/60 px-3 py-2.5 text-brown focus:border-[#c8a040] focus:outline-none"
              />
              <p className="mt-1 text-xs text-brown-muted">
                {!editionTouched
                  ? "enter 0 for a personal piece, or 1–10 to list editions for sale"
                  : editionTotal === 0
                  ? "personal piece — won't be listed for sale"
                  : `${editionTotal} edition${editionTotal === 1 ? "" : "s"} available for sale — you'll keep a personal copy`}
              </p>
          </label>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep(isPdf ? "frame" : "crop")}
              className="rounded-lg border border-[#d8ceb8] px-4 py-2 text-sm text-brown hover:bg-[#faf7f0]"
            >
              back
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isUploadingRef.current) return;
                handleUpload();
              }}
              disabled={!title.trim() || !editionTouched || uploading}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#c8a040] px-6 py-2.5 text-sm font-medium text-[#1a1208] hover:bg-[#e0c060] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading && <Spinner />}
              {uploading ? "uploading…" : "upload piece"}
            </button>
          </div>
        </div>
      )}

      {success && (
        <p className="flex items-center gap-2 text-sm text-badge-green">
          <CheckIcon />
          piece added to your gallery
        </p>
      )}
      {error && (
        <pre className="whitespace-pre-wrap break-words text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 font-mono">
          {error}
        </pre>
      )}
    </section>
  );
}

async function getCroppedBlob(
  image: HTMLImageElement,
  crop: PixelCrop
): Promise<Blob> {
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.width * scaleX);
  canvas.height = Math.round(crop.height * scaleY);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context for crop canvas.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("canvas.toBlob returned null")),
      "image/jpeg",
      0.8
    );
  });
}

function StepIndicator({ step, isPdf }: { step: Step; isPdf: boolean }) {
  const steps: { id: Step; label: string }[] = isPdf
    ? [
        { id: "pick", label: "file" },
        { id: "frame", label: "frame" },
        { id: "meta", label: "details" },
      ]
    : [
        { id: "pick", label: "file" },
        { id: "frame", label: "frame" },
        { id: "crop", label: "crop" },
        { id: "meta", label: "details" },
      ];
  const currentIdx = steps.findIndex((s) => s.id === step);
  return (
    <ol className="flex items-center gap-2 text-xs uppercase tracking-wide text-brown-muted">
      {steps.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2">
          <span
            className={
              i === currentIdx
                ? "rounded-full bg-[#c8a040] px-2 py-0.5 text-[#1a1208]"
                : i < currentIdx
                ? "rounded-full bg-[#c8a040]/30 px-2 py-0.5 text-brown"
                : ""
            }
          >
            {i + 1}. {s.label}
          </span>
          {i < steps.length - 1 && <span aria-hidden>·</span>}
        </li>
      ))}
    </ol>
  );
}

function formatUploadError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as {
      message?: string;
      error?: string;
      code?: string;
      details?: string;
      hint?: string;
      statusCode?: string | number;
    };
    const parts = [
      e.message || e.error,
      e.code ? `code: ${e.code}` : null,
      e.statusCode ? `status: ${e.statusCode}` : null,
      e.details ? `details: ${e.details}` : null,
      e.hint ? `hint: ${e.hint}` : null,
    ].filter(Boolean);
    if (parts.length) return parts.join(" | ");
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
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
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0 text-[#c8a040]"
    >
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M14 2v6h6M8 13h8M8 17h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M20 6L9 17l-5-5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

