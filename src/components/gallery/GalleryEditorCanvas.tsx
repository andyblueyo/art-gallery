"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Draggable from "react-draggable";
import type { DraggableData, DraggableEvent } from "react-draggable";
import { FramedArtwork } from "./FramedArtwork";
import { GallerySettingsPanel, type GallerySettings } from "./GallerySettingsPanel";
import { createClient } from "@/lib/supabase/client";
import type { Artwork, GalleryPiece, InventoryTrayItem } from "@/lib/types";
import { DEFAULT_FRAME_FILE, getFrameConfig } from "@/lib/frames";
import { useRouter } from "next/navigation";

const GRID_SIZE = 20;
const BASE_WIDTH = 220;

const DEFAULT_POSITIONS: { xPct: number; yPct: number; rot: number }[] = [
  { xPct: 4, yPct: 8, rot: -2 },
  { xPct: 22, yPct: 5, rot: 1 },
  { xPct: 43, yPct: 6, rot: 0 },
  { xPct: 62, yPct: 4, rot: -1 },
  { xPct: 80, yPct: 7, rot: 2 },
  { xPct: 5, yPct: 50, rot: 1 },
  { xPct: 25, yPct: 47, rot: 0 },
  { xPct: 50, yPct: 49, rot: -1 },
  { xPct: 68, yPct: 46, rot: 1 },
  { xPct: 84, yPct: 50, rot: -2 },
];

interface CanvasItem {
  id: string;
  inventoryItemId: string;
  title: string;
  medium: string;
  src: string;
  fileType: "image" | "pdf";
  ownedBy: string,
  frame_file: string;
  xPct: number;
  yPct: number;
  rotation: number;
  scale: number;
  zIndex: number;
}

interface Props {
  handle: string;
  placedPieces: GalleryPiece[];
  unplacedInventory: InventoryTrayItem[];
  profileId: string;
  onCancel: () => void;
  onSaved: () => void;
  onReset?: () => void;
  gallery: {
    id: string;
    name: string | null;
    slug: string | null;
    isPrimary: boolean;
    backgroundType: 'color' | 'image';
    backgroundColor: string;
    backgroundImageUrl: string | null;
    backgroundImageMode: 'cover' | 'tile' | null;
  };
}

export function GalleryEditorCanvas({ handle, placedPieces, unplacedInventory, profileId, onCancel, onSaved, onReset, gallery }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [canvasDims] = useState({ width: 1400, height: 1200 });

  const [items, setItems] = useState<CanvasItem[]>(() =>
    placedPieces.map((piece, i) => ({
      id: piece.inventory_item.artwork_id,
      inventoryItemId: piece.inventory_item_id,
      title: piece.inventory_item.artwork.title,
      medium: piece.inventory_item.artwork.medium,
      src: piece.inventory_item.artwork.file_url,
      fileType: piece.inventory_item.artwork.file_type,
      frame_file: piece.inventory_item.artwork.frame_file || DEFAULT_FRAME_FILE,
      ownedBy: piece.inventory_item.owned_by,
      xPct: piece.position_x,      // always real — no fallback needed
      yPct: piece.position_y,
      rotation: piece.rotation,
      scale: piece.scale,
      zIndex: piece.z_index ?? i + 1,
    }))
  );

  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [liveBackground, setLiveBackground] = useState<GallerySettings>({
    name: gallery.name ?? '',
    slug: gallery.slug ?? '',
    isPrimary: gallery.isPrimary,
    backgroundType: gallery.backgroundType,
    backgroundColor: gallery.backgroundColor,
    backgroundImageUrl: gallery.backgroundImageUrl,
    backgroundImageMode: gallery.backgroundImageMode,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [trayItems, setTrayItems] = useState<InventoryTrayItem[]>(() =>
    unplacedInventory.map(item => ({ ...item }))
  );
  const [trayOpen, setTrayOpen] = useState(true);

  const nodeRefsMap = useRef(new Map<string, React.RefObject<HTMLDivElement>>());

  function getNodeRef(id: string): React.RefObject<HTMLDivElement> {
    if (!nodeRefsMap.current.has(id)) {
      nodeRefsMap.current.set(id, React.createRef<HTMLDivElement>());
    }
    return nodeRefsMap.current.get(id)!;
  }

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // useEffect(() => {
  //   function updateDims() {
  //     if (!canvasRef.current) return;
  //     const rect = canvasRef.current.getBoundingClientRect();
  //     setCanvasDims({ width: rect.width, height: rect.height });
  //   }
  //   updateDims();
  //   window.addEventListener("resize", updateDims);
  //   return () => window.removeEventListener("resize", updateDims);
  // }, []);

  // Lock body scroll while editor is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleDragStop = useCallback(
    (_e: DraggableEvent, data: DraggableData, id: string) => {
      const { width, height } = canvasDims;
      setItems(prev =>
        prev.map(item =>
          item.id === id
            ? { ...item, xPct: (data.x / width) * 100, yPct: (data.y / height) * 100 }
            : item
        )
      );
      setSelectedId(id);
    },
    [canvasDims]
  );

  const updateItem = useCallback((id: string, updates: Partial<CanvasItem>) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const bringForward = useCallback(() => {
    if (!selectedId) return;
    const item = items.find(i => i.id === selectedId);
    if (!item) return;
    const maxZ = Math.max(...items.map(i => i.zIndex));
    if (item.zIndex < maxZ) updateItem(selectedId, { zIndex: item.zIndex + 1 });
  }, [selectedId, items, updateItem]);

  const sendBack = useCallback(() => {
    if (!selectedId) return;
    const item = items.find(i => i.id === selectedId);
    if (!item) return;
    if (item.zIndex > 1) updateItem(selectedId, { zIndex: item.zIndex - 1 });
  }, [selectedId, items, updateItem]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(false);
    try {
      const supabase = createClient();

      // 1. Get the user's primary gallery
      const { data: gallery, error: galleryError } = await supabase
        .from("galleries")
        .select("id")
        .eq("user_id", profileId)
        .eq("is_primary", true)
        .single();

      if (galleryError || !gallery) {
        throw new Error("Could not find primary gallery");
      }

      // 2. Upsert canvas items into gallery_pieces
      const validUpserts = items
      .filter(item => item.ownedBy === profileId)
      .map((item) => ({
        gallery_id: gallery.id,
        inventory_item_id: item.inventoryItemId,
        position_x: item.xPct,
        position_y: item.yPct,
        rotation: item.rotation,
        scale: item.scale,
        z_index: item.zIndex,
      }));

      if (validUpserts.length > 0) {
        const { error: upsertError } = await supabase
          .from("gallery_pieces")
          .upsert(validUpserts, { onConflict: "inventory_item_id" });

        if (upsertError) throw upsertError;
      }

      // 3. Delete orphaned gallery_pieces rows
      if (items.length === 0) {
        await supabase
          .from("gallery_pieces")
          .delete()
          .eq("gallery_id", gallery.id);
      } else {
        const currentInventoryItemIds = items.map(i => i.inventoryItemId);
        await supabase
          .from("gallery_pieces")
          .delete()
          .eq("gallery_id", gallery.id)
          .not("inventory_item_id", "in", `(${currentInventoryItemIds.join(",")})`);
      }

      // 4. Mark layout as custom
      await supabase
        .from("profiles")
        .update({ layout_mode: "custom" })
        .eq("id", profileId);

      onSaved();
      router.refresh();
    } catch (err) {
      console.error("[editor] save failed:", err);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }, [items, profileId, onSaved, router]);

  const selectedItem = items.find(i => i.id === selectedId) ?? null;

  const btnBase =
    "rounded border border-[#c8a040]/30 px-2 py-1 text-xs text-[#f5e6c8]/80 hover:bg-[#c8a040]/20 transition-colors";

  const canvasBgStyle: React.CSSProperties = liveBackground.backgroundType === 'image' && liveBackground.backgroundImageUrl
    ? {
        backgroundImage: `url(${liveBackground.backgroundImageUrl})`,
        backgroundSize: liveBackground.backgroundImageMode === 'tile' ? 'auto' : 'cover',
        backgroundRepeat: liveBackground.backgroundImageMode === 'tile' ? 'repeat' : 'no-repeat',
        backgroundPosition: 'center',
      }
    : { background: liveBackground.backgroundColor };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#ddd4b4] select-none">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between gap-2 bg-[rgba(18,12,6,0.92)] px-4 backdrop-blur-md">
        {/* Logo */}
        <span className="hidden sm:block shrink-0 font-serif text-[#c8a040]/85">gallery club</span>

        {/* Per-artwork controls (shown when something is selected) */}
        {selectedItem ? (
          <div className="flex flex-1 items-center justify-center gap-2 overflow-x-auto">
            {/* Rotation */}
            <div className="flex items-center gap-1">
              <button
                className={btnBase}
                onClick={() =>
                  updateItem(selectedId!, {
                    rotation: ((selectedItem.rotation - 90) % 360 + 360) % 360,
                  })
                }
              >
                −90°
              </button>
              <input
                type="number"
                value={Math.round(selectedItem.rotation)}
                min={0}
                max={360}
                onChange={e =>
                  updateItem(selectedId!, { rotation: +e.target.value })
                }
                className="w-14 rounded border border-[#c8a040]/30 bg-transparent px-1 py-1 text-center text-xs text-[#f5e6c8] focus:outline-none"
              />
              <button
                className={btnBase}
                onClick={() =>
                  updateItem(selectedId!, {
                    rotation: (selectedItem.rotation + 90) % 360,
                  })
                }
              >
                +90°
              </button>
            </div>

            {/* Scale — desktop only */}
            {!isMobile && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#f5e6c8]/50">scale</span>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={selectedItem.scale}
                  onChange={e =>
                    updateItem(selectedId!, { scale: +e.target.value })
                  }
                  className="w-24 accent-[#c8a040]"
                />
                <span className="w-8 text-xs text-[#f5e6c8]/50">
                  {selectedItem.scale.toFixed(1)}×
                </span>
              </div>
            )}

            {/* Z-index */}
            <div className="flex items-center gap-1">
              <button className={btnBase} onClick={bringForward} title="Bring forward">
                ↑
              </button>
              <button className={btnBase} onClick={sendBack} title="Send back">
                ↓
              </button>
            </div>

            {/* Store in inventory */}
            <button
              className={`${btnBase} text-[#f5e6c8]/50`}
              title="Store in inventory"
              onClick={() => {
                if (!selectedId) return;
                const item = items.find(i => i.id === selectedId);
                if (!item) return;
                setItems(prev => prev.filter(i => i.id !== selectedId));
                setTrayItems(prev => [...prev, {
                  inventoryItemId: item.inventoryItemId,
                  artworkId: item.id,
                  artistId: "",
                  editionNumber: 0,
                  title: item.title,
                  medium: item.medium,
                  fileUrl: item.src,
                  fileType: item.fileType,
                  frameFile: item.frame_file,
                  ownedBy: item.ownedBy
                }]);
                setSelectedId(null);
              }}
            >
              → store in inventory
            </button>
          </div>
        ) : (
          <span className="hidden flex-1 text-center text-xs text-[#f5e6c8]/40 sm:block">
            click an artwork to select · drag to rearrange
          </span>
        )}

        {/* Settings trigger */}
        <button
          onClick={() => setSettingsPanelOpen(o => !o)}
          className={`${btnBase} flex shrink-0 items-center gap-1.5`}
        >
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: liveBackground.backgroundColor,
              border: '1px solid rgba(255,255,255,0.3)',
              flexShrink: 0,
            }}
          />
          <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" style={{ opacity: 0.8 }}>
            <path d="M10.12 1.88a1.5 1.5 0 0 0-2.12 0L1.5 8.38 1 11l2.62-.5 6.5-6.5a1.5 1.5 0 0 0 0-2.12z"/>
          </svg>
          <span className="hidden sm:inline">edit</span>
        </button>

        {/* Cancel / Reset / Save */}
        <div className="flex shrink-0 items-center gap-2">
          {saveError && (
            <span className="text-xs text-red-400">save failed</span>
          )}
          <button
            onClick={onCancel}
            className="rounded-lg border border-[#c8a040]/30 px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm text-[#f5e6c8]/80 hover:border-[#c8a040]/60 transition-colors"
          >
            cancel
          </button>
          {onReset && (
            <button
              onClick={onReset}
              className="rounded-lg border border-[#c8a040]/30 px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm text-[#f5e6c8]/80 hover:border-[#c8a040]/60 transition-colors"
            >
              <span className="sm:hidden">reset</span>
              <span className="hidden sm:inline">reset layout</span>
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-[#c8a040] px-2 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm font-medium text-[#120c06] hover:bg-[#d4ac48] disabled:opacity-60 transition-colors"
          >
            {isSaving ? "saving…" : <><span className="sm:hidden">save</span><span className="hidden sm:inline">save layout</span></>}
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {settingsPanelOpen && (
        <GallerySettingsPanel
          galleryId={gallery.id}
          handle={handle}
          profileId={profileId}   
          initialName={gallery.name ?? ''}
          initialSlug={gallery.slug ?? ''}
          initialIsPrimary={gallery.isPrimary}
          initialBackgroundType={gallery.backgroundType}
          initialBackgroundColor={gallery.backgroundColor}
          initialBackgroundImageUrl={gallery.backgroundImageUrl}
          initialBackgroundImageMode={gallery.backgroundImageMode}
          onSettingsChange={setLiveBackground}
          onClose={() => setSettingsPanelOpen(false)}
        />
      )}

      {/* Texture */}
      <div className="gallery-salon-wall__texture pointer-events-none absolute inset-0" />
      

      {/* ── Canvas ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div
          ref={canvasRef}
          className="relative"
          style={{ width: 1400, height: 1200, ...canvasBgStyle }}
          onClick={() => setSelectedId(null)}
        >
        {items.map(item => {
          const nodeRef = getNodeRef(item.id);
          const px = (item.xPct / 100) * canvasDims.width;
          const py = (item.yPct / 100) * canvasDims.height;
          const isSelected = item.id === selectedId;

          // Bounding box: rotate all 4 corners around top-left origin (0,0)
          const radians = (item.rotation * Math.PI) / 180;
          const cosA = Math.cos(radians);
          const sinA = Math.sin(radians);
          const frameConfig = getFrameConfig(item.frame_file);
          const sel = frameConfig.selectionScale ?? 1.0;
          const W = BASE_WIDTH, H = (BASE_WIDTH / frameConfig.aspect) * sel, s = item.scale;
          const pad = 8 + (BASE_WIDTH * (sel - 1)) / 2; 
          const cx: number[] = [0, s*W*cosA, s*(W*cosA-H*sinA), s*(-H*sinA)];
          const cy: number[] = [0, s*W*sinA, s*(W*sinA+H*cosA), s*H*cosA];
          const minX = Math.min(...cx), maxX = Math.max(...cx);
          const minY = Math.min(...cy), maxY = Math.max(...cy);
          

          return (
            <Draggable
              key={item.id}
              nodeRef={nodeRef}
              position={{ x: px, y: py }}
              grid={[GRID_SIZE, GRID_SIZE]}
              onStop={(_e, data) => handleDragStop(_e, data, item.id)}
              bounds={{
                left: 0,
                top: 0,
                right: Math.max(0, canvasDims.width - (maxX - minX) - 20),
                bottom: Math.max(0, canvasDims.height - (maxX - minX) - 20),
              }}
            >
              <div
                ref={nodeRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  zIndex: isSelected ? 1000 + item.zIndex : item.zIndex,
                  cursor: "grab",
                  touchAction: "none",
                }}
                onClick={e => {
                  e.stopPropagation();
                  setSelectedId(item.id);
                }}
              >
                {/* Selection ring — exact bounding box of rotated artwork */}
                {isSelected && (
                  <div
                    style={{
                      position: "absolute",
                      left: minX - pad,
                      top: minY - pad,
                      width: (maxX - minX) + pad * 2,
                      height: (maxY - minY) + pad * 2,
                      border: "2px dashed #c8a040",
                      borderRadius: 6,
                      pointerEvents: "none",
                      zIndex: 10,
                    }}
                  />
                )}

                <div
                  style={{
                    transform: `rotate(${item.rotation}deg) scale(${item.scale})`,
                    transformOrigin: "top left",
                    width: BASE_WIDTH,
                  }}
                >
                  <FramedArtwork
                    frame_file={item.frame_file}
                    artSrc={item.src}
                    width={BASE_WIDTH}
                    title={item.title}
                    medium={item.medium}
                    artistName=""
                    fileType={item.fileType}
                    rotation={item.rotation}
                    showTooltip={false}  
                  />
                </div>
              </div>
            </Draggable>
          );
        })}

        {items.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="font-serif text-lg text-[#f5e6c8]/50">
              Open the tray below to add pieces to your wall.
            </p>
          </div>
        )}
      </div>
      </div>

      {/* ── Inventory Tray ──────────────────────────────────────── */}
      <div
        className="relative z-10 shrink-0"
        style={{ background: "rgba(18,12,6,0.92)", borderTop: "0.5px solid rgba(200,160,64,0.2)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4" style={{ height: 36 }}>
          <span className="text-xs text-[#f5e6c8]/50">unplaced</span>
          <span className="rounded-full px-1.5 py-0.5 text-[10px] bg-[#c8a040]/20 text-[#c8a040]/90">
            {trayItems.length}
          </span>
          <button
            className="ml-auto text-[#f5e6c8]/50 hover:text-[#f5e6c8]/80 transition-colors"
            onClick={() => setTrayOpen(o => !o)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ transform: trayOpen ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s" }}
            >
              <polyline points="3,5 7,9 11,5" />
            </svg>
          </button>
        </div>

        {/* Items row */}
        {trayOpen && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3">
            {trayItems.map(item => (
              <div
                key={item.inventoryItemId}
                style={{
                  width: 84,
                  flexShrink: 0,
                  background: "rgba(245,230,200,0.06)",
                  border: "0.5px solid rgba(200,160,64,0.2)",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                {/* Thumbnail */}
                <div
                  className="relative cursor-pointer"
                  style={{ height: 64, overflow: "hidden" }}
                  onClick={() => {
                    setItems(prev => [...prev, {
                      id: item.artworkId,
                      inventoryItemId: item.inventoryItemId,
                      title: item.title,
                      medium: item.medium,
                      src: item.fileUrl,
                      fileType: item.fileType,
                      frame_file: item.frameFile ?? DEFAULT_FRAME_FILE,
                      ownedBy: item.ownedBy, 
                      xPct: 40,
                      yPct: 35,
                      rotation: 0,
                      scale: 1,
                      zIndex: items.length + 1,
                    }]);
                    setTrayItems(prev => prev.filter(t => t.inventoryItemId !== item.inventoryItemId));
                  }}
                >
                  {item.fileType === "pdf" ? (
                    <div className="flex h-full items-center justify-center bg-[rgba(245,230,200,0.04)]">
                      <span className="text-[#f5e6c8]/30 text-lg">▦</span>
                    </div>
                  ) : (
                    <img
                      src={item.fileUrl}
                      alt={item.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                  {/* + badge */}
                  <div
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#c8a040",
                      color: "#120c06",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: "bold",
                      lineHeight: 1,
                      pointerEvents: "none",
                    }}
                  >
                    +
                  </div>
                </div>
                {/* Text */}
                <div style={{ padding: "4px 6px" }}>
                  <p className="text-[9px] font-serif text-[#f5e6c8]/70 truncate">{item.title}</p>
                  <p className="text-[8px] text-[#f5e6c8]/30">
                    ed. {item.editionNumber} · {item.artistId === profileId ? "yours" : "collected"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile: scale slider when selected */}
      {isMobile && selectedItem && (
        <div className="relative z-10 shrink-0 border-t border-[#c8a040]/20 bg-[rgba(18,12,6,0.92)] p-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#f5e6c8]/60">scale</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={selectedItem.scale}
              onChange={e => updateItem(selectedId!, { scale: +e.target.value })}
              className="flex-1 accent-[#c8a040]"
            />
            <span className="w-10 text-right text-xs text-[#f5e6c8]/60">
              {selectedItem.scale.toFixed(1)}×
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
