import Link from "next/link";
import type { Profile } from "@/lib/types";
import type { Artwork } from "@/lib/types";
import { HumanMadeBadge } from "@/components/ui/HumanMadeBadge";
import { ShareButton } from "@/components/ui/ShareButton";
import { getInitials } from "@/lib/profile-utils";

interface ProfileHeaderProps {
  profile: Profile;
  artworks: Artwork[];
  galleryUrl: string;
}

export function ProfileHeader({
  profile,
  artworks,
  galleryUrl,
}: ProfileHeaderProps) {
  const displayName = profile.display_name || profile.handle;
  const initials = getInitials(displayName);
  const mediums = Array.from(
    new Set(artworks.map((a) => a.medium).filter(Boolean))
  );

  const bioLine = buildBioLine(mediums, profile.location, profile.bio);

  return (
    <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-8 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-6">
        <Avatar initials={initials} avatarUrl={profile.avatar_url} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-brown lowercase tracking-tight">
                {displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-sm text-brown-muted">
                <a
                  href={galleryUrl}
                  className="hover:text-brown transition-colors"
                >
                  {profile.handle}.galleryclub.online
                </a>
                <span className="text-brown/30">·</span>
                <HumanMadeBadge />
              </div>
              {bioLine && (
                <p className="mt-3 text-sm text-brown-light leading-relaxed max-w-2xl">
                  {bioLine}
                </p>
              )}
            </div>
            <ShareButton url={galleryUrl} className="shrink-0 self-start" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Avatar({
  initials,
  avatarUrl,
}: {
  initials: string;
  avatarUrl: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover shrink-0"
      />
    );
  }

  return (
    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#c4a882] flex items-center justify-center shrink-0">
      <span className="text-xl sm:text-2xl font-medium text-brown/80 tracking-wide">
        {initials}
      </span>
    </div>
  );
}

function buildBioLine(
  mediums: string[],
  location: string,
  bio: string
): string {
  const parts: string[] = [];
  if (mediums.length > 0) {
    parts.push(mediums.join(" & "));
  }
  if (location) {
    parts.push(`based in ${location.toLowerCase()}`);
  }
  if (bio) {
    parts.push(bio.charAt(0).toLowerCase() + bio.slice(1));
  }
  return parts.join(" · ");
}
