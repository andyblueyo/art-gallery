export interface Profile {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  location: string;
  instagram_url: string;
  avatar_url: string;
  view_count: number;
  created_at: string;
}

export interface Artwork {
  id: string;
  artist_id: string;
  title: string;
  medium: string;
  description: string;
  file_url: string;
  file_type: "image" | "pdf";
  display_order: number;
  heart_count?: number;
  created_at: string;
}

/** Artwork row with optional optimistic upload state */
export interface DashboardArtwork extends Artwork {
  _uploading?: boolean;
  _uploadError?: string;
}

export type FrameShape = "portrait" | "landscape" | "square";

export type GalleryView = "wall" | "grid" | "about";
