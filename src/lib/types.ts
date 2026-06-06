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
  layout_mode?: string | null;
}

export interface Artwork {
  id: string;
  artist_id: string;
  title: string;
  medium: string;
  description: string;
  file_url: string;
  file_type: "image" | "pdf";
  frame_file?: string | null;
  heart_count?: number;
  created_at: string;
  for_sale?: boolean;
  price_coins?: number | null;
  edition_total?: number | null;
  editions_remaining?: number | null;
}

/** Artwork row with optional optimistic upload state */
export interface DashboardArtwork extends Artwork {
  _uploading?: boolean;
  _uploadError?: string;
}

export interface InventoryItem {
  id: string;
  owned_by: string;
  artwork_id: string;
  edition_number: number;
  acquired_from?: string | null;
  listed_for_sale: boolean;
  resale_price_coins?: number | null;
  acquired_at: string;
  artwork?: Artwork;
}

export interface GalleryPiece {
  id: string;
  gallery_id: string;
  inventory_item_id: string;
  position_x: number;
  position_y: number;
  rotation: number;
  scale: number;
  z_index: number;
  inventory_item?: InventoryItem & { artwork: Artwork };
}

export type FrameShape = "portrait" | "landscape" | "square";

export type GalleryView = "wall" | "grid" | "about";
