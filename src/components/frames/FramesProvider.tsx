"use client";

// Hands the server-loaded frame catalog to client components. Mounted once in
// the root layout; read it with useFrames() / useFrameConfig().
//
// The context default is the committed fallback snapshot, so a component
// rendered outside the provider still resolves every frame — the same
// never-empty guarantee getFrames() gives on the server.

import { createContext, useContext, useMemo } from "react";
import {
  FALLBACK_CATALOG,
  resolveFrame,
  type FrameCatalog,
  type FrameConfig,
} from "@/lib/frames";

const FramesContext = createContext<FrameCatalog>(FALLBACK_CATALOG);

export function FramesProvider({
  catalog,
  children,
}: {
  catalog: FrameCatalog;
  children: React.ReactNode;
}) {
  return <FramesContext.Provider value={catalog}>{children}</FramesContext.Provider>;
}

export function useFrames(): FrameCatalog {
  return useContext(FramesContext);
}

// Drop-in for the old getFrameConfig(frame_file): falsy/unknown → default frame.
export function useFrameConfig(frameFile: string | null | undefined): FrameConfig {
  const catalog = useFrames();
  return useMemo(() => resolveFrame(catalog, frameFile), [catalog, frameFile]);
}
