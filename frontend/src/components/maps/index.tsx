"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` on import, so the maps only ever load in the browser.
function MapLoading() {
  return <div className="flex h-full w-full items-center justify-center bg-stone-100 text-sm text-stone-500">Loading map…</div>;
}

export const ProjectMap = dynamic(() => import("./ProjectMapInner"), { ssr: false, loading: MapLoading });
export const DrawMap = dynamic(() => import("./DrawMapInner"), { ssr: false, loading: MapLoading });
