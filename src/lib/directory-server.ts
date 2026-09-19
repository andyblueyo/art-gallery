// Server-side loader for the /explore directory. Import only from server
// components (it pulls in next/cache).
//
// Each card's cover is a miniature of the artist's wall, so this reads what
// the gallery page reads: profiles, artworks, the primary gallery's
// background and, for walls with a saved layout, get_gallery_pieces. That is
// one RPC per custom wall, so the whole result is cached for a minute rather
// than rebuilt on every view.

import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getDemoGallery } from "@/lib/demo-data";
import { GALLERY_WALL_MAX } from "@/lib/gallery-layout";
import type {
  Artwork,
  GalleryDirectoryEntry,
  GalleryPiece,
  Profile,
  WallBackground,
  WallCover,
} from "@/lib/types";

const PAGE_SIZE = 1000;
const REVALIDATE_SECONDS = 60;

type ProfileRow = Pick<Profile, "id" | "handle" | "display_name" | "avatar_url">;
type ArtworkRow = Pick<Artwork, "artist_id" | "file_url" | "file_type" | "frame_file" | "created_at">;
type GalleryRow = {
  id: string;
  user_id: string;
  background_type: string | null;
  background_color: string | null;
  background_image_url: string | null;
  background_image_mode: string | null;
};

// PostgREST caps each response at 1000 rows by default, so page until a
// short page comes back. Throws, so a failed read is never cached.
async function selectAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

// Backgrounds and layouts only decorate the covers: if they can't be read,
// cards fall back to a plain wall rather than the page failing.
async function optional<T>(label: string, rows: Promise<T[]>): Promise<T[]> {
  try {
    return await rows;
  } catch (err) {
    console.error(`[directory] ${label} read failed:`, err);
    return [];
  }
}

// Same fallbacks as the gallery page.
function toBackground(g: GalleryRow | undefined): WallBackground {
  return {
    type: g?.background_type === "image" && g.background_image_url ? "image" : "color",
    color: g?.background_color ?? "#e8ddd0",
    imageUrl: g?.background_image_url ?? null,
    imageMode: g?.background_image_mode === "tile" ? "tile" : g?.background_image_mode === "cover" ? "cover" : null,
  };
}

// Mirrors the gallery page: any saved pieces mean the custom wall; otherwise
// the auto wall of the artist's newest GALLERY_WALL_MAX pieces.
function toWall(background: WallBackground, pieces: GalleryPiece[], artworks: ArtworkRow[]): WallCover {
  if (pieces.length > 0) {
    return {
      layout: "custom",
      background,
      pieces: pieces.flatMap((piece, i) => {
        const art = piece.inventory_item?.artwork;
        if (!art) return [];
        return [{
          fileUrl: art.file_url,
          fileType: art.file_type,
          frameFile: art.frame_file ?? null,
          x: piece.position_x ?? 0,
          y: piece.position_y ?? 0,
          rotation: piece.rotation ?? 0,
          scale: piece.scale ?? 1,
          zIndex: piece.z_index ?? i + 1,
        }];
      }),
    };
  }
  return {
    layout: "auto",
    background,
    pieces: artworks.slice(0, GALLERY_WALL_MAX).map((art) => ({
      fileUrl: art.file_url,
      fileType: art.file_type,
      frameFile: art.frame_file ?? null,
    })),
  };
}

// Test accounts stay out of the directory (explore and the landing page's
// carousel); their galleries still load at their own address.
const HIDDEN_HANDLES = new Set([
  "test",
  "test2",
  "test3",
  "qatest-artist-0830",
  "qatest-buyer-0830",
]);

/**
 * Galleries with the most recently added work first, then galleries with
 * nothing up yet (newest sign-ups first).
 */
function toEntries(
  profiles: ProfileRow[],
  artworks: ArtworkRow[],
  wallFor: (profileId: string, artworks: ArtworkRow[]) => WallCover
): GalleryDirectoryEntry[] {
  // Artworks arrive newest first, so each artist's list stays newest first.
  const byArtist = new Map<string, ArtworkRow[]>();
  for (const art of artworks) {
    const list = byArtist.get(art.artist_id);
    if (list) list.push(art);
    else byArtist.set(art.artist_id, [art]);
  }

  const latest = (id: string) => byArtist.get(id)?.[0]?.created_at ?? "";

  return profiles
    .filter((profile) => !HIDDEN_HANDLES.has(profile.handle))
    .map((profile, signupOrder) => ({ profile, signupOrder }))
    .sort((a, b) =>
      latest(b.profile.id).localeCompare(latest(a.profile.id)) ||
      a.signupOrder - b.signupOrder
    )
    .map(({ profile }) => {
      const list = byArtist.get(profile.id) ?? [];
      return {
        handle: profile.handle,
        displayName: profile.display_name ?? "",
        avatarUrl: profile.avatar_url ?? "",
        pieceCount: list.length,
        wall: wallFor(profile.id, list),
      };
    });
}

async function fetchDirectory(): Promise<GalleryDirectoryEntry[]> {
  const supabase = createAnonClient();

  const [profiles, artworks, galleries, placed] = await Promise.all([
    selectAllRows<ProfileRow>((from, to) =>
      supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    selectAllRows<ArtworkRow>((from, to) =>
      supabase
        .from("artworks")
        .select("artist_id, file_url, file_type, frame_file, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    optional("galleries", selectAllRows<GalleryRow>((from, to) =>
      supabase
        .from("galleries")
        .select("id, user_id, background_type, background_color, background_image_url, background_image_mode")
        .eq("is_primary", true)
        .order("id")
        .range(from, to)
    )),
    optional("gallery_pieces", selectAllRows<{ gallery_id: string }>((from, to) =>
      supabase.from("gallery_pieces").select("gallery_id").order("id").range(from, to)
    )),
  ]);

  const galleryByUser = new Map(galleries.map((g) => [g.user_id, g]));
  const hasLayout = new Set(placed.map((p) => p.gallery_id));

  // inventory_items is readable only by its owner (or when listed for sale),
  // so pieces can't be joined in one select. get_gallery_pieces is how the
  // gallery page itself reads them; a failed call falls back to the auto wall.
  const piecesByGallery = new Map<string, GalleryPiece[]>();
  await Promise.all(
    galleries
      .filter((g) => hasLayout.has(g.id))
      .map(async (g) => {
        const { data, error } = await supabase.rpc("get_gallery_pieces", { p_gallery_id: g.id });
        if (error) {
          console.error("[directory] get_gallery_pieces error:", g.id, error);
          return;
        }
        piecesByGallery.set(g.id, (data ?? []) as unknown as GalleryPiece[]);
      })
  );

  return toEntries(profiles, artworks, (profileId, list) => {
    const gallery = galleryByUser.get(profileId);
    const pieces = gallery ? piecesByGallery.get(gallery.id) ?? [] : [];
    return toWall(toBackground(gallery), pieces, list);
  });
}

const getCachedDirectory = unstable_cache(fetchDirectory, ["gallery-directory"], {
  revalidate: REVALIDATE_SECONDS,
});

export async function getGalleryDirectory(): Promise<GalleryDirectoryEntry[]> {
  if (!isSupabaseConfigured()) {
    const demos = ["maya-lin", "mika"].flatMap((h) => getDemoGallery(h) ?? []);
    return toEntries(
      demos.map((d) => d.profile),
      demos.flatMap((d) => d.artworks),
      (_, list) => toWall(toBackground(undefined), [], list)
    );
  }

  try {
    return await getCachedDirectory();
  } catch (err) {
    console.error("[directory] read failed:", err);
    return [];
  }
}
