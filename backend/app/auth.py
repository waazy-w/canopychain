"""Wallet signatures for registering and reviewing projects (EIP-191 personal_sign).

The frontend asks the wallet to sign a short human-readable message; the backend rebuilds the same
message from the request and recovers the signer. Message formats are mirrored in
frontend/src/lib/auth.ts, and every number in them goes through fmt_number so both sides agree.
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_hash.auto import keccak
from web3 import Web3

from . import config
from .methodology import _js_numbers

SIGNATURE_MAX_AGE = timedelta(minutes=10)


class SignatureError(Exception):
    pass


def boundary_hash(polygon: dict[str, Any]) -> str:
    """keccak256 of the polygon as canonical JSON (sorted keys, no spaces, JS number formatting)."""
    body = _js_numbers({"type": polygon.get("type"), "coordinates": polygon.get("coordinates")})
    return "0x" + keccak(json.dumps(body, sort_keys=True, separators=(",", ":")).encode("utf-8")).hex()


def fmt_number(x: float) -> str:
    """At most two decimals, no trailing zeros: 2.1 -> "2.1", 450.0 -> "450". Matches the frontend."""
    return f"{round(x, 2):.2f}".rstrip("0").rstrip(".")


def registration_message(name: str, owner: str, polygon: dict[str, Any], issued_at: str) -> str:
    return (
        "CanopyChain: register a forest project\n\n"
        f"Name: {name}\n"
        f"Owner: {Web3.to_checksum_address(owner)}\n"
        f"Boundary hash: {boundary_hash(polygon)}\n"
        f"Issued at: {issued_at}"
    )


def review_message(
    project_id: int, decision: str, loss_rate_pct: float, tco2e_per_ha: float, note: str, issued_at: str
) -> str:
    return (
        "CanopyChain: review a forest project\n\n"
        f"Project: #{project_id}\n"
        f"Decision: {decision}\n"
        f"Regional baseline loss rate: {fmt_number(loss_rate_pct)}%\n"
        f"tCO2e per hectare: {fmt_number(tco2e_per_ha)}\n"
        f"Note: {note}\n"
        f"Issued at: {issued_at}"
    )


def check_fresh(issued_at: str) -> None:
    """Signatures expire after 10 minutes, so a leaked one can't be replayed later."""
    try:
        t = datetime.fromisoformat(issued_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise SignatureError("issuedAt must be an ISO-8601 timestamp") from exc
    if t.tzinfo is None:
        raise SignatureError("issuedAt must include a timezone")
    age = datetime.now(timezone.utc) - t
    if age > SIGNATURE_MAX_AGE or age < -timedelta(minutes=2):
        raise SignatureError("signature expired: sign again")


def recover_signer(message: str, signature: str) -> str:
    try:
        return Account.recover_message(encode_defunct(text=message), signature=signature)
    except Exception as exc:
        raise SignatureError("invalid signature") from exc


def require_signer(message: str, signature: str, expected: str) -> None:
    if recover_signer(message, signature) != Web3.to_checksum_address(expected):
        raise SignatureError("signature does not match the owner wallet")


def is_approver(address: str) -> bool:
    """Approvers are the CanopyCredits admin (read on-chain) plus any CANOPY_APPROVERS from backend/.env."""
    if not Web3.is_address(address or ""):
        return False
    address = Web3.to_checksum_address(address)
    if address in config.approver_addresses():
        return True
    from .oracle import get_oracle  # late import: the oracle module imports config at load time

    return get_oracle().is_admin(address)
