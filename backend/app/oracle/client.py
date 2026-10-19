"""Oracle: writes registrations, verifications and reversals to CanopyCredits.

Reads the address and ABI from shared/contracts.json (written by contracts/scripts/deploy.ts)
and signs with ORACLE_PRIVATE_KEY. If either is missing the oracle is disabled: every call
returns TxResult(tx_hash=None, error="oracle disabled: <reason>") and the API keeps working
off-chain.
"""

import json
import logging
import threading
from dataclasses import dataclass
from typing import Any

from eth_hash.auto import keccak
from web3 import Web3
from web3.exceptions import ContractLogicError
from web3.middleware import ExtraDataToPOAMiddleware

from .. import config

log = logging.getLogger(__name__)

AMOY_CHAIN_ID = 80002
# Amoy rejects tips under 25 gwei, and its eth_maxPriorityFeePerGas often suggests 400+ gwei on near-empty
# blocks, so we pay a fixed tip instead of trusting the estimate.
AMOY_PRIORITY_FEE = Web3.to_wei(35, "gwei")
RECEIPT_TIMEOUT_S = 120

_send_lock = threading.Lock()  # one transaction at a time, so nonces never collide


@dataclass
class TxResult:
    tx_hash: str | None = None
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.tx_hash is not None and self.error is None


def _load_contracts() -> dict:
    path = config.contracts_json_path()
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _error_selectors(abi: list[dict]) -> dict[str, str]:
    out = {}
    for entry in abi:
        if entry.get("type") == "error":
            sig = f"{entry['name']}({','.join(i['type'] for i in entry.get('inputs', []))})"
            out["0x" + keccak(sig.encode()).hex()[:8]] = entry["name"]
    return out


class Oracle:
    def __init__(self, w3: Web3 | None = None, contracts: dict | None = None, private_key: str | None = None):
        contracts = _load_contracts() if contracts is None else contracts
        info = contracts.get("CanopyCredits") or {}
        self.address: str = info.get("address") or ""
        self.abi: list[dict] = info.get("abi") or []
        self.chain_id: int | None = contracts.get("chainId")
        self._key = private_key if private_key is not None else config.oracle_private_key()
        self._w3 = w3
        self._contract = None
        self._errors = _error_selectors(self.abi)

    # -- status ---------------------------------------------------------------

    def disabled_reason(self) -> str | None:
        if not self.address or not self.abi:
            return "no contract address in shared/contracts.json (deploy the contract first)"
        if not self._key:
            return "ORACLE_PRIVATE_KEY is not set in backend/.env"
        return None

    @property
    def enabled(self) -> bool:
        return self.disabled_reason() is None

    def _disabled(self) -> TxResult:
        return TxResult(error=f"oracle disabled: {self.disabled_reason()}")

    @property
    def w3(self) -> Web3:
        if self._w3 is None:
            self._w3 = Web3(Web3.HTTPProvider(config.amoy_rpc_url(), request_kwargs={"timeout": 30}))
            # Polygon blocks carry 97+ bytes of extraData, which web3.py rejects without this.
            self._w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        return self._w3

    @property
    def contract(self):
        if self._contract is None:
            self._contract = self.w3.eth.contract(address=Web3.to_checksum_address(self.address), abi=self.abi)
        return self._contract

    # -- reads ----------------------------------------------------------------

    def is_admin(self, address: str) -> bool:
        """True if `address` holds DEFAULT_ADMIN_ROLE on CanopyCredits. Read-only, needs no oracle key."""
        if not self.address or not self.abi:
            return False
        try:
            return bool(self.contract.functions.hasRole(b"\x00" * 32, Web3.to_checksum_address(address)).call())
        except Exception as exc:
            log.warning("hasRole(admin, %s) failed: %s", address, exc)
            return False

    def is_registered(self, project_id: int) -> bool:
        try:
            self.contract.functions.getProject(project_id).call()
            return True
        except ContractLogicError as exc:  # includes ContractCustomError
            if self._error_name(exc) == "ProjectNotFound":
                return False
            raise

    # -- writes ---------------------------------------------------------------

    def register_project(self, project_id: int, owner: str, metadata_uri: str) -> TxResult:
        if not self.enabled:
            return self._disabled()
        return self._send(
            "registerProject", project_id, Web3.to_checksum_address(owner), metadata_uri
        )

    def ensure_registered(self, project_id: int, owner: str, metadata_uri: str) -> TxResult | None:
        """Registers the project if the chain doesn't know it yet. Returns None if already registered."""
        if not self.enabled:
            return self._disabled()
        try:
            if self.is_registered(project_id):
                return None
        except Exception as exc:
            return TxResult(error=f"could not read project {project_id} on-chain: {self._describe(exc)}")
        return self.register_project(project_id, owner, metadata_uri)

    def submit_verification(
        self, project_id: int, vintage: int, credits: int, report_hash: str, report_uri: str
    ) -> TxResult:
        if not self.enabled:
            return self._disabled()
        return self._send(
            "submitVerification", project_id, vintage, credits, Web3.to_bytes(hexstr=report_hash), report_uri
        )

    def flag_reversal(self, project_id: int, vintage: int, lost_credits: int, report_hash: str) -> TxResult:
        if not self.enabled:
            return self._disabled()
        return self._send("flagReversal", project_id, vintage, lost_credits, Web3.to_bytes(hexstr=report_hash))

    def _send(self, fn_name: str, *args: Any) -> TxResult:
        with _send_lock:
            try:
                acct = self.w3.eth.account.from_key(self._key)
                fn = getattr(self.contract.functions, fn_name)(*args)
                tx = fn.build_transaction(
                    {
                        "from": acct.address,
                        "nonce": self.w3.eth.get_transaction_count(acct.address, "pending"),
                        "chainId": self.w3.eth.chain_id,
                        **self._fees(),
                    }
                )
                signed = acct.sign_transaction(tx)
                tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=RECEIPT_TIMEOUT_S)
                hex_hash = "0x" + bytes(tx_hash).hex().removeprefix("0x")
                if receipt["status"] != 1:
                    return TxResult(tx_hash=hex_hash, error=f"{fn_name} transaction reverted")
                log.info("%s%s -> %s", fn_name, args, hex_hash)
                return TxResult(tx_hash=hex_hash)
            except Exception as exc:
                log.warning("%s failed: %s", fn_name, exc)
                return TxResult(error=f"{fn_name} failed: {self._describe(exc)}")

    def _fees(self) -> dict:
        base = self.w3.eth.get_block("latest").get("baseFeePerGas")
        if base is None:
            return {}
        if self.w3.eth.chain_id == AMOY_CHAIN_ID:
            tip = AMOY_PRIORITY_FEE
        else:
            tip = self.w3.eth.max_priority_fee
        return {"maxPriorityFeePerGas": tip, "maxFeePerGas": base * 2 + tip}

    # -- errors ---------------------------------------------------------------

    def _error_name(self, exc: Exception) -> str | None:
        # Revert data arrives as a hex string, or (Hardhat and some RPCs) nested as {"data": "0x…", ...}.
        data = getattr(exc, "data", None)
        if isinstance(data, dict):
            data = data.get("data")
        if isinstance(data, str) and data.startswith("0x") and len(data) >= 10:
            return self._errors.get(data[:10].lower())
        return None

    def _describe(self, exc: Exception) -> str:
        if isinstance(exc, ContractLogicError):
            name = self._error_name(exc)
            if name:
                return f"contract reverted with {name}"
            return f"contract reverted: {exc.message or exc}"
        return str(exc) or exc.__class__.__name__


def get_oracle() -> Oracle:
    """A fresh oracle per request, so a redeploy (new shared/contracts.json) is picked up without a restart."""
    return Oracle()
