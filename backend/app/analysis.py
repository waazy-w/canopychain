"""Baseline vs current forest comparison, simulated deforestation, NDVI previews, caching.

Two caches:
- Analysis cache (JSON stats + 2 small PNGs) keyed by polygon, target dates and the simulate flag.
  Runtime entries live in data/cache/analysis (gitignored). Entries for the demo forests are
  committed in backend/demo_cache so the live demo needs no satellite fetch.
- Composite cache (NDVI arrays, .npz) in data/cache/composites, runtime only. Rasters are never committed.
"""

import io
import json
import logging
import time
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path

import numpy as np
from PIL import Image
from shapely.geometry import Polygon

from . import config, satellite
from .geo import polygon_key
from .methodology import FOREST_NDVI_THRESHOLD, LOSS_MIN_NDVI_DROP

log = logging.getLogger(__name__)

ANALYSIS_VERSION = "v2"  # v2: NDVI preview colormap stretched over canopy values
SIMULATED_LOSS_FRACTION = 0.15
CLEARED_NDVI = 0.15  # bare soil after clearing
PREVIEW_MAX_PX = 512


@dataclass
class DateStats:
    date: str  # acquisition date of the primary scene
    targetDate: str
    forestCoverHa: float
    meanNdvi: float
    validCoveragePct: float
    sceneIds: list[str]


@dataclass
class Analysis:
    baseline: DateStats
    current: DateStats
    deforestedHa: float
    pixelSizeM: float
    previewBounds: list[list[float]]  # [[south, west], [north, east]] for map overlays
    simulated: bool


# ---------------------------------------------------------------------------
# Pure computations (unit-tested)
# ---------------------------------------------------------------------------


def forest_stats(ndvi: np.ndarray, polygon_mask: np.ndarray, pixel_ha: float) -> tuple[float, float, float]:
    """Returns (forest cover ha, mean NDVI, valid coverage %) over clear pixels inside the polygon."""
    valid = ~np.isnan(ndvi) & polygon_mask
    n_valid = int(valid.sum())
    if n_valid == 0:
        return 0.0, 0.0, 0.0
    forest = valid & (ndvi >= FOREST_NDVI_THRESHOLD)
    return (
        round(float(forest.sum()) * pixel_ha, 2),
        round(float(np.nanmean(ndvi[valid])), 3),
        round(100.0 * n_valid / max(int(polygon_mask.sum()), 1), 1),
    )


def deforested_ha(baseline: np.ndarray, current: np.ndarray, polygon_mask: np.ndarray, pixel_ha: float) -> float:
    """Baseline forest pixels that are no longer forest and dropped by LOSS_MIN_NDVI_DROP or more."""
    both = ~np.isnan(baseline) & ~np.isnan(current) & polygon_mask
    with np.errstate(invalid="ignore"):
        lost = (
            both
            & (baseline >= FOREST_NDVI_THRESHOLD)
            & (current < FOREST_NDVI_THRESHOLD)
            & (baseline - current >= LOSS_MIN_NDVI_DROP)
        )
    return round(float(lost.sum()) * pixel_ha, 2)


def simulate_deforestation(ndvi: np.ndarray, fraction: float = SIMULATED_LOSS_FRACTION) -> np.ndarray:
    """Clears a deterministic, contiguous block of ~`fraction` of the forest pixels.

    The cleared patch grows from the north-west-most forest pixel: the forest pixels closest to it
    are set to bare-soil NDVI.
    """
    out = ndvi.copy()
    with np.errstate(invalid="ignore"):
        rows, cols = np.nonzero(~np.isnan(ndvi) & (ndvi >= FOREST_NDVI_THRESHOLD))
    n = len(rows)
    k = int(round(n * fraction))
    if k == 0:
        return out
    seed = np.argmin(rows + cols)
    dist = (rows - rows[seed]) ** 2 + (cols - cols[seed]) ** 2
    pick = np.argsort(dist, kind="stable")[:k]
    out[rows[pick], cols[pick]] = CLEARED_NDVI
    return out


# NDVI → RGB stops: brown (bare/cleared) → tan → yellow-green → green → deep green. Half the stops sit above 0.65
# because dense canopy spans only ~0.75–0.95; a linear ramp would paint a whole rainforest one flat green.
NDVI_COLOR_STOPS = np.array(
    [
        (0.00, 140, 81, 10),
        (0.20, 191, 129, 45),
        (0.35, 223, 194, 125),
        (0.50, 199, 215, 110),
        (0.65, 120, 198, 121),
        (0.75, 49, 163, 84),
        (0.82, 26, 128, 64),
        (0.88, 12, 94, 46),
        (0.95, 4, 60, 30),
    ]
)


def ndvi_png(ndvi: np.ndarray, polygon_mask: np.ndarray) -> bytes:
    """NDVI colormap (brown → green, stretched over canopy values), transparent outside the polygon, grey where clouded."""
    h, w = ndvi.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    valid = ~np.isnan(ndvi) & polygon_mask
    v = np.nan_to_num(ndvi, nan=0.0)
    stops = NDVI_COLOR_STOPS
    for channel in range(3):
        rgba[..., channel] = np.round(np.interp(v, stops[:, 0], stops[:, channel + 1])).astype(np.uint8)
    rgba[valid, 3] = 255
    clouded = polygon_mask & ~valid
    rgba[clouded] = (180, 180, 180, 160)

    img = Image.fromarray(rgba, "RGBA")
    scale = PREVIEW_MAX_PX / max(h, w)
    img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.Resampling.NEAREST)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Caching
# ---------------------------------------------------------------------------


def analysis_key(poly: Polygon, baseline_target: date, current_target: date, simulate: bool) -> str:
    sim = "sim" if simulate else "obs"
    return f"{polygon_key(poly)}_{baseline_target.isoformat()}_{current_target.isoformat()}_{sim}_{ANALYSIS_VERSION}"


def _runtime_analysis_dir() -> Path:
    return config.data_dir() / "cache" / "analysis"


def _composite_path(poly: Polygon, target: date) -> Path:
    return config.data_dir() / "cache" / "composites" / f"{polygon_key(poly)}_{target.isoformat()}_{ANALYSIS_VERSION}.npz"


def load_cached_analysis(key: str) -> tuple[Analysis, bytes, bytes] | None:
    for base in (_runtime_analysis_dir(), config.DEMO_CACHE_DIR):
        d = base / key
        if (d / "analysis.json").exists():
            raw = json.loads((d / "analysis.json").read_text(encoding="utf-8"))
            a = Analysis(
                baseline=DateStats(**raw["baseline"]),
                current=DateStats(**raw["current"]),
                deforestedHa=raw["deforestedHa"],
                pixelSizeM=raw["pixelSizeM"],
                previewBounds=raw["previewBounds"],
                simulated=raw["simulated"],
            )
            return a, (d / "baseline.png").read_bytes(), (d / "current.png").read_bytes()
    return None


def save_analysis(base: Path, key: str, a: Analysis, baseline_png: bytes, current_png: bytes) -> Path:
    d = base / key
    d.mkdir(parents=True, exist_ok=True)
    (d / "analysis.json").write_text(json.dumps(asdict(a), indent=2), encoding="utf-8")
    (d / "baseline.png").write_bytes(baseline_png)
    (d / "current.png").write_bytes(current_png)
    return d


def _composite(poly: Polygon, grid: satellite.Grid, target: date) -> satellite.Composite:
    path = _composite_path(poly, target)
    if path.exists():
        z = np.load(path, allow_pickle=False)
        return satellite.Composite(
            ndvi=z["ndvi"],
            scene_ids=[str(s) for s in z["scene_ids"]],
            scene_date=str(z["scene_date"]),
            valid_fraction=float(z["valid_fraction"]),
        )
    t0 = time.perf_counter()
    comp = satellite.read_composite(poly, grid, target)
    log.info("composite %s around %s: %d scenes in %.1fs", polygon_key(poly), target, len(comp.scene_ids), time.perf_counter() - t0)
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        path,
        ndvi=comp.ndvi,
        scene_ids=np.array(comp.scene_ids),
        scene_date=np.array(comp.scene_date),
        valid_fraction=np.array(comp.valid_fraction),
    )
    return comp


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def analyze(
    poly: Polygon, baseline_target: date, current_target: date, simulate: bool = False
) -> tuple[Analysis, bytes, bytes]:
    """Returns the comparison plus baseline/current preview PNGs. Raises satellite.SatelliteError."""
    key = analysis_key(poly, baseline_target, current_target, simulate)
    cached = load_cached_analysis(key)
    if cached:
        return cached

    grid = satellite.make_grid(poly)
    base = _composite(poly, grid, baseline_target)
    cur = _composite(poly, grid, current_target)
    cur_ndvi = simulate_deforestation(cur.ndvi) if simulate else cur.ndvi

    def stats(comp: satellite.Composite, ndvi: np.ndarray, target: date) -> DateStats:
        forest, mean, coverage = forest_stats(ndvi, grid.polygon_mask, grid.pixel_ha)
        return DateStats(
            date=comp.scene_date or target.isoformat(),
            targetDate=target.isoformat(),
            forestCoverHa=forest,
            meanNdvi=mean,
            validCoveragePct=coverage,
            sceneIds=comp.scene_ids,
        )

    s, w, n, e = grid.bounds_wgs84
    a = Analysis(
        baseline=stats(base, base.ndvi, baseline_target),
        current=stats(cur, cur_ndvi, current_target),
        deforestedHa=deforested_ha(base.ndvi, cur_ndvi, grid.polygon_mask, grid.pixel_ha),
        pixelSizeM=grid.res_m,
        previewBounds=[[round(s, 6), round(w, 6)], [round(n, 6), round(e, 6)]],
        simulated=simulate,
    )
    baseline_png = ndvi_png(base.ndvi, grid.polygon_mask)
    current_png = ndvi_png(cur_ndvi, grid.polygon_mask)
    save_analysis(_runtime_analysis_dir(), key, a, baseline_png, current_png)
    return a, baseline_png, current_png
