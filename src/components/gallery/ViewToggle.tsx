"use client";

import type { GalleryView } from "@/lib/types";

interface ViewToggleProps {
  view: GalleryView;
  onViewChange: (view: GalleryView) => void;
}

const tabs: { id: GalleryView; label: string }[] = [
  { id: "wall", label: "gallery wall" },
  { id: "grid", label: "all work" },
  { id: "about", label: "about" },
];

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <nav className="flex items-center gap-6 sm:gap-8 border-b border-brown/10">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onViewChange(tab.id)}
          className={`pb-3 text-sm transition-colors relative ${
            view === tab.id
              ? "text-brown font-semibold"
              : "text-brown-muted hover:text-brown"
          }`}
        >
          {tab.label}
          {view === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brown rounded-full" />
          )}
        </button>
      ))}
    </nav>
  );
}
