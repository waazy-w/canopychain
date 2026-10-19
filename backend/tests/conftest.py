from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import analysis, service
from app.oracle import TxResult

OWNER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
POLYGON = {
    "type": "Polygon",
    "coordinates": [
        [
            [-60.614487, -7.21447],
            [-60.585513, -7.21447],
            [-60.585513, -7.18553],
            [-60.614487, -7.18553],
            [-60.614487, -7.21447],
        ]
    ],
}
PNG = b"\x89PNG fake"


def make_analysis(deforested: float = 3.3, simulated: bool = False) -> analysis.Analysis:
    return analysis.Analysis(
        baseline=analysis.DateStats("2025-10-11", "2025-10-01", 1000.0, 0.85, 100.0, ["S2_BASE"]),
        current=analysis.DateStats("2026-10-02", "2026-10-01", 1000.0 - deforested, 0.84, 99.5, ["S2_CUR"]),
        deforestedHa=deforested,
        pixelSizeM=10.0,
        previewBounds=[[-7.21, -60.61], [-7.18, -60.58]],
        simulated=simulated,
    )


class FakeOracle:
    """Records calls; behaves like an enabled oracle unless `disabled` is set."""

    def __init__(self, disabled: str | None = None):
        self.disabled = disabled
        self.calls: list[tuple] = []
        self.registered: set[int] = set()
        self._n = 0

    @property
    def enabled(self):
        return self.disabled is None

    def disabled_reason(self):
        return self.disabled

    def _tx(self, *call) -> TxResult:
        self.calls.append(call)
        if self.disabled:
            return TxResult(error=f"oracle disabled: {self.disabled}")
        self._n += 1
        return TxResult(tx_hash="0x" + f"{self._n:064x}")

    def register_project(self, pid, owner, uri):
        res = self._tx("registerProject", pid, owner, uri)
        if res.ok:
            self.registered.add(pid)
        return res

    def ensure_registered(self, pid, owner, uri):
        if self.disabled:
            return TxResult(error=f"oracle disabled: {self.disabled}")
        return None if pid in self.registered else self.register_project(pid, owner, uri)

    def submit_verification(self, pid, vintage, credits, report_hash, uri):
        return self._tx("submitVerification", pid, vintage, credits, report_hash, uri)

    def flag_reversal(self, pid, vintage, lost, report_hash):
        return self._tx("flagReversal", pid, vintage, lost, report_hash)


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("CANOPY_DATA_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture
def oracle(monkeypatch):
    fake = FakeOracle()
    monkeypatch.setattr(service, "get_oracle", lambda: fake)
    monkeypatch.setattr("app.main.get_oracle", lambda: fake)
    return fake


@pytest.fixture
def fake_satellite(monkeypatch):
    """Replaces the satellite analysis. Set `.deforested` / `.simulated_deforested` to control results."""

    class Ctl:
        deforested = 3.3
        simulated_deforested = 153.3
        calls: list = []

    def fake_analyze(poly, baseline_t, current_t, simulate=False):
        Ctl.calls.append((baseline_t, current_t, simulate))
        d = Ctl.simulated_deforested if simulate else Ctl.deforested
        return make_analysis(d, simulate), PNG, PNG

    monkeypatch.setattr(service.analysis, "analyze", fake_analyze)
    monkeypatch.setattr(service, "today", lambda: date(2026, 10, 19))
    return Ctl


@pytest.fixture
def client(data_dir, oracle, fake_satellite):
    from app.main import app

    return TestClient(app)
