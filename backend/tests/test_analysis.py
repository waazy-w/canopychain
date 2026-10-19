import io

import numpy as np
from PIL import Image

from app.analysis import CLEARED_NDVI, deforested_ha, forest_stats, ndvi_png, simulate_deforestation

PIXEL_HA = 0.01


def test_forest_stats_ignores_clouds_and_outside_pixels():
    ndvi = np.array([[0.8, 0.7, np.nan], [0.3, 0.9, 0.9]], dtype=np.float32)
    inside = np.array([[True, True, True], [True, True, False]])
    forest, mean, coverage = forest_stats(ndvi, inside, PIXEL_HA)
    assert forest == 0.03  # 0.8, 0.7, 0.9 inside and clear
    assert mean == round((0.8 + 0.7 + 0.3 + 0.9) / 4, 3)
    assert coverage == 80.0  # 4 of 5 polygon pixels clear


def test_forest_stats_all_clouded():
    ndvi = np.full((2, 2), np.nan, dtype=np.float32)
    assert forest_stats(ndvi, np.ones((2, 2), bool), PIXEL_HA) == (0.0, 0.0, 0.0)


def test_deforestation_requires_threshold_crossing_and_real_drop():
    base = np.array([[0.85, 0.62, 0.85, 0.85, 0.5]], dtype=np.float32)
    cur = np.array([[0.20, 0.55, np.nan, 0.80, 0.1]], dtype=np.float32)
    inside = np.ones_like(base, dtype=bool)
    # Only pixel 0 counts: pixel 1 dropped < 0.2, pixel 2 is clouded, pixel 3 still forest, pixel 4 never forest.
    assert deforested_ha(base, cur, inside, PIXEL_HA) == 0.01


def test_simulated_deforestation_clears_contiguous_15_percent():
    ndvi = np.full((100, 100), 0.85, dtype=np.float32)
    ndvi[50:, 50:] = 0.3  # non-forest block is untouched
    out = simulate_deforestation(ndvi)
    cleared = out == np.float32(CLEARED_NDVI)
    forest_pixels = 7500
    assert cleared.sum() == round(forest_pixels * 0.15)
    assert cleared[0, 0]  # grows from the north-west corner
    assert not cleared[50:, 50:].any()
    # Contiguous: every cleared pixel touches another cleared pixel.
    r, c = np.nonzero(cleared)
    padded = np.pad(cleared, 1)
    neighbours = padded[r, c + 1] | padded[r + 2, c + 1] | padded[r + 1, c] | padded[r + 1, c + 2]
    assert neighbours.all()
    # Deterministic and does not mutate the input.
    assert np.array_equal(out, simulate_deforestation(ndvi))
    assert (ndvi != np.float32(CLEARED_NDVI)).all()


def test_simulated_deforestation_with_no_forest_is_a_noop():
    ndvi = np.full((5, 5), 0.2, dtype=np.float32)
    assert np.array_equal(simulate_deforestation(ndvi), ndvi)


def test_preview_png_is_512px_and_transparent_outside_polygon():
    ndvi = np.full((40, 80), 0.8, dtype=np.float32)
    inside = np.zeros_like(ndvi, dtype=bool)
    inside[:, :40] = True
    img = Image.open(io.BytesIO(ndvi_png(ndvi, inside)))
    assert img.mode == "RGBA" and img.size == (512, 256)
    assert img.getpixel((10, 10))[3] == 255  # inside: opaque green
    assert img.getpixel((10, 10))[1] > img.getpixel((10, 10))[0]
    assert img.getpixel((500, 10))[3] == 0  # outside: transparent
