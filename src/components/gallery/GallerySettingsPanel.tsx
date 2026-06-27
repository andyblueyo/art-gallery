"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export interface GallerySettings {
  name: string;
  slug: string;
  isPrimary: boolean;
  backgroundType: 'color' | 'image';
  backgroundColor: string;
  backgroundImageUrl: string | null;
  backgroundImageMode: 'cover' | 'tile' | null;
}

interface GallerySettingsPanelProps {
  galleryId: string;
  handle: string;
  profileId: string; 
  initialName: string;
  initialSlug: string;
  initialIsPrimary: boolean;
  initialBackgroundType: 'color' | 'image';
  initialBackgroundColor: string;
  initialBackgroundImageUrl: string | null;
  initialBackgroundImageMode: 'cover' | 'tile' | null;
  onSettingsChange: (settings: GallerySettings) => void;
  onClose: () => void;
}

const SWATCHES = [
  '#ffffff', '#f5f0e8', '#e8ddd0', '#d4c4ae', '#a89070', '#4a4035', '#1a1a1a',
  '#d9c4c4', '#b8ccc0', '#b8c4d0', '#c8a898', '#1e2d40', '#6b7040', '#9c8eaa',
];

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 25);
}

export function GallerySettingsPanel({
  galleryId,
  handle,
  profileId,
  initialName,
  initialSlug,
  initialIsPrimary,
  initialBackgroundType,
  initialBackgroundColor,
  initialBackgroundImageUrl,
  initialBackgroundImageMode,
  onSettingsChange,
  onClose,
}: GallerySettingsPanelProps) {
  const [name, setName] = useState(initialName);
  const [isPrimary, setIsPrimary] = useState(initialIsPrimary);
  const [bgTab, setBgTab] = useState<'color' | 'image'>(initialBackgroundType);
  const [bgColor, setBgColor] = useState(initialBackgroundColor);
  const [bgImageUrl] = useState<string | null>(initialBackgroundImageUrl);
  const [bgImageMode, setBgImageMode] = useState<'cover' | 'tile'>(initialBackgroundImageMode ?? 'cover');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialBackgroundImageUrl);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const slug = deriveSlug(name);
  const nameLen = name.length;

  function buildSettings(overrides: Partial<GallerySettings> = {}): GallerySettings {
    return {
      name,
      slug,
      isPrimary,
      backgroundType: bgTab,
      backgroundColor: bgColor,
      backgroundImageUrl: bgTab === 'image' ? (previewUrl ?? bgImageUrl) : null,
      backgroundImageMode: bgTab === 'image' ? bgImageMode : null,
      ...overrides,
    };
  }

  function handleNameChange(val: string) {
    if (val.length > 25) return;
    setName(val);
    onSettingsChange(buildSettings({ name: val, slug: deriveSlug(val) }));
  }

  function handlePrimaryToggle() {
    const next = !isPrimary;
    setIsPrimary(next);
    onSettingsChange(buildSettings({ isPrimary: next }));
  }

  function handleColorChange(color: string) {
    setBgColor(color);
    onSettingsChange(buildSettings({ backgroundType: 'color', backgroundColor: color, backgroundImageUrl: null, backgroundImageMode: null }));
  }

  function handleTabChange(tab: 'color' | 'image') {
    setBgTab(tab);
    onSettingsChange(buildSettings({
      backgroundType: tab,
      backgroundImageUrl: tab === 'image' ? (previewUrl ?? bgImageUrl) : null,
      backgroundImageMode: tab === 'image' ? bgImageMode : null,
    }));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be under 5MB');
      return;
    }
    setImageError(null);
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onSettingsChange(buildSettings({ backgroundType: 'image', backgroundImageUrl: url, backgroundImageMode: bgImageMode }));
  }

  function handleRemoveImage() {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onSettingsChange(buildSettings({ backgroundType: 'image', backgroundImageUrl: null }));
  }

  function handleImageModeChange(mode: 'cover' | 'tile') {
    setBgImageMode(mode);
    onSettingsChange(buildSettings({ backgroundType: 'image', backgroundImageMode: mode }));
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const supabase = createClient();

      let finalImageUrl: string | null = bgTab === 'image' ? (bgImageUrl ?? null) : null;

      if (bgTab === 'image' && selectedFile) {
        const filename = `${Date.now()}-${selectedFile.name}`;
        const path = `${profileId}/gallery-backgrounds/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from('artworks')
          .upload(path, selectedFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('artworks').getPublicUrl(path);
        finalImageUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from('galleries')
        .update({
          name,
          slug,
          //is_primary: isPrimary,
          background_type: bgTab,
          background_color: bgColor,
          background_image_url: finalImageUrl,
          background_image_mode: bgTab === 'image' ? bgImageMode : null,
        })
        .eq('id', galleryId);

      if (error) throw error;
      onClose();
    } catch (err: any) {
      setSaveError(err?.message ?? 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: 56,
    left: 0,
    width: 280,
    background: 'rgba(18,12,6,0.96)',
    border: '0.5px solid rgba(200,160,64,0.25)',
    borderRadius: 8,
    padding: '16px',
    zIndex: 200,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 72px)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    letterSpacing: '0.1em',
    color: 'rgba(200,160,64,0.6)',
    textTransform: 'uppercase',
    marginBottom: 8,
    display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(245,230,200,0.06)',
    border: '0.5px solid rgba(200,160,64,0.2)',
    borderRadius: 4,
    padding: '6px 8px',
    fontSize: 13,
    color: '#f5e6c8',
    outline: 'none',
  };

  return (
    <div style={panelStyle}>
      {/* GALLERY NAME */}
      <span style={labelStyle}>Gallery Name</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <input
          type="text"
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          maxLength={25}
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Gallery name"
        />
        <button
          onClick={handlePrimaryToggle}
          title="Set as primary gallery"
          style={{
            fontSize: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: isPrimary ? '#c8a040' : 'rgba(200,160,64,0.3)',
            padding: '4px',
            lineHeight: 1,
          }}
        >
          ★
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 10, color: nameLen >= 25 ? '#ef4444' : nameLen >= 20 ? '#f59e0b' : 'rgba(245,230,200,0.3)' }}>
          {nameLen}/25
        </span>
        <span style={{ fontSize: 10 }}>
          <span style={{ color: 'rgba(245,230,200,0.35)' }}>{handle}.galleryclub.online/</span>
          <span style={{ color: '#c8a040' }}>{slug || '…'}</span>
        </span>
      </div>

      {/* WALL BACKGROUND */}
      <span style={labelStyle}>Wall Background</span>

      {/* Tab toggle */}
      <div style={{ display: 'flex', marginBottom: 12, border: '0.5px solid rgba(200,160,64,0.2)', borderRadius: 4, overflow: 'hidden' }}>
        {(['color', 'image'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            style={{
              flex: 1,
              padding: '5px 0',
              fontSize: 11,
              background: bgTab === tab ? 'rgba(200,160,64,0.2)' : 'transparent',
              color: bgTab === tab ? '#c8a040' : 'rgba(245,230,200,0.4)',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {bgTab === 'color' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 8 }}>
            {SWATCHES.map(color => (
              <button
                key={color}
                onClick={() => handleColorChange(color)}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  background: color,
                  borderRadius: 3,
                  border: bgColor === color
                    ? '2px solid #ffffff'
                    : '1.5px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text"
              value={bgColor}
              onChange={e => handleColorChange(e.target.value)}
              style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
              placeholder="#ffffff"
            />
            <input
              type="color"
              value={bgColor.startsWith('#') && bgColor.length === 7 ? bgColor : '#e8ddd0'}
              onChange={e => handleColorChange(e.target.value)}
              style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', padding: 0, borderRadius: 4 }}
            />
          </div>
        </>
      )}

      {bgTab === 'image' && (
        <>
          {previewUrl ? (
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <img
                src={previewUrl}
                alt="Background preview"
                style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4 }}
              />
              <button
                onClick={handleRemoveImage}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  background: 'rgba(18,12,6,0.85)',
                  border: '0.5px solid rgba(200,160,64,0.3)',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  color: '#f5e6c8',
                  fontSize: 11,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '1px dashed rgba(200,160,64,0.3)',
                borderRadius: 4,
                height: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                marginBottom: 8,
                color: 'rgba(245,230,200,0.4)',
                fontSize: 12,
              }}
            >
              click to upload image
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          {imageError && (
            <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 6, marginTop: 0 }}>{imageError}</p>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {(['cover', 'tile'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => handleImageModeChange(mode)}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  fontSize: 11,
                  background: bgImageMode === mode ? 'rgba(200,160,64,0.2)' : 'transparent',
                  color: bgImageMode === mode ? '#c8a040' : 'rgba(245,230,200,0.4)',
                  border: '0.5px solid rgba(200,160,64,0.2)',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {mode === 'cover' ? 'spread' : 'tile'}
              </button>
            ))}
          </div>
        </>
      )}

      {saveError && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 8, marginBottom: 0 }}>{saveError}</p>}
      <button
        onClick={handleSave}
        disabled={isSaving}
        style={{
          marginTop: 14,
          width: '100%',
          background: '#c8a040',
          color: '#120c06',
          border: 'none',
          borderRadius: 6,
          padding: '7px 0',
          fontSize: 13,
          fontWeight: 600,
          cursor: isSaving ? 'not-allowed' : 'pointer',
          opacity: isSaving ? 0.6 : 1,
        }}
      >
        {isSaving ? 'saving…' : 'save'}
      </button>
    </div>
  );
}
