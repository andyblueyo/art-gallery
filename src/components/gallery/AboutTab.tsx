import type { Profile } from "@/lib/types";
import type { Artwork } from "@/lib/types";

interface AboutTabProps {
  profile: Profile;
  artworks: Artwork[];
}

export function AboutTab({ profile, artworks }: AboutTabProps) {
  const mediums = Array.from(
    new Set(artworks.map((a) => a.medium).filter(Boolean))
  );

  return (
    <div className="max-w-xl mx-auto py-16 px-6">
      <h2 className="font-serif text-2xl text-brown mb-6">about</h2>

      {profile.bio ? (
        <p className="text-brown-light leading-relaxed whitespace-pre-wrap mb-8">
          {profile.bio}
        </p>
      ) : (
        <p className="text-brown-muted italic mb-8">No bio yet.</p>
      )}

      {mediums.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-brown-muted uppercase tracking-wide mb-3">
            mediums
          </h3>
          <div className="flex flex-wrap gap-2">
            {mediums.map((medium) => (
              <span
                key={medium}
                className="px-3 py-1 text-sm bg-gold/10 text-gold-dark rounded-full border border-gold/20"
              >
                {medium}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.location && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-brown-muted uppercase tracking-wide mb-2">
            location
          </h3>
          <p className="text-brown-light">{profile.location}</p>
        </div>
      )}

      {profile.instagram_url && (
        <div>
          <h3 className="text-sm font-medium text-brown-muted uppercase tracking-wide mb-2">
            links
          </h3>
          <a
            href={profile.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:text-gold-light underline underline-offset-2"
          >
            Instagram
          </a>
        </div>
      )}
    </div>
  );
}
