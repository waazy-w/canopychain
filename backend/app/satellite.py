"""Sentinel-2 L2A NDVI from Microsoft Planetary Computer (no API key needed).

Both dates of a comparison are read onto the same grid (UTM, fixed resolution, polygon bbox),
so their pixels line up and can be compared one to one.
"""

import logging
import math
from dataclasses import dataclass, field
from datetime import date, timedelta

import numpy as np
import planetary_computer
import pystac_client
import rasterio
from affine import Affine
from pyproj import CRS, Transformer
from rasterio.enums import Resampling
from rasterio.features import geometry_mask
from rasterio.vrt import WarpedVRT
from shapely.geometry import Polygon, mapping
from shapely.ops import transform as shp_transform

log = logging.getLogger(__name__)

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION = "sentinel-2-l2a"
WINDOW_DAYS = 60
MAX_CLOUD_COVER = 30
MAX_SCENES = 4
TARGET_FILL = 0.95
# SCL classes excluded: 0 no data, 3 cloud shadow, 8/9 cloud, 10 thin cirrus.
SCL_EXCLUDE = (0, 3, 8, 9, 10)
BASE_RES_M = 10.0
MAX_PIXELS = 1_500_000  # coarser grid for very large polygons

GDAL_ENV = {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif,.TIF,.tiff",
    "GDAL_HTTP_MULTIRANGE": "YES",
    "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
    "GDAL_HTTP_MAX_RETRY": "3",
    "GDAL_HTTP_RETRY_DELAY": "1",
    "VSI_CACHE": "TRUE",
}


class SatelliteError(RuntimeError):
    pass


@dataclass
class Grid:
    crs: CRS
    transform: Affine
    width: int
    height: int
    res_m: float
    polygon_mask: np.ndarray  # True inside the polygon
    bounds_wgs84: tuple[float, float, float, float]  # south, west, north, east

    @property
    def pixel_ha(self) -> float:
        return self.res_m * self.res_m / 10_000


@dataclass
class Composite:
    ndvi: np.ndarray  # float32, NaN where invalid or outside the polygon
    scene_ids: list[str] = field(default_factory=list)
    scene_date: str | None = None  # acquisition date of the primary (least cloudy) scene
    valid_fraction: float = 0.0  # share of polygon pixels with a clear observation


def utm_crs_for(poly: Polygon) -> CRS:
    c = poly.centroid
    zone = int((c.x + 180) // 6) + 1
    return CRS.from_epsg((32600 if c.y >= 0 else 32700) + zone)


def make_grid(poly: Polygon) -> Grid:
    crs = utm_crs_for(poly)
    to_utm = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    poly_utm = shp_transform(to_utm.transform, poly)
    minx, miny, maxx, maxy = poly_utm.bounds
    area_m2 = (maxx - minx) * (maxy - miny)
    res = max(BASE_RES_M, math.ceil(math.sqrt(area_m2 / MAX_PIXELS)))
    # Snap to the resolution so grids are reproducible.
    minx, miny = math.floor(minx / res) * res, math.floor(miny / res) * res
    maxx, maxy = math.ceil(maxx / res) * res, math.ceil(maxy / res) * res
    width, height = int((maxx - minx) / res), int((maxy - miny) / res)
    transform = Affine(res, 0, minx, 0, -res, maxy)
    inside = geometry_mask([mapping(poly_utm)], out_shape=(height, width), transform=transform, invert=True)

    to_wgs = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    xs, ys = to_wgs.transform([minx, minx, maxx, maxx], [miny, maxy, miny, maxy])
    bounds = (min(ys), min(xs), max(ys), max(xs))
    return Grid(crs, transform, width, height, float(res), inside, bounds)


def search_scenes(poly: Polygon, target: date) -> list:
    start, end = target - timedelta(days=WINDOW_DAYS), target + timedelta(days=WINDOW_DAYS)
    try:
        catalog = pystac_client.Client.open(STAC_URL, modifier=planetary_computer.sign_inplace)
        search = catalog.search(
            collections=[COLLECTION],
            intersects=mapping(poly),
            datetime=f"{start.isoformat()}/{end.isoformat()}",
            query={"eo:cloud_cover": {"lt": MAX_CLOUD_COVER}},
            max_items=200,
        )
        items = list(search.items())
    except Exception as exc:
        raise SatelliteError(f"Planetary Computer STAC search failed: {exc}") from exc

    def score(item):
        covers = item.geometry and _covers(item.geometry, poly)
        # Prefer scenes that contain the whole polygon, then the least cloudy, then closest to target.
        days = abs((item.datetime.date() - target).days)
        return (0 if covers else 1, item.properties.get("eo:cloud_cover", 100), days)

    return sorted(items, key=score)


def _covers(geom: dict, poly: Polygon) -> bool:
    from shapely.geometry import shape

    try:
        return shape(geom).buffer(0).contains(poly)
    except Exception:
        return False


def _read_band(href: str, grid: Grid, resampling: Resampling) -> np.ndarray:
    with rasterio.open(href) as src:
        with WarpedVRT(
            src,
            crs=grid.crs,
            transform=grid.transform,
            width=grid.width,
            height=grid.height,
            resampling=resampling,
            nodata=0,
        ) as vrt:
            return vrt.read(1)


def _offset(item) -> int:
    # Processing baseline 04.00+ (Jan 2022 onwards) stores reflectance with a +1000 offset.
    baseline = str(item.properties.get("s2:processing_baseline", "04.00"))
    try:
        return 1000 if float(baseline) >= 4.0 else 0
    except ValueError:
        return 1000


def read_composite(poly: Polygon, grid: Grid, target: date) -> Composite:
    """Least-cloudy-first mosaic of cloud-masked NDVI around `target` (±60 days)."""
    items = search_scenes(poly, target)
    if not items:
        raise SatelliteError(
            f"no Sentinel-2 scene with <{MAX_CLOUD_COVER}% cloud within {WINDOW_DAYS} days of {target.isoformat()}"
        )

    ndvi = np.full((grid.height, grid.width), np.nan, dtype=np.float32)
    total = int(grid.polygon_mask.sum())
    comp = Composite(ndvi=ndvi)

    with rasterio.Env(**GDAL_ENV):
        for item in items[:MAX_SCENES]:
            try:
                b04 = _read_band(item.assets["B04"].href, grid, Resampling.bilinear).astype(np.float32)
                b08 = _read_band(item.assets["B08"].href, grid, Resampling.bilinear).astype(np.float32)
                scl = _read_band(item.assets["SCL"].href, grid, Resampling.nearest)
            except Exception as exc:
                log.warning("skipping scene %s: %s", item.id, exc)
                continue

            off = _offset(item)
            red, nir = b04 - off, b08 - off
            clear = (
                ~np.isin(scl, SCL_EXCLUDE)
                & (b04 > 0)
                & (b08 > 0)
                & (red + nir > 0)
                & grid.polygon_mask
                & np.isnan(ndvi)
            )
            if not clear.any():
                continue
            with np.errstate(divide="ignore", invalid="ignore"):
                scene_ndvi = (nir - red) / (nir + red)
            ndvi[clear] = np.clip(scene_ndvi[clear], -1, 1)
            comp.scene_ids.append(item.id)
            if comp.scene_date is None:
                comp.scene_date = item.datetime.date().isoformat()

            comp.valid_fraction = float((~np.isnan(ndvi) & grid.polygon_mask).sum()) / max(total, 1)
            if comp.valid_fraction >= TARGET_FILL:
                break

    if not comp.scene_ids:
        raise SatelliteError(f"could not read any clear Sentinel-2 pixels near {target.isoformat()}")
    return comp
