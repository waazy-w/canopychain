"""Polygon validation and area."""

import hashlib
import json
from typing import Any

from pyproj import Geod
from shapely.geometry import Polygon, mapping, shape

MAX_AREA_HA = 50_000
MIN_AREA_HA = 1

_GEOD = Geod(ellps="WGS84")


class PolygonError(ValueError):
    pass


def parse_polygon(geojson: Any) -> Polygon:
    """Accepts a GeoJSON Polygon (or a Feature wrapping one) in lng/lat and returns a valid shapely Polygon."""
    if isinstance(geojson, dict) and geojson.get("type") == "Feature":
        geojson = geojson.get("geometry")
    if not isinstance(geojson, dict) or geojson.get("type") != "Polygon":
        raise PolygonError("polygon must be a GeoJSON Polygon")
    try:
        poly = shape(geojson)
    except Exception as exc:  # malformed coordinates
        raise PolygonError(f"invalid polygon coordinates: {exc}") from exc
    if poly.is_empty or not poly.is_valid:
        raise PolygonError("polygon is empty or self-intersecting")
    minx, miny, maxx, maxy = poly.bounds
    if minx < -180 or maxx > 180 or miny < -90 or maxy > 90:
        raise PolygonError("coordinates must be [lng, lat] in WGS84")
    area = area_ha(poly)
    if area < MIN_AREA_HA:
        raise PolygonError(f"polygon is too small ({area:.2f} ha)")
    if area > MAX_AREA_HA:
        raise PolygonError(f"polygon is too large ({area:,.0f} ha, max {MAX_AREA_HA:,} ha)")
    return poly


def area_ha(poly: Polygon) -> float:
    area_m2, _ = _GEOD.geometry_area_perimeter(poly)
    return abs(area_m2) / 10_000


def to_geojson(poly: Polygon) -> dict:
    gj = mapping(poly)
    return {"type": "Polygon", "coordinates": [[list(pt) for pt in ring] for ring in gj["coordinates"]]}


def polygon_key(poly: Polygon) -> str:
    """Stable hash of a polygon (coordinates rounded to ~10 cm) for cache keys."""
    gj = to_geojson(poly)
    rounded = [[[round(x, 6), round(y, 6)] for x, y in ring] for ring in gj["coordinates"]]
    return hashlib.sha256(json.dumps(rounded, separators=(",", ":")).encode()).hexdigest()[:16]
