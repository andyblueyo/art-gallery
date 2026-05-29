"use client";

import Image from "next/image";
import { useState } from "react";
import { getInitials } from "@/lib/initials";
import type { Profile } from "@/lib/types";
import { ProfileEditor } from "./ProfileEditor";

interface ProfileCardProps {
  profile: Profile;
  onProfileUpdate: (profile: Profile) => void;
}

export function ProfileCard({ profile, onProfileUpdate }: ProfileCardProps) {
  const [editing, setEditing] = useState(false);
  const displayName = profile.display_name || profile.handle;
  const initials = getInitials(displayName);

  return (
    <section className="rounded-xl border border-[#d8ceb8] bg-white/40 p-5 sm:p-6">
      <div className="flex gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-[#c8a040] bg-[#ede7da]">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-serif text-sm text-brown">
              {initials}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl text-brown">{displayName}</h2>
          <p className="text-sm text-[#c8a040]/90">
            {profile.handle}.galleryclub.online
          </p>
          {profile.bio && (
            <p className="mt-2 text-sm leading-relaxed text-brown-muted line-clamp-2">
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 rounded-lg border border-[#d8ceb8] px-4 py-2 text-sm text-brown hover:border-[#c8a040]/50 transition-colors"
        >
          edit profile
        </button>
      ) : (
        <ProfileEditor
          profile={profile}
          onSaved={(updated) => {
            onProfileUpdate(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </section>
  );
}
