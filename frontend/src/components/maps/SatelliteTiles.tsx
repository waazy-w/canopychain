"use client";

import { TileLayer } from "react-leaflet";

export function SatelliteTiles() {
  return (
    <TileLayer
      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      attribution="Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
      maxZoom={18}
    />
  );
}
