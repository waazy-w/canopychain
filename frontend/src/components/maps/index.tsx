"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` on import, so the maps only ever load in the browser.
function MapLoading() {
  return <div className="flex h-full w-full items-center justify-center bg-raised text-sm text-muted">Loading map…</div>;
}

export const ProjectMap = dynamic(() => import("./ProjectMapInner"), { ssr: false, loading: MapLoading });
// Leaflet-Geoman reads Leaflet from the global `L`, which the bundler never creates, and static
// imports don't guarantee it is set first. So: set window.L, then load Geoman, then the map.
export const DrawMap = dynamic(
  async () => {
    const L = (await import("leaflet")).default;
    (window as unknown as { L: typeof L }).L = L;
    await import("@geoman-io/leaflet-geoman-free");
    return import("./DrawMapInner");
  },
  { ssr: false, loading: MapLoading },
);
