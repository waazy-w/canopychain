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


def approver_addresses() -> set[str]:
    """Extra project approvers (comma-separated addresses) on top of the contract admin, e.g. for local testing."""
    from web3 import Web3

    raw = os.environ.get("CANOPY_APPROVERS", "")
    return {Web3.to_checksum_address(a.strip()) for a in raw.split(",") if Web3.is_address(a.strip())}


def demo_controls_enabled() -> bool:
    """"Simulate deforestation" is a demo control; set CANOPY_DEMO_CONTROLS=0 to switch it off."""
    return os.environ.get("CANOPY_DEMO_CONTROLS", "1") not in ("0", "false", "no")


CORS_ORIGINS = [o.strip() for o in os.environ.get("CANOPY_CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
