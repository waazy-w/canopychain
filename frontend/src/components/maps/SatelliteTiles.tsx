"use client";

import L from "leaflet";
import { useEffect } from "react";
import { TileLayer, useMap } from "react-leaflet";

/** Web Mercator's edges. Keeping the view inside them means no grey void and no repeated worlds,
 *  so every drawn coordinate stays within [-180, 180] longitude. */
const WORLD_BOUNDS = L.latLngBounds([-85.0511, -180], [85.0511, 180]);

/** Spread onto <MapContainer>: the map can't be dragged past the edge of the world. */
export const WORLD_MAP_OPTIONS = { maxBounds: WORLD_BOUNDS, maxBoundsViscosity: 1, worldCopyJump: false } as const;

export function SatelliteTiles() {
  return (
    <>
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
        maxZoom={18}
        noWrap
        bounds={WORLD_BOUNDS}
      />
      <FillContainer />
    </>
  );
}

/** Stops zooming out once the world would be smaller than the map box, and re-checks on resize.
 *  Also follows the box's own size changes (e.g. a neighbouring card loading), which Leaflet doesn't notice. */
function FillContainer() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => {
    const update = () => {
      const { x, y } = map.getSize();
      if (!x || !y) return;
      // At zoom z the world is 256·2^z px square; pick the smallest z that covers the box.
      const minZoom = Math.ceil(Math.log2(Math.max(x, y) / 256));
      map.setMinZoom(minZoom);
      if (map.getZoom() < minZoom) map.setZoom(minZoom);
    };
    update();
    map.on("resize", update);
    return () => {
      map.off("resize", update);
    };
  }, [map]);
  return null;
}
