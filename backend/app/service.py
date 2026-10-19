"""Project registration, verification and monitoring: satellite analysis → report → oracle."""

import secrets
from datetime import date, datetime, timezone

from shapely.geometry import shape
from web3 import Web3

from . import analysis, config, storage
from .geo import area_ha, parse_polygon, to_geojson
from .methodology import (
    DEFAULT_REGIONAL_LOSS_RATE_PCT,
    DEFAULT_TCO2E_PER_HA,
    METHODOLOGY,
    avoided_loss_ha,
    credits_for,
    lost_credits,
    report_hash,
)
from .oracle import get_oracle

IMAGERY_SOURCE = "sentinel-2-l2a (Microsoft Planetary Computer)"


class NotFound(Exception):
    pass


class BadRequest(Exception):
    pass


class Conflict(Exception):
    pass


def today() -> date:
    return datetime.now(timezone.utc).date()


def target_dates() -> tuple[date, date]:
    """(baseline, current) target dates. Current is the first day of this month, baseline one year earlier.
    Snapping to the month keeps cache keys stable, so the demo cache stays valid all month."""
    current = today().replace(day=1)
    return current.replace(year=current.year - 1), current


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _metadata_uri(project_id: int) -> str:
    return f"{config.public_base_url()}/api/projects/{project_id}"


def _report_uri(report_id: str) -> str:
    return f"{config.public_base_url()}/api/reports/{report_id}"


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


def create_project(name: str, owner: str, polygon: dict) -> dict:
    name = (name or "").strip()
    if not name:
        raise BadRequest("name is required")
    if not Web3.is_address(owner or ""):
        raise BadRequest("owner must be a wallet address (0x…)")
    try:
        poly = parse_polygon(polygon)
    except ValueError as exc:
        raise BadRequest(str(exc)) from exc

    project = storage.create_project(
        {
            "name": name,
            "owner": Web3.to_checksum_address(owner),
            "polygon": to_geojson(poly),
            "areaHa": round(area_ha(poly), 2),
            "createdAt": _now_iso(),
            "status": "active",
            "onChainRegistered": False,
            "registerTxHash": None,
        }
    )
    pid = project["projectId"]
    res = get_oracle().register_project(pid, project["owner"], _metadata_uri(pid))
    if res.ok:
        project = storage.update_project(pid, onChainRegistered=True, registerTxHash=res.tx_hash)
    return {"projectId": pid, "txHash": res.tx_hash, "onChainError": res.error}


def _summary(report: dict | None) -> dict | None:
    if not report:
        return None
    return {k: report.get(k) for k in ("reportId", "kind", "status", "creditsEstimated", "vintage", "txHash", "createdAt")}


def project_view(project: dict, reports: list[dict] | None = None) -> dict:
    reports = storage.reports_for_project(project["projectId"]) if reports is None else reports
    return {**project, "latestReport": _summary(reports[0] if reports else None)}


def list_projects() -> list[dict]:
    return [project_view(p) for p in storage.list_projects()]


def get_project(project_id: int) -> dict:
    project = storage.get_project(project_id)
    if not project:
        raise NotFound(f"project {project_id} not found")
    reports = storage.reports_for_project(project_id)
    return {**project_view(project, reports), "reports": reports}


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


def _build_report(
    project: dict, a: analysis.Analysis, kind: str, vintage: int, loss_rate_pct: float, tco2e_per_ha: float
) -> dict:
    rid = f"rep_{today().isoformat()}_{secrets.token_hex(3)}"
    avoided = round(avoided_loss_ha(a.baseline.forestCoverHa, loss_rate_pct, a.deforestedHa), 2)

    def date_obj(s: analysis.DateStats) -> dict:
        return {
            "date": s.date,
            "targetDate": s.targetDate,
            "forestCoverHa": s.forestCoverHa,
            "meanNdvi": s.meanNdvi,
            "validCoveragePct": s.validCoveragePct,
        }

    return {
        "reportId": rid,
        "kind": kind,
        "projectId": project["projectId"],
        "polygon": project["polygon"],
        "areaHa": project["areaHa"],
        "vintage": vintage,
        "baseline": date_obj(a.baseline),
        "current": date_obj(a.current),
        "deforestedHa": a.deforestedHa,
        "regionalBaselineLossRatePct": loss_rate_pct,
        "avoidedLossHa": avoided,
        "tco2ePerHa": tco2e_per_ha,
        "creditsEstimated": credits_for(avoided, tco2e_per_ha),
        "methodology": METHODOLOGY,
        "imagery": {
            "source": IMAGERY_SOURCE,
            "baselineSceneIds": a.baseline.sceneIds,
            "currentSceneIds": a.current.sceneIds,
            "previewBaselineUrl": f"/api/reports/{rid}/baseline.png",
            "previewCurrentUrl": f"/api/reports/{rid}/current.png",
            "previewBounds": a.previewBounds,
            "pixelSizeM": a.pixelSizeM,
            "simulatedDeforestation": a.simulated,
        },
        "status": "verified",
        "createdAt": _now_iso(),
    }


def _load_project(project_id: int) -> tuple[dict, object]:
    project = storage.get_project(project_id)
    if not project:
        raise NotFound(f"project {project_id} not found")
    return project, shape(project["polygon"])


def verify(project_id: int, loss_rate_pct: float | None = None, tco2e_per_ha: float | None = None) -> dict:
    project, poly = _load_project(project_id)
    baseline_t, current_t = target_dates()
    vintage = current_t.year
    oracle = get_oracle()

    previous = [
        r
        for r in storage.reports_for_project(project_id)
        if r["kind"] == "verification" and r["vintage"] == vintage and r["status"] == "verified"
    ]
    # A vintage is verified once. An earlier off-chain-only verification can be redone once the oracle is live.
    if any(r.get("txHash") for r in previous) or (previous and not oracle.enabled):
        raise Conflict(f"project {project_id} vintage {vintage} is already verified")

    a, baseline_png, current_png = analysis.analyze(poly, baseline_t, current_t, simulate=False)
    report = _build_report(
        project,
        a,
        "verification",
        vintage,
        DEFAULT_REGIONAL_LOSS_RATE_PCT if loss_rate_pct is None else loss_rate_pct,
        DEFAULT_TCO2E_PER_HA if tco2e_per_ha is None else tco2e_per_ha,
    )
    report["reportHash"] = report_hash(report)
    report["txHash"], report["onChainError"] = None, None
    storage.save_report(report, baseline_png, current_png)

    if report["creditsEstimated"] == 0:
        report["onChainError"] = "0 credits estimated: nothing to mint"
    else:
        reg = oracle.ensure_registered(project_id, project["owner"], _metadata_uri(project_id))
        if reg is not None and not reg.ok:
            report["onChainError"] = reg.error
        else:
            if reg is not None or not project.get("onChainRegistered"):
                storage.update_project(
                    project_id, onChainRegistered=True, registerTxHash=reg.tx_hash if reg else project.get("registerTxHash")
                )
            res = oracle.submit_verification(
                project_id, vintage, report["creditsEstimated"], report["reportHash"], _report_uri(report["reportId"])
            )
            report["txHash"], report["onChainError"] = res.tx_hash, res.error
    storage.update_report(report)
    return report


def monitor(project_id: int, simulate_deforestation: bool = False) -> dict:
    project, poly = _load_project(project_id)
    verified = [
        r
        for r in storage.reports_for_project(project_id)
        if r["kind"] == "verification" and r["status"] == "verified"
    ]
    if not verified:
        raise BadRequest(f"project {project_id} has no verification yet; run /verify first")
    # Prefer the latest vintage that was actually minted on-chain.
    ref = next((r for r in verified if r.get("txHash")), verified[0])

    baseline_t, current_t = target_dates()
    a, baseline_png, current_png = analysis.analyze(poly, baseline_t, current_t, simulate=simulate_deforestation)
    report = _build_report(
        project, a, "monitoring", ref["vintage"], ref["regionalBaselineLossRatePct"], ref["tco2ePerHa"]
    )
    newly = round(max(0.0, a.deforestedHa - ref["deforestedHa"]), 2)
    lost = lost_credits(newly, ref["tco2ePerHa"])
    report["newlyDeforestedHa"] = newly
    report["reversalOfReportId"] = ref["reportId"]
    report["status"] = "reversal_detected" if lost > 0 else "verified"
    report["reportHash"] = report_hash(report)
    report["txHash"], report["onChainError"], report["lostCredits"] = None, None, lost
    storage.save_report(report, baseline_png, current_png)

    if lost > 0:
        storage.update_project(project_id, status="reversed")
        oracle = get_oracle()
        if oracle.enabled and not ref.get("txHash"):
            report["onChainError"] = f"vintage {ref['vintage']} was never minted on-chain, so there is nothing to reverse"
        else:
            res = oracle.flag_reversal(project_id, ref["vintage"], lost, report["reportHash"])
            report["txHash"], report["onChainError"] = res.tx_hash, res.error
        storage.update_report(report)
    return report
