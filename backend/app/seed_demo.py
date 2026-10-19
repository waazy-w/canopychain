"""Registers the demo forests as projects.

    python -m app.seed_demo                 # register demo projects (skips ones that exist)
    python -m app.seed_demo --build-cache   # also (re)build backend/demo_cache for this month

The demo cache holds analysis JSON + PNG previews only (no rasters), for both the observed and
the simulated-deforestation case, so verify and monitor are instant during the live demo.
"""

import argparse
import time

from shapely.geometry import shape

from . import analysis, config, service, storage
from .demo_forests import DEMO_FORESTS

DEMO_OWNER = "0x000000000000000000000000000000000000dEaD"


def build_cache() -> None:
    baseline_t, current_t = service.target_dates()
    for forest in DEMO_FORESTS:
        poly = shape(forest["polygon"])
        for simulate in (False, True):
            key = analysis.analysis_key(poly, baseline_t, current_t, simulate)
            t0 = time.perf_counter()
            a, bpng, cpng = analysis.analyze(poly, baseline_t, current_t, simulate)
            d = analysis.save_analysis(config.DEMO_CACHE_DIR, key, a, bpng, cpng)
            print(
                f"{forest['name']} ({'simulated' if simulate else 'observed'}): baseline {a.baseline.forestCoverHa} ha, "
                f"current {a.current.forestCoverHa} ha, deforested {a.deforestedHa} ha "
                f"[{time.perf_counter() - t0:.1f}s] -> {d.relative_to(config.BACKEND_DIR)}"
            )


def seed(owner: str) -> None:
    existing = {p["name"] for p in storage.list_projects()}
    for forest in DEMO_FORESTS:
        if forest["name"] in existing:
            print(f"exists: {forest['name']}")
            continue
        res = service.create_project(forest["name"], owner, forest["polygon"])
        print(f"registered project {res['projectId']}: {forest['name']} (tx {res['txHash'] or res['onChainError']})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--build-cache", action="store_true", help="rebuild backend/demo_cache for this month")
    parser.add_argument("--owner", default=DEMO_OWNER, help="wallet that receives the credits")
    parser.add_argument("--no-register", action="store_true", help="only build the cache")
    args = parser.parse_args()
    if args.build_cache:
        build_cache()
    if not args.no_register:
        seed(args.owner)


if __name__ == "__main__":
    main()
