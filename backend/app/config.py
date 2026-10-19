"""Paths and settings. Secrets come from backend/.env (gitignored), loaded with python-dotenv."""

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent

load_dotenv(BACKEND_DIR / ".env")


def data_dir() -> Path:
    """Runtime storage (gitignored). Overridable so tests can use a temp dir."""
    return Path(os.environ.get("CANOPY_DATA_DIR", BACKEND_DIR / "data"))


# Committed analysis cache for the demo forests: JSON stats + small PNGs only, no rasters.
DEMO_CACHE_DIR = BACKEND_DIR / "demo_cache"


def contracts_json_path() -> Path:
    return Path(os.environ.get("CONTRACTS_JSON", REPO_ROOT / "shared" / "contracts.json"))


def public_base_url() -> str:
    return os.environ.get("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")


def amoy_rpc_url() -> str:
    return os.environ.get("AMOY_RPC_URL", "https://rpc-amoy.polygon.technology")


def oracle_private_key() -> str | None:
    return os.environ.get("ORACLE_PRIVATE_KEY") or None


CORS_ORIGINS = ["http://localhost:3000"]
