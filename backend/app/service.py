"""Project registration, verification and monitoring: satellite analysis → report → oracle."""

import secrets
import threading
import time
from datetime import date, datetime, timezone

from shapely.geometry import shape
from web3 import Web3

from . import analysis, auth, config, storage
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


class Forbidden(Exception):
    pass


class TooManyRequests(Exception):
    pass


# Share of the smaller polygon two projects may overlap before the second is rejected (allows shared edges
# and digitising slop, not double-claimed forest).
MAX_OVERLAP_FRACTION = 0.01
MONITOR_COOLDOWN_S = 30
# Statuses after review. "pending" projects stay off-chain until an approver signs off.
APPROVED_STATUSES = ("active", "reversed")


def today() -> date:
    return datetime.now(timezone.utc).date()


def target_dates() -> tuple[date, date]:
    """(baseline, current) target dates. Current is the first day of this month, baseline one year earlier.
    Snapping to the month keeps cache keys stable, so the demo cache stays valid all month."""
    current = today().replace(day=1)
    return current.replace(year=current.year - 1), current


def _now_iso() -> str:
    # Millisecond precision: reports are ordered by createdAt, and a cached verify followed by a
    # monitor can land in the same second.
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _metadata_uri(project_id: int) -> str:
    return f"{config.public_base_url()}/api/projects/{project_id}"


def _report_uri(report_id: str) -> str:
    return f"{config.public_base_url()}/api/reports/{report_id}"


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


def _check_overlap(poly) -> None:
    """One piece of forest, one project: refuse boundaries that overlap a project that wasn't rejected."""
    for other in storage.list_projects():
        if other.get("status") == "rejected":
            continue
        other_poly = shape(other["polygon"])
        if not poly.intersects(other_poly):
            continue
        shared = poly.intersection(other_poly).area / min(poly.area, other_poly.area)
        if shared > MAX_OVERLAP_FRACTION:
            raise Conflict(
                f"this boundary overlaps project #{other['projectId']} ({other['name']}) by {shared:.0%}; "
                "a forest can only be registered once"
            )


def create_project(name: str, owner: str, polygon: dict, issued_at: str, signature: str) -> dict:
    """Registers a project as "pending". The owner wallet must sign the registration; nothing goes
    on-chain until an approver reviews it (review_project)."""
    name = (name or "").strip()
    if not name:
        raise BadRequest("name is required")
    if not Web3.is_address(owner or ""):
        raise BadRequest("owner must be a wallet address (0x…)")
    try:
        poly = parse_polygon(polygon)
    except ValueError as exc:
        raise BadRequest(str(exc)) from exc
    try:
        auth.check_fresh(issued_at)
        auth.require_signer(auth.registration_message(name, owner, polygon, issued_at), signature, owner)
    except auth.SignatureError as exc:
        raise Forbidden(str(exc)) from exc
    return _store_pending(name, owner, polygon, poly, signature)


def seed_project(name: str, owner: str, polygon: dict) -> dict:
    """Operator-side registration for the demo seed script (no wallet signature). Still pending review."""
    try:
        poly = parse_polygon(polygon)
    except ValueError as exc:
        raise BadRequest(str(exc)) from exc
    return _store_pending(name, owner, polygon, poly, None)


def _store_pending(name: str, owner: str, polygon: dict, poly, signature: str | None) -> dict:
    _check_overlap(poly)
    project = storage.create_project(
        {
            "name": name,
            "owner": Web3.to_checksum_address(owner),
            "polygon": to_geojson(poly),
            "areaHa": round(area_ha(poly), 2),
            "boundaryHash": auth.boundary_hash(polygon),
            "ownerSignature": signature,
            "createdAt": _now_iso(),
            "status": "pending",
            "review": None,
            "onChainRegistered": False,
            "registerTxHash": None,
        }
    )
    return {"projectId": project["projectId"], "status": "pending", "txHash": None, "onChainError": None}


def review_project(
    project_id: int,
    decision: str,
    loss_rate_pct: float,
    tco2e_per_ha: float,
    note: str,
    issued_at: str,
    signature: str,
) -> dict:
    """An approver (the contract admin) approves or rejects a pending project and fixes its methodology
    parameters. Approval registers the project on-chain; only approved projects can be verified."""
    project, _ = _load_project(project_id)
    if project.get("status") != "pending":
        raise Conflict(f"project {project_id} was already reviewed ({project.get('status')})")
    if decision not in ("approve", "reject"):
        raise BadRequest('decision must be "approve" or "reject"')
    loss_rate_pct, tco2e_per_ha, note = round(loss_rate_pct, 2), round(tco2e_per_ha, 2), (note or "").strip()
    try:
        auth.check_fresh(issued_at)
        reviewer = auth.recover_signer(
            auth.review_message(project_id, decision, loss_rate_pct, tco2e_per_ha, note, issued_at), signature
        )
    except auth.SignatureError as exc:
        raise Forbidden(str(exc)) from exc
    if not auth.is_approver(reviewer):
        raise Forbidden(f"{reviewer} is not an approver (the CanopyCredits admin)")

    review = {
        "decision": decision,
        "reviewer": reviewer,
        "reviewedAt": _now_iso(),
        "regionalBaselineLossRatePct": loss_rate_pct,
        "tco2ePerHa": tco2e_per_ha,
        "note": note,
        "signature": signature,
    }
    if decision == "reject":
        storage.update_project(project_id, status="rejected", review=review)
        return {"projectId": project_id, "status": "rejected", "txHash": None, "onChainError": None}

    storage.update_project(project_id, status="active", review=review)
    res = get_oracle().register_project(project_id, project["owner"], _metadata_uri(project_id))
    if res.ok:
        storage.update_project(project_id, onChainRegistered=True, registerTxHash=res.tx_hash)
    return {"projectId": project_id, "status": "active", "txHash": res.tx_hash, "onChainError": res.error}


def _require_approved(project: dict) -> None:
    status = project.get("status", "active")
    if status == "pending":
        raise Forbidden(f"project {project['projectId']} is pending review: an approver must approve it first")
    if status not in APPROVED_STATUSES:
        raise Forbidden(f"project {project['projectId']} was {status} and can't be verified or monitored")


def _methodology_params(project: dict) -> tuple[float, float]:
    """Parameters the approver fixed at review; projects approved before reviews existed use the defaults."""
    review = project.get("review") or {}
    return (
        review.get("regionalBaselineLossRatePct", DEFAULT_REGIONAL_LOSS_RATE_PCT),
        review.get("tco2ePerHa", DEFAULT_TCO2E_PER_HA),
    )


_last_monitor: dict[int, float] = {}
_monitor_lock = threading.Lock()


def _monitor_cooldown(project_id: int) -> None:
    """Re-checks can send an on-chain transaction, so each project gets one every MONITOR_COOLDOWN_S."""
    with _monitor_lock:
        now = time.monotonic()
        last = _last_monitor.get(project_id)
        if last is not None and now - last < MONITOR_COOLDOWN_S:
            raise TooManyRequests(
                f"project {project_id} was re-checked moments ago; try again in {MONITOR_COOLDOWN_S - (now - last):.0f} s"
            )
        _last_monitor[project_id] = now


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


def verify(project_id: int) -> dict:
    project, poly = _load_project(project_id)
    _require_approved(project)
    loss_rate_pct, tco2e_per_ha = _methodology_params(project)
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
    report = _build_report(project, a, "verification", vintage, loss_rate_pct, tco2e_per_ha)
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
    _require_approved(project)
    if simulate_deforestation and not config.demo_controls_enabled():
        raise Forbidden("demo controls are switched off on this server (CANOPY_DEMO_CONTROLS=0)")
    verified = [
        r
        for r in storage.reports_for_project(project_id)
        if r["kind"] == "verification" and r["status"] == "verified"
    ]
    if not verified:
        raise BadRequest(f"project {project_id} has no verification yet; run /verify first")
    _monitor_cooldown(project_id)
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
