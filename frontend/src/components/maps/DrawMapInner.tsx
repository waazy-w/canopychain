"use client";

import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, useMap } from "react-leaflet";
import type { GeoJSONPolygon } from "@/lib/api/types";
import { SatelliteTiles } from "./SatelliteTiles";

type OnChange = (polygon: GeoJSONPolygon | null) => void;

function toPolygon(layer: L.Layer): GeoJSONPolygon | null {
  const feature = (layer as L.Polygon).toGeoJSON();
  return feature.geometry.type === "Polygon" ? (feature.geometry as GeoJSONPolygon) : null;
}

/** Geoman toolbar limited to one polygon: drawing a new one replaces the old. */
function DrawControls({ onChange }: { onChange: OnChange }) {
  const map = useMap();
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let current: L.Layer | null = null;
    map.pm.addControls({
      position: "topleft",
      drawPolygon: true,
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: true,
      drawCircle: false,
      drawText: false,
      cutPolygon: false,
      rotateMode: false,
      dragMode: true,
      editMode: true,
      removalMode: true,
    });
    map.pm.setPathOptions({ color: "#4ade80", fillOpacity: 0.15 });

    const emit = () => onChangeRef.current(current ? toPolygon(current) : null);
    const onCreate = (e: { layer: L.Layer }) => {
      if (current) map.removeLayer(current);
      current = e.layer;
      current.on("pm:edit pm:dragend", emit);
      emit();
    };
    const onRemove = (e: { layer: L.Layer }) => {
      if (e.layer === current) {
        current = null;
        emit();
      }
    };
    map.on("pm:create", onCreate);
    map.on("pm:remove", onRemove);
    return () => {
      map.off("pm:create", onCreate);
      map.off("pm:remove", onRemove);
      map.pm.removeControls();
    };
  }, [map]);
  return null;
}

export default function DrawMapInner({
  onChange,
  center = [-3.4, -62.2],
  zoom = 5,
}: {
  onChange: OnChange;
  center?: [number, number];
  zoom?: number;
}) {
  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full">
      <SatelliteTiles />
      <DrawControls onChange={onChange} />
    </MapContainer>
  );
}
