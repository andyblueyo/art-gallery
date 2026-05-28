"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Draggable from "react-draggable";
import type { DraggableData, DraggableEvent } from "react-draggable";
import { FramedArtwork } from "./FramedArtwork";
import { createClient } from "@/lib/supabase/client";
import type { Artwork } from "@/lib/types";
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
  title: string;
  medium: string;
  src: string;
  fileType: "image" | "pdf";
  frame_file: string;
  xPct: number;
  yPct: number;
  rotation: number;
  scale: number;
  zIndex: number;
}

interface Props {
  artworks: Artwork[];
  profileId: string;
  onCancel: () => void;
  onSaved: () => void;
  onReset?: () => void;
}

export function GalleryEditorCanvas({ artworks, profileId, onCancel, onSaved, onReset }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [canvasDims, setCanvasDims] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? Math.max(window.innerHeight - 56, 400) : 744,
  }));

  const [items, setItems] = useState<CanvasItem[]>(() =>
    artworks.map((art, i) => {
      const def = DEFAULT_POSITIONS[i % DEFAULT_POSITIONS.length];
      return {
        id: art.id,
        title: art.title,
        medium: art.medium,
        src: art.file_url,
        fileType: art.file_type,
        frame_file: art.frame_file || DEFAULT_FRAME_FILE,
        xPct: art.position_x ?? def.xPct,
        yPct: art.position_y ?? def.yPct,
        rotation: art.rotation ?? def.rot,
        scale: art.scale ?? 1,
        zIndex: art.z_index ?? (i + 1),
      };
    })
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [saveError, setSaveError] = useState(false);

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

  useEffect(() => {
    function updateDims() {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      setCanvasDims({ width: rect.width, height: rect.height });
    }
    updateDims();
    window.addEventListener("resize", updateDims);
    return () => window.removeEventListener("resize", updateDims);
  }, []);

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
      await Promise.all(
        items.map(item =>
          supabase
            .from("artworks")
            .update({
              position_x: item.xPct,
              position_y: item.yPct,
              rotation: item.rotation,
              scale: item.scale,
              z_index: item.zIndex,
            })
            .eq("id", item.id)
        )
      );
      await supabase
        .from("profiles")
        .update({ layout_mode: "custom" })
        .eq("id", profileId);
      onSaved();
      router.refresh();
    } catch {
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }, [items, profileId, onSaved, router]);

  const selectedItem = items.find(i => i.id === selectedId) ?? null;

  const btnBase =
    "rounded border border-[#c8a040]/30 px-2 py-1 text-xs text-[#f5e6c8]/80 hover:bg-[#c8a040]/20 transition-colors";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#ddd4b4] select-none">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between gap-2 bg-[rgba(18,12,6,0.92)] px-4 backdrop-blur-md">
        {/* Logo */}
        <span className="shrink-0 font-serif text-[#c8a040]/85">artpenny</span>

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
          </div>
        ) : (
          <span className="hidden flex-1 text-center text-xs text-[#f5e6c8]/40 sm:block">
            click an artwork to select · drag to rearrange
          </span>
        )}

        {/* Cancel / Reset / Save */}
        <div className="flex shrink-0 items-center gap-2">
          {saveError && (
            <span className="text-xs text-red-400">save failed</span>
          )}
          <button
            onClick={onCancel}
            className="rounded-lg border border-[#c8a040]/30 px-3 py-1.5 text-sm text-[#f5e6c8]/80 hover:border-[#c8a040]/60 transition-colors"
          >
            Cancel
          </button>
          {onReset && (
            <button
              onClick={onReset}
              className="rounded-lg border border-[#c8a040]/30 px-3 py-1.5 text-sm text-[#f5e6c8]/80 hover:border-[#c8a040]/60 transition-colors"
            >
              Reset Layout
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-[#c8a040] px-4 py-1.5 text-sm font-medium text-[#120c06] hover:bg-[#d4ac48] disabled:opacity-60 transition-colors"
          >
            {isSaving ? "Saving…" : "Save Layout"}
          </button>
        </div>
      </header>

      {/* Texture */}
      <div className="gallery-salon-wall__texture pointer-events-none absolute inset-0" />
      

      {/* ── Canvas ──────────────────────────────────────────────── */}
      <div
        ref={canvasRef}
        className="relative flex-1 overflow-hidden"
        style={{ minHeight: 800 }}
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
              No artworks to arrange yet.
            </p>
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
