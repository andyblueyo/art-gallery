"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/initials";
import { isValidHandle, normalizeHandle } from "@/lib/handle";
import type { Profile } from "@/lib/types";

const BIO_MAX = 160;

function normalizeInstagram(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  // Remove @ prefix if present
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  // Extract username from URLs
  const match = withoutAt.match(/(?:instagram\.com\/)?([a-zA-Z0-9_.]+)\/?$/);
  return (match ? match[1] : withoutAt).toLowerCase();
}

interface ProfileEditorProps {
  profile: Profile;
  onSaved: (profile: Profile) => void;
  onCancel: () => void;
}

export function ProfileEditor({
  profile,
  onSaved,
  onCancel,
}: ProfileEditorProps) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio);
  const [location, setLocation] = useState(profile.location);
  const [instagramUrl, setInstagramUrl] = useState(profile.instagram_url);
  const [venmoHandle, setVenmoHandle] = useState(profile.venmo_handle ?? '');
  const [cashappHandle, setCashappHandle] = useState(profile.cashapp_handle ?? '');
  const [kofiHandle, setKofiHandle] = useState(profile.kofi_handle ?? '');
  const [patreonHandle, setPatreonHandle] = useState(profile.patreon_handle ?? '');
  const [paypalHandle, setPaypalHandle] = useState(profile.paypal_handle ?? '');
  const [buymeacoffeeHandle, setBuymeacoffeeHandle] = useState(profile.buymeacoffee_handle ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handleError, setHandleError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function uploadAvatar(file: File): Promise<string | null> {
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${profile.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      console.warn("Avatar upload failed:", uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setHandleError(null);
    setSaving(true);

    const normalized = normalizeHandle(handle);
    if (!isValidHandle(normalized)) {
      setHandleError("Handle must be 3–30 URL-safe characters.");
      setSaving(false);
      return;
    }

    const supabase = createClient();

    try {
      if (normalized !== profile.handle) {
        const { data: taken } = await supabase
          .from("profiles")
          .select("id")
          .eq("handle", normalized)
          .neq("id", profile.id)
          .maybeSingle();

        if (taken) {
          setHandleError("That handle is already taken.");
          setSaving(false);
          return;
        }
      }

      let nextAvatarUrl = avatarUrl;
      const avatarFile = fileRef.current?.files?.[0];
      if (avatarFile) {
        const uploaded = await uploadAvatar(avatarFile);
        if (uploaded) nextAvatarUrl = uploaded;
      }

      const updates = {
        display_name: displayName.trim(),
        handle: normalized,
        bio: bio.slice(0, BIO_MAX),
        location: location.trim(),
        instagram_url: normalizeInstagram(instagramUrl),
        avatar_url: nextAvatarUrl,
        venmo_handle: venmoHandle ? venmoHandle.trim().replace(/^@/, '').toLowerCase() : null,
        cashapp_handle: cashappHandle ? cashappHandle.trim().replace(/^\$/, '').toLowerCase() : null,
        kofi_handle: kofiHandle ? kofiHandle.trim().toLowerCase() : null,
        patreon_handle: patreonHandle ? patreonHandle.trim().toLowerCase() : null,
        paypal_handle: paypalHandle ? paypalHandle.trim().toLowerCase() : null,
        buymeacoffee_handle: buymeacoffeeHandle ? buymeacoffeeHandle.trim().toLowerCase() : null,
      };

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profile.id)
        .select()
        .single();

      if (updateError) throw updateError;
      onSaved(data as Profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  const previewSrc = avatarPreview || avatarUrl;
  const initials = getInitials(displayName || handle);

  return (
    <form
      onSubmit={handleSave}
      className="mt-5 space-y-4 border-t border-[#d8ceb8] pt-5"
    >
      <div className="flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-[#c8a040] bg-[#ede7da]">
          {previewSrc ? (
            <Image
              src={previewSrc}
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
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="text-xs text-brown-muted file:mr-3 file:rounded file:border-0 file:bg-[#c8a040]/20 file:px-3 file:py-1.5 file:text-sm file:text-brown"
          />
          <p className="mt-1 text-xs text-brown-muted">JPG or PNG, square works best</p>
        </div>
      </div>

      <FormField label="display name" value={displayName} onChange={setDisplayName} maxLength={50}/>
      <FormField
        label="handle"
        value={handle}
        maxLength={30} 
        onChange={(v) => { setHandle(v); if (handleError) setHandleError(null); }}
        hint={handleError ? undefined : "handle.galleryclub.online"}
        hasError={!!handleError}
        errorMessage={handleError ?? undefined}
      />
      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wide text-brown-muted">
          bio
        </span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
          rows={3}
          maxLength={BIO_MAX}
          className="mt-1 w-full resize-none rounded-lg border border-[#d8ceb8] bg-white/60 px-3 py-2.5 text-brown focus:border-[#c8a040] focus:outline-none focus:ring-1 focus:ring-[#c8a040]/40"
        />
        <span className="mt-1 block text-right text-xs text-brown-muted">
          {bio.length}/{BIO_MAX}
        </span>
      </label>
      <FormField label="location" value={location} onChange={setLocation} maxLength={60}/>
      <FormField
        label="instagram"
        value={instagramUrl}
        onChange={setInstagramUrl}
        maxLength={30}
        onBlur={() => setInstagramUrl(normalizeInstagram(instagramUrl))}
        hint={instagramUrl ? `instagram.com/${normalizeInstagram(instagramUrl)}` : undefined}
        placeholder="https://instagram.com/badartrat"
      />

      <div className="space-y-3">
        <span className="text-xs font-medium uppercase tracking-wide text-brown-muted">support links</span>
        <FormField
          label="venmo"
          value={venmoHandle}
          onChange={setVenmoHandle}
          maxLength={50}
          placeholder="@yourhandle"
          hint={venmoHandle ? `venmo.com/${venmoHandle.replace(/^@/, '')}` : undefined}
        />
        <FormField
          label="cash app"
          value={cashappHandle}
          onChange={setCashappHandle}
          maxLength={50}
          placeholder="$yourcashtag"
          hint={cashappHandle ? `cash.app/$${cashappHandle.replace(/^\$/, '')}` : undefined}
        />
        <FormField
          label="ko-fi"
          value={kofiHandle}
          onChange={setKofiHandle}
          maxLength={50}
          placeholder="yourhandle"
          hint={kofiHandle ? `ko-fi.com/${kofiHandle}` : undefined}
        />
        <FormField
          label="patreon"
          value={patreonHandle}
          onChange={setPatreonHandle}
          maxLength={50}
          placeholder="yourhandle"
          hint={patreonHandle ? `patreon.com/${patreonHandle}` : undefined}
        />
        <FormField
          label="paypal"
          value={paypalHandle}
          onChange={setPaypalHandle}
          maxLength={50}
          placeholder="yourhandle"
          hint={paypalHandle ? `paypal.me/${paypalHandle}` : undefined}
        />
        <FormField
          label="buy me a coffee"
          value={buymeacoffeeHandle}
          onChange={setBuymeacoffeeHandle}
          maxLength={50}
          placeholder="yourhandle"
          hint={buymeacoffeeHandle ? `buymeacoffee.com/${buymeacoffeeHandle}` : undefined}
        />
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#c8a040] px-5 py-2 text-sm font-medium text-[#1a1208] hover:bg-[#e0c060] disabled:opacity-50"
        >
          {saving ? "saving…" : "save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#d8ceb8] px-5 py-2 text-sm text-brown-muted hover:text-brown"
        >
          cancel
        </button>
      </div>
    </form>
  );
}

function FormField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  onBlur,
  hasError,
  errorMessage,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  onBlur?: () => void;
  hasError?: boolean;
  errorMessage?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-brown-muted">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`mt-1 w-full rounded-lg border bg-white/60 px-3 py-2.5 text-brown focus:outline-none focus:ring-1 ${hasError ? "border-red-500 focus:border-red-500 focus:ring-red-500/40" : "border-[#d8ceb8] focus:border-[#c8a040] focus:ring-[#c8a040]/40"}`}
      />
      {hint && <span className="mt-1 block text-xs text-brown-muted">{hint}</span>}
      {hasError && errorMessage && (
        <span className="mt-1 block text-xs text-red-700">{errorMessage}</span>
      )}
    </label>
  );
}
