import type { Profile } from "@/lib/types";
import { getYearsCreating } from "@/lib/profile-utils";

interface GalleryStatsProps {
  profile: Profile;
  pieceCount: number;
}

export function GalleryStats({ profile, pieceCount }: GalleryStatsProps) {
  const years = getYearsCreating(profile.created_at);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-6">
      <div className="flex items-center gap-8 sm:gap-12 text-sm">
        <Stat value={pieceCount} label="pieces" />
        <Stat value={profile.view_count} label="views" />
        <Stat value={years} label="yrs creating" />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <span className="font-semibold text-brown">{value}</span>{" "}
      <span className="text-brown-muted">{label}</span>
    </div>
  );
}
