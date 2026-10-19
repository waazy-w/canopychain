"""Oracle unit tests with a mocked web3, plus an optional integration test against a local chain.

Integration: start `npx hardhat node` in contracts/, run `npm run deploy:local`, then
    CANOPY_IT_CONTRACTS_JSON=../contracts/deployments/local.json pytest tests/test_oracle.py
"""

import json
import os
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from eth_hash.auto import keccak
from web3.exceptions import ContractCustomError, ContractLogicError

from app.oracle import Oracle

ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"
KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"  # hardhat test account #1
ABI = [
    {"type": "error", "name": "ProjectNotFound", "inputs": [{"name": "projectId", "type": "uint256"}]},
    {"type": "error", "name": "AlreadyVerified", "inputs": [{"name": "p", "type": "uint256"}, {"name": "v", "type": "uint16"}]},
]
CONTRACTS = {"chainId": 80002, "CanopyCredits": {"address": ADDRESS, "abi": ABI}}


def selector(sig: str) -> str:
    return "0x" + keccak(sig.encode()).hex()[:8]


def test_disabled_without_address():
    o = Oracle(contracts={"chainId": 80002, "CanopyCredits": {"address": "", "abi": []}}, private_key=KEY)
    assert not o.enabled and "deploy the contract" in o.disabled_reason()
    res = o.register_project(1, ADDRESS, "uri")
    assert res.tx_hash is None and res.error.startswith("oracle disabled:")
    assert o.flag_reversal(1, 2026, 5, "0x" + "00" * 32).error.startswith("oracle disabled:")


def test_disabled_without_key(monkeypatch):
    monkeypatch.delenv("ORACLE_PRIVATE_KEY", raising=False)
    o = Oracle(contracts=CONTRACTS)
    assert "ORACLE_PRIVATE_KEY" in o.disabled_reason()
    assert o.submit_verification(1, 2026, 10, "0x" + "00" * 32, "uri").error.startswith("oracle disabled:")


def test_reads_shared_contracts_json(tmp_path, monkeypatch):
    path = tmp_path / "contracts.json"
    path.write_text(json.dumps(CONTRACTS))
    monkeypatch.setenv("CONTRACTS_JSON", str(path))
    o = Oracle(private_key=KEY)
    assert o.enabled and o.address == ADDRESS


def test_custom_errors_are_named():
    o = Oracle(contracts=CONTRACTS, private_key=KEY)
    exc = ContractCustomError(selector("AlreadyVerified(uint256,uint16)") + "00" * 64, data=selector("AlreadyVerified(uint256,uint16)") + "00" * 64)
    assert o._error_name(exc) == "AlreadyVerified"
    assert "AlreadyVerified" in o._describe(exc)


def test_is_registered_maps_project_not_found():
    o = Oracle(contracts=CONTRACTS, private_key=KEY)
    contract = MagicMock()
    o._contract = contract
    contract.functions.getProject.return_value.call.return_value = ("0x0",)
    assert o.is_registered(1) is True
    not_found = selector("ProjectNotFound(uint256)") + "00" * 32
    contract.functions.getProject.return_value.call.side_effect = ContractCustomError(not_found, data=not_found)
    assert o.is_registered(2) is False
    # Hardhat-style: plain ContractLogicError with the revert data nested in a dict.
    contract.functions.getProject.return_value.call.side_effect = ContractLogicError(
        "execution reverted", data={"message": "reverted", "data": not_found}
    )
    assert o.is_registered(3) is False


def _mock_w3(chain_id=80002, status=1):
    w3 = MagicMock()
    w3.eth.chain_id = chain_id
    w3.eth.get_transaction_count.return_value = 7
    w3.eth.get_block.return_value = {"baseFeePerGas": 10**9}
    w3.eth.max_priority_fee = 10**9
    w3.eth.account.from_key.return_value.address = "0xOracle"
    w3.eth.account.from_key.return_value.sign_transaction.return_value.raw_transaction = b"raw"
    w3.eth.send_raw_transaction.return_value = bytes.fromhex("ab" * 32)
    w3.eth.wait_for_transaction_receipt.return_value = {"status": status}
    return w3


def test_send_builds_signs_and_waits():
    w3 = _mock_w3()
    o = Oracle(w3=w3, contracts=CONTRACTS, private_key=KEY)
    o._contract = MagicMock()
    fn = o._contract.functions.submitVerification.return_value
    fn.build_transaction.return_value = {"tx": 1}

    report_hash = "0x" + "11" * 32
    res = o.submit_verification(3, 2026, 9658, report_hash, "http://x/r")
    assert res.ok and res.tx_hash == "0x" + "ab" * 32
    o._contract.functions.submitVerification.assert_called_once_with(3, 2026, 9658, bytes.fromhex("11" * 32), "http://x/r")
    params = fn.build_transaction.call_args.args[0]
    assert params["nonce"] == 7 and params["chainId"] == 80002 and params["from"] == "0xOracle"
    assert params["maxPriorityFeePerGas"] == 35 * 10**9  # fixed Amoy tip, not the inflated estimate
    assert params["maxFeePerGas"] == 2 * 10**9 + 35 * 10**9
    w3.eth.wait_for_transaction_receipt.assert_called_once()


def test_send_reports_reverted_receipt():
    o = Oracle(w3=_mock_w3(status=0), contracts=CONTRACTS, private_key=KEY)
    o._contract = MagicMock()
    res = o.flag_reversal(1, 2026, 5, "0x" + "22" * 32)
    assert res.tx_hash and res.error == "flagReversal transaction reverted"


def test_send_reports_estimation_revert_by_name():
    o = Oracle(w3=_mock_w3(), contracts=CONTRACTS, private_key=KEY)
    o._contract = MagicMock()
    data = selector("AlreadyVerified(uint256,uint16)") + "00" * 64
    o._contract.functions.submitVerification.return_value.build_transaction.side_effect = ContractCustomError(data, data=data)
    res = o.submit_verification(1, 2026, 5, "0x" + "00" * 32, "uri")
    assert res.tx_hash is None and res.error == "submitVerification failed: contract reverted with AlreadyVerified"


# -- integration against a local Hardhat chain ----------------------------------

IT_JSON = os.environ.get("CANOPY_IT_CONTRACTS_JSON")


@pytest.mark.skipif(not IT_JSON, reason="set CANOPY_IT_CONTRACTS_JSON to run against a local hardhat node")
def test_oracle_against_local_chain(monkeypatch):
    from web3 import Web3

    contracts = json.loads(Path(IT_JSON).read_text())
    w3 = Web3(Web3.HTTPProvider(os.environ.get("CANOPY_IT_RPC", "http://127.0.0.1:8545")))
    o = Oracle(w3=w3, contracts=contracts, private_key=KEY)  # deploy.ts grants ORACLE_ROLE to account #1 locally
    owner = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
    pid = int.from_bytes(os.urandom(4), "big")

    assert o.is_registered(pid) is False
    assert o.ensure_registered(pid, owner, "uri").ok
    assert o.ensure_registered(pid, owner, "uri") is None
    rh = "0x" + keccak(b"report").hex()
    assert o.submit_verification(pid, 2026, 1000, rh, "http://r").ok
    again = o.submit_verification(pid, 2026, 1000, rh, "http://r")
    assert again.error and "AlreadyVerified" in again.error
    token = o.contract.functions.tokenIdFor(pid, 2026).call()
    assert o.contract.functions.balanceOf(Web3.to_checksum_address(owner), token).call() == 900
    assert o.flag_reversal(pid, 2026, 5000, rh).ok
    assert o.contract.functions.bufferBalance(token).call() == 0
    assert o.contract.functions.getProject(pid).call()[1] == 2  # Reversed
