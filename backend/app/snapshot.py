"""Saves the current projects and reports as the deploy seed (backend/seed_state by default).

    python -m app.snapshot            # after a demo run on Amoy, then commit backend/seed_state

A hosted backend started with CANOPY_SEED_DIR=seed_state restores it whenever its disk is empty.
"""

import argparse
from pathlib import Path

from . import config, storage


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=config.BACKEND_DIR / "seed_state")
    args = parser.parse_args()
    storage.write_snapshot(args.out)
    print(f"snapshot of {len(storage.list_projects())} projects from {config.data_dir()} -> {args.out}")


if __name__ == "__main__":
    main()
