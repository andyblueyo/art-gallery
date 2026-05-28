const HEARTS_KEY = "galleryclub_hearts";

export function getHeartedArtworkIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(HEARTS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function isArtworkHearted(artworkId: string): boolean {
  return getHeartedArtworkIds().has(artworkId);
}

export function toggleArtworkHeart(artworkId: string): boolean {
  const hearts = getHeartedArtworkIds();
  if (hearts.has(artworkId)) {
    hearts.delete(artworkId);
  } else {
    hearts.add(artworkId);
  }
  localStorage.setItem(HEARTS_KEY, JSON.stringify(Array.from(hearts)));
  return hearts.has(artworkId);
}
