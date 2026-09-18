// Display-sized artwork URLs. Artwork originals live in the public
// `artworks` Storage bucket; the walls never need more than a few hundred
// pixels per piece, so route them through Supabase's transform endpoint,
// which resizes on the fly and serves WebP to browsers that accept it.
//
// Anything that is not a Supabase artworks object (blob: previews while
// uploading, demo picsum URLs, local /art paths, PDFs) is returned as-is.

// 32 exists only for the blur-up placeholder (a few hundred bytes).
export const ARTWORK_IMAGE_WIDTHS = [32, 240, 480, 800, 1200, 2000] as const;
export const ARTWORK_LQIP_WIDTH = 32;
export const ARTWORK_IMAGE_QUALITY = 80;

const OBJECT_PATH = "/storage/v1/object/public/artworks/";
const RENDER_PATH = "/storage/v1/render/image/public/artworks/";

export function artworkImageUrl(
  fileUrl: string,
  width: number,
  quality: number = ARTWORK_IMAGE_QUALITY
): string {
  if (!fileUrl) return fileUrl;
  const i = fileUrl.indexOf(OBJECT_PATH);
  if (i === -1) return fileUrl;
  if (/\.pdf(\?|$)/i.test(fileUrl)) return fileUrl;
  const w = ARTWORK_IMAGE_WIDTHS.find((b) => b >= width) ?? ARTWORK_IMAGE_WIDTHS[ARTWORK_IMAGE_WIDTHS.length - 1];
  const base = fileUrl.slice(0, i) + RENDER_PATH + fileUrl.slice(i + OBJECT_PATH.length);
  // Preserve any existing query string, then add ours.
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}width=${w}&quality=${quality}`;
}
