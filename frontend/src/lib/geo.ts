import area from "@turf/area";
import type { GeoJSONPolygon } from "./api/types";

export function round(n: number, digits = 1) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Geodesic polygon area in hectares, rounded to 0.1 ha. */
export function polygonAreaHa(polygon: GeoJSONPolygon): number {
  return round(area({ type: "Feature", geometry: polygon, properties: {} }) / 10_000, 1);
}
