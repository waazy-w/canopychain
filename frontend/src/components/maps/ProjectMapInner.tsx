"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { GeoJSON, MapContainer, useMap } from "react-leaflet";
import type { GeoJSONPolygon } from "@/lib/api/types";
import { SatelliteTiles, WORLD_MAP_OPTIONS } from "./SatelliteTiles";

function FitBounds({ polygon }: { polygon: GeoJSONPolygon }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.geoJSON(polygon).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, polygon]);
  return null;
}

export default function ProjectMapInner({ polygon, reversed }: { polygon: GeoJSONPolygon; reversed?: boolean }) {
  const color = reversed ? "#dc2626" : "#34d399";
  return (
    <MapContainer center={[0, 0]} zoom={2} scrollWheelZoom={false} {...WORLD_MAP_OPTIONS} className="h-full w-full">
      <SatelliteTiles />
      <GeoJSON
        key={`${JSON.stringify(polygon.coordinates)}-${color}`}
        data={polygon}
        style={{ color, weight: 2, fillOpacity: 0.15 }}
      />
      <FitBounds polygon={polygon} />
    </MapContainer>
  );
}
