from app.methodology import METHODOLOGY, report_hash
from tests.conftest import OWNER, PNG, POLYGON


def register(client, name="Test Forest"):
    res = client.post("/api/projects", json={"name": name, "owner": OWNER, "polygon": POLYGON})
    assert res.status_code == 200, res.text
    return res.json()


# -- projects -----------------------------------------------------------------


def test_register_project_calls_oracle(client, oracle):
    body = register(client)
    assert body["projectId"] == 1
    assert body["txHash"].startswith("0x")
    assert oracle.calls == [("registerProject", 1, OWNER, "http://localhost:8000/api/projects/1")]
    assert register(client, "Second")["projectId"] == 2


def test_list_and_get_projects(client):
    register(client)
    projects = client.get("/api/projects").json()
    assert len(projects) == 1
    p = projects[0]
    assert p["projectId"] == 1 and p["owner"] == OWNER and p["onChainRegistered"] is True
    assert 1000 < p["areaHa"] < 1050 and p["latestReport"] is None
    assert p["polygon"]["type"] == "Polygon"

    detail = client.get("/api/projects/1").json()
    assert detail["reports"] == [] and detail["name"] == "Test Forest"


def test_get_unknown_project_is_404(client):
    res = client.get("/api/projects/99")
    assert res.status_code == 404
    assert res.json() == {"error": "project 99 not found"}


def test_register_validation_errors_are_400(client):
    bad_owner = client.post("/api/projects", json={"name": "x", "owner": "nope", "polygon": POLYGON})
    assert bad_owner.status_code == 400 and "owner" in bad_owner.json()["error"]

    bad_poly = client.post("/api/projects", json={"name": "x", "owner": OWNER, "polygon": {"type": "Point"}})
    assert bad_poly.status_code == 400 and "Polygon" in bad_poly.json()["error"]

    missing = client.post("/api/projects", json={"name": "x"})
    assert missing.status_code == 400 and "error" in missing.json()


def test_register_with_oracle_disabled_still_works(client, oracle):
    oracle.disabled = "no contract address"
    body = register(client)
    assert body["txHash"] is None and body["onChainError"].startswith("oracle disabled")
    assert client.get("/api/projects/1").json()["onChainRegistered"] is False


def test_cors_allows_frontend(client):
    res = client.get("/api/projects", headers={"Origin": "http://localhost:3000"})
    assert res.headers["access-control-allow-origin"] == "http://localhost:3000"


# -- verify -------------------------------------------------------------------


def test_verify_builds_report_and_mints(client, oracle, fake_satellite):
    register(client)
    res = client.post("/api/projects/1/verify")
    assert res.status_code == 200, res.text
    r = res.json()

    assert r["reportId"].startswith("rep_2026-10-19_")
    assert r["kind"] == "verification" and r["status"] == "verified"
    assert r["vintage"] == 2026 and r["projectId"] == 1
    assert r["methodology"] == METHODOLOGY
    assert r["baseline"]["forestCoverHa"] == 1000.0 and r["deforestedHa"] == 3.3
    # 1000 ha × 2.1% − 3.3 ha = 17.7 ha avoided × 450
    assert r["avoidedLossHa"] == 17.7 and r["creditsEstimated"] == 7965
    assert r["imagery"]["previewBaselineUrl"] == f"/api/reports/{r['reportId']}/baseline.png"
    assert r["reportHash"] == report_hash(r)
    assert r["txHash"].startswith("0x") and r["onChainError"] is None

    assert fake_satellite.calls[-1][0].isoformat() == "2025-10-01"
    assert fake_satellite.calls[-1][1].isoformat() == "2026-10-01"
    submit = oracle.calls[-1]
    assert submit[:4] == ("submitVerification", 1, 2026, 7965)
    assert submit[4] == r["reportHash"]
    assert submit[5] == f"http://localhost:8000/api/reports/{r['reportId']}"

    # Report is retrievable, with previews, and shows up on the project.
    assert client.get(f"/api/reports/{r['reportId']}").json() == r
    png = client.get(r["imagery"]["previewCurrentUrl"])
    assert png.status_code == 200 and png.content == PNG and png.headers["content-type"] == "image/png"
    project = client.get("/api/projects/1").json()
    assert project["latestReport"]["reportId"] == r["reportId"]
    assert project["latestReport"]["txHash"] == r["txHash"]
    assert [x["reportId"] for x in project["reports"]] == [r["reportId"]]


def test_verify_options_override_methodology_inputs(client):
    register(client)
    r = client.post("/api/projects/1/verify", json={"regionalBaselineLossRatePct": 1.0, "tco2ePerHa": 300}).json()
    assert r["regionalBaselineLossRatePct"] == 1.0 and r["tco2ePerHa"] == 300
    assert r["creditsEstimated"] == round((10 - 3.3) * 300)


def test_verify_twice_is_409(client):
    register(client)
    assert client.post("/api/projects/1/verify").status_code == 200
    res = client.post("/api/projects/1/verify")
    assert res.status_code == 409
    assert res.json() == {"error": "project 1 vintage 2026 is already verified"}


def test_verify_registers_on_chain_if_needed(client, oracle):
    oracle.disabled = "no key"
    register(client)
    oracle.disabled = None
    r = client.post("/api/projects/1/verify").json()
    assert [c[0] for c in oracle.calls] == ["registerProject", "registerProject", "submitVerification"]
    assert r["txHash"] and client.get("/api/projects/1").json()["onChainRegistered"] is True


def test_verify_off_chain_then_again_once_oracle_is_live(client, oracle):
    oracle.disabled = "no contract address"
    register(client)
    first = client.post("/api/projects/1/verify").json()
    assert first["txHash"] is None and first["onChainError"].startswith("oracle disabled")
    assert client.post("/api/projects/1/verify").status_code == 409  # still disabled

    oracle.disabled = None
    second = client.post("/api/projects/1/verify")
    assert second.status_code == 200 and second.json()["txHash"]


def test_verify_zero_credits_does_not_mint(client, oracle, fake_satellite):
    fake_satellite.deforested = 50.0
    register(client)
    r = client.post("/api/projects/1/verify").json()
    assert r["status"] == "verified" and r["creditsEstimated"] == 0
    assert r["txHash"] is None and "nothing to mint" in r["onChainError"]
    assert not any(c[0] == "submitVerification" for c in oracle.calls)


def test_verify_unknown_project_is_404(client):
    assert client.post("/api/projects/5/verify").status_code == 404


def test_satellite_failure_is_500(client, monkeypatch):
    from app import service
    from app.satellite import SatelliteError

    def boom(*a, **k):
        raise SatelliteError("Planetary Computer unreachable")

    monkeypatch.setattr(service.analysis, "analyze", boom)
    register(client)
    res = client.post("/api/projects/1/verify")
    assert res.status_code == 500
    assert res.json() == {"error": "satellite analysis failed: Planetary Computer unreachable"}


# -- monitor ------------------------------------------------------------------


def test_monitor_requires_verification(client):
    register(client)
    res = client.post("/api/projects/1/monitor")
    assert res.status_code == 400 and "verify" in res.json()["error"]


def test_monitor_without_change_is_verified(client, oracle):
    register(client)
    client.post("/api/projects/1/verify")
    r = client.post("/api/projects/1/monitor").json()
    assert r["kind"] == "monitoring" and r["status"] == "verified"
    assert r["lostCredits"] == 0 and r["txHash"] is None
    assert not any(c[0] == "flagReversal" for c in oracle.calls)


def test_monitor_simulated_deforestation_flags_reversal(client, oracle, fake_satellite):
    register(client)
    verified = client.post("/api/projects/1/verify").json()
    res = client.post("/api/projects/1/monitor?simulateDeforestation=true")
    assert res.status_code == 200, res.text
    r = res.json()

    assert fake_satellite.calls[-1][2] is True
    assert r["status"] == "reversal_detected" and r["imagery"]["simulatedDeforestation"] is True
    assert r["newlyDeforestedHa"] == 150.0  # 153.3 − 3.3 already counted at verification
    assert r["lostCredits"] == 67500
    assert r["vintage"] == 2026 and r["reversalOfReportId"] == verified["reportId"]
    assert r["reportHash"] == report_hash(r)
    assert oracle.calls[-1] == ("flagReversal", 1, 2026, 67500, r["reportHash"])
    assert r["txHash"].startswith("0x")

    project = client.get("/api/projects/1").json()
    assert project["status"] == "reversed"
    assert project["latestReport"]["status"] == "reversal_detected"
    assert len(project["reports"]) == 2


def test_monitor_reversal_with_off_chain_vintage_reports_error(client, oracle):
    oracle.disabled = "no key"
    register(client)
    client.post("/api/projects/1/verify")
    oracle.disabled = None
    r = client.post("/api/projects/1/monitor?simulateDeforestation=true").json()
    assert r["status"] == "reversal_detected" and r["txHash"] is None
    assert "never minted on-chain" in r["onChainError"]


# -- reports ------------------------------------------------------------------


def test_unknown_report_and_preview_are_404(client):
    assert client.get("/api/reports/rep_nope").status_code == 404
    assert client.get("/api/reports/rep_nope/baseline.png").status_code == 404
    assert client.get("/api/reports/..%2Fprojects/baseline.png").status_code == 404
