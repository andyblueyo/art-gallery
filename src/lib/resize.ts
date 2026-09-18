// Client-side artwork encoding for upload: downscale to a display-sized
// ceiling and encode as WebP, falling back to JPEG where the browser cannot
// encode WebP (canvas.toBlob silently returns PNG or null there).
//
// Everything the walls show is served through Supabase's image transforms
// (see artwork-image.ts), so anything above ~2000px on the long side is
// storage and upload time for nothing.

export const ARTWORK_MAX_DIMENSION = 2000;
export const ARTWORK_QUALITY = 0.82;

export interface EncodedImage {
  blob: Blob;
  ext: "webp" | "jpg";
  contentType: "image/webp" | "image/jpeg";
  width: number;
  height: number;
}

/** Source rectangle in the image's natural pixels. Omit to use the whole image. */
export interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Draw `image` (or a sub-rectangle of it) onto a canvas no larger than
 * maxDimension on its long side and encode it. Alpha is preserved by WebP;
 * the JPEG fallback flattens onto white.
 */
export async function encodeArtwork(
  image: HTMLImageElement | ImageBitmap,
  rect?: SourceRect,
  opts: { maxDimension?: number; quality?: number } = {}
): Promise<EncodedImage> {
  const maxDimension = opts.maxDimension ?? ARTWORK_MAX_DIMENSION;
  const quality = opts.quality ?? ARTWORK_QUALITY;

  const naturalW = "naturalWidth" in image ? image.naturalWidth : image.width;
  const naturalH = "naturalHeight" in image ? image.naturalHeight : image.height;
  const src = rect ?? { x: 0, y: 0, width: naturalW, height: naturalH };

  const scale = Math.min(1, maxDimension / Math.max(src.width, src.height));
  const outW = Math.max(1, Math.round(src.width * scale));
  const outH = Math.max(1, Math.round(src.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, src.x, src.y, src.width, src.height, 0, 0, outW, outH);

  const webp = await toBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") {
    return { blob: webp, ext: "webp", contentType: "image/webp", width: outW, height: outH };
  }

  // No WebP encoder: flatten transparency onto white so JPEG doesn't go black.
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  const jpeg = await toBlob(canvas, "image/jpeg", quality);
  if (!jpeg) throw new Error("canvas.toBlob returned null");
  return { blob: jpeg, ext: "jpg", contentType: "image/jpeg", width: outW, height: outH };
}

/** Decode a File into an HTMLImageElement (object URL is revoked after load). */
export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to decode image")); };
    img.src = url;
  });
}

/** Convenience: downscale + encode a whole File. */
export async function encodeArtworkFile(file: File, opts?: { maxDimension?: number; quality?: number }): Promise<EncodedImage> {
  if (!file.type.startsWith("image/")) throw new Error("Not an image file");
  const img = await loadImageFile(file);
  return encodeArtwork(img, undefined, opts);
}
