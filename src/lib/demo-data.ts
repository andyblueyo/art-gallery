import type { Artwork, Profile } from "@/lib/types";

const DEMO_PROFILE: Profile = {
  id: "00000000-0000-0000-0000-000000000001",
  handle: "test-art",
  display_name: "art test",
  bio: "Watercolor and ink artist based in Portland. I paint the quiet moments — morning light through windows, cups of tea, hands holding books.",
  location: "portland, or",
  instagram_url: "https://instagram.com/test",
  avatar_url: "",
  view_count: 247,
  created_at: "2025-01-15T00:00:00Z",
  coin_balance: 0
};

const DEMO_ARTWORKS: Artwork[] = [
  {
    id: "a1",
    artist_id: DEMO_PROFILE.id,
    title: "Morning Tea",
    medium: "watercolor",
    description: "",
    file_url:
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&q=80",
    file_type: "image",

    created_at: "2025-02-01T00:00:00Z",
  },
  {
    id: "a2",
    artist_id: DEMO_PROFILE.id,
    title: "Window Light",
    medium: "ink",
    description: "",
    file_url:
      "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800&q=80",
    file_type: "image",
    created_at: "2025-02-05T00:00:00Z",
  },
  {
    id: "a3",
    artist_id: DEMO_PROFILE.id,
    title: "Still Life with Books",
    medium: "oil pastel",
    description: "",
    file_url:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80",
    file_type: "image",
    created_at: "2025-02-10T00:00:00Z",
  },
  {
    id: "a4",
    artist_id: DEMO_PROFILE.id,
    title: "Garden Sketch",
    medium: "graphite",
    description: "",
    file_url:
      "https://images.unsplash.com/photo-1460661414737-f7ba6a9f4b5c?w=600&h=800&q=80",
    file_type: "image",
    created_at: "2025-02-15T00:00:00Z",
  },
  {
    id: "a5",
    artist_id: DEMO_PROFILE.id,
    title: "Coastal Study",
    medium: "watercolor",
    description: "",
    file_url:
      "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=900&h=600&q=80",
    file_type: "image",
    created_at: "2025-02-20T00:00:00Z",
  },
  {
    id: "a6",
    artist_id: DEMO_PROFILE.id,
    title: "Hands Reading",
    medium: "ink wash",
    description: "",
    file_url:
      "https://images.unsplash.com/photo-1515405295570-0371f04e5aa9?w=700&h=700&q=80",
    file_type: "image",
    created_at: "2025-02-25T00:00:00Z",
  },
];

const MIKA_PROFILE: Profile = {
  id: "00000000-0000-0000-0000-000000000002",
  handle: "mika",
  display_name: "mika chen",
  bio: "watercolor & ink · brooklyn, ny · i paint quiet moments and city edges",
  location: "brooklyn, ny",
  instagram_url: "https://instagram.com/mika.makes",
  avatar_url: "",
  view_count: 412,
  created_at: "2025-01-20T00:00:00Z",
  coin_balance: 0
};

const MIKA_ARTWORKS: Artwork[] = [
  "Afternoon Light",
  "The Market",
  "Rooftop Garden",
  "Sunday Morning",
  "Harbor Mist",
  "Kitchen Table",
  "City Rain",
  "Window Seat",
  "Late Ferry",
  "Golden Hour",
].map((title, i) => ({
  id: `mika-a${i}`,
  artist_id: MIKA_PROFILE.id,
  title,
  medium: i % 2 === 0 ? "watercolor" : "ink",
  description: "",
  file_url: `https://picsum.photos/seed/mika-${i + 1}/400/500`,
  file_type: "image" as const,
  created_at: "2025-03-01T00:00:00Z",
}));

export function getDemoGallery(
  handle: string
): { profile: Profile; artworks: Artwork[] } | null {
  if (handle === "maya-lin") {
    return { profile: DEMO_PROFILE, artworks: DEMO_ARTWORKS };
  }
  if (handle === "mika") {
    return { profile: MIKA_PROFILE, artworks: MIKA_ARTWORKS };
  }
  return null;
}

export const DEMO_HANDLE = "maya-lin";
