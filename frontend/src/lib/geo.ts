import { Geodesic } from "geographiclib-geodesic";
import type { GeoJSONPolygon } from "./api/types";

export function round(n: number, digits = 1) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function ringAreaM2(ring: number[][]): number {
  const poly = Geodesic.WGS84.Polygon(false);
  // GeoJSON rings repeat the first point at the end; GeographicLib closes the ring itself.
  const closed = ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1];
  for (const point of closed ? ring.slice(0, -1) : ring) poly.AddPoint(point[1], point[0]);
  return Math.abs(poly.Compute(false, true).area ?? 0); // area is only absent for polylines
}

/**
 * Polygon area in hectares on the WGS84 ellipsoid, rounded to 0.01 ha. This is the same geodesic
 * algorithm (GeographicLib, via pyproj's Geod) the backend uses, so the two agree exactly.
 */
export function polygonAreaHa(polygon: GeoJSONPolygon): number {
  const [outer, ...holes] = polygon.coordinates;
  const m2 = ringAreaM2(outer) - holes.reduce((sum, h) => sum + ringAreaM2(h), 0);
  return round(m2 / 10_000, 2);
}

/** The vintage a verification run today is issued under (backend: year of the current month). */
export function currentVintage() {
  return new Date().getUTCFullYear();
}
