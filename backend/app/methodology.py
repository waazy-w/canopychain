"""Prototype carbon methodology and report hashing. NOT a certified methodology."""

import json
from typing import Any

from eth_hash.auto import keccak

METHODOLOGY = "canopychain-prototype-v0 (NOT a certified methodology)"
FOREST_NDVI_THRESHOLD = 0.6
# A baseline forest pixel counts as lost when it is no longer forest AND its NDVI dropped by at
# least this much. This keeps pixels hovering around the threshold from reading as deforestation.
LOSS_MIN_NDVI_DROP = 0.2
DEFAULT_TCO2E_PER_HA = 450.0
DEFAULT_REGIONAL_LOSS_RATE_PCT = 2.1

# Fields added after hashing (transaction results), plus the hash itself.
UNHASHED_FIELDS = ("reportHash", "txHash", "onChainError", "lostCredits")


def avoided_loss_ha(baseline_forest_ha: float, regional_loss_rate_pct: float, deforested_ha: float) -> float:
    """Expected regional loss minus observed loss, floored at zero."""
    return max(0.0, baseline_forest_ha * regional_loss_rate_pct / 100 - deforested_ha)


def credits_for(avoided_ha: float, tco2e_per_ha: float) -> int:
    """1 credit = 1 tCO2e."""
    return int(round(avoided_ha * tco2e_per_ha))


def lost_credits(newly_deforested_ha: float, tco2e_per_ha: float) -> int:
    return int(round(max(0.0, newly_deforested_ha) * tco2e_per_ha))


def canonical_json(report: dict[str, Any]) -> bytes:
    body = {k: v for k, v in report.items() if k not in UNHASHED_FIELDS}
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def report_hash(report: dict[str, Any]) -> str:
    return "0x" + keccak(canonical_json(report)).hex()
