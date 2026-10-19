"""JSON file storage under data/: projects.json plus one JSON file and two PNGs per report."""

import json
import os
import threading
from pathlib import Path
from typing import Any

from . import config

_lock = threading.RLock()


def _projects_file() -> Path:
    return config.data_dir() / "projects.json"


def _reports_dir() -> Path:
    return config.data_dir() / "reports"


def _write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


def _load_projects() -> list[dict]:
    f = _projects_file()
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


def list_projects() -> list[dict]:
    with _lock:
        return _load_projects()


def get_project(project_id: int) -> dict | None:
    with _lock:
        return next((p for p in _load_projects() if p["projectId"] == project_id), None)


def create_project(fields: dict) -> dict:
    with _lock:
        projects = _load_projects()
        project = {"projectId": max((p["projectId"] for p in projects), default=0) + 1, **fields}
        projects.append(project)
        _write_json(_projects_file(), projects)
        return project


def update_project(project_id: int, **changes: Any) -> dict:
    with _lock:
        projects = _load_projects()
        for p in projects:
            if p["projectId"] == project_id:
                p.update(changes)
                _write_json(_projects_file(), projects)
                return p
        raise KeyError(project_id)


def save_report(report: dict, baseline_png: bytes, current_png: bytes) -> None:
    with _lock:
        rid = report["reportId"]
        _write_json(_reports_dir() / f"{rid}.json", report)
        d = _reports_dir() / rid
        d.mkdir(parents=True, exist_ok=True)
        (d / "baseline.png").write_bytes(baseline_png)
        (d / "current.png").write_bytes(current_png)


def update_report(report: dict) -> None:
    with _lock:
        _write_json(_reports_dir() / f"{report['reportId']}.json", report)


def get_report(report_id: str) -> dict | None:
    f = _reports_dir() / f"{report_id}.json"
    if not _safe_id(report_id) or not f.exists():
        return None
    return json.loads(f.read_text(encoding="utf-8"))


def report_png_path(report_id: str, which: str) -> Path | None:
    if not _safe_id(report_id) or which not in ("baseline", "current"):
        return None
    p = _reports_dir() / report_id / f"{which}.png"
    return p if p.exists() else None


def reports_for_project(project_id: int) -> list[dict]:
    """Full reports for a project, newest first."""
    d = _reports_dir()
    if not d.exists():
        return []
    reports = []
    for f in d.glob("*.json"):
        r = json.loads(f.read_text(encoding="utf-8"))
        if r.get("projectId") == project_id:
            reports.append(r)
    return sorted(reports, key=lambda r: (r["createdAt"], r["reportId"]), reverse=True)


def _safe_id(report_id: str) -> bool:
    return report_id.startswith("rep_") and all(c.isalnum() or c in "_-" for c in report_id)


# -- seed snapshot ---------------------------------------------------------------
# Free hosts (e.g. Render's free tier) wipe the disk on every restart. The backend can start from a
# committed snapshot of projects and reports (CANOPY_SEED_DIR), so on-chain report URIs keep resolving.

_SNAPSHOT_ITEMS = ("projects.json", "reports")


def restore_seed(seed_dir: Path) -> bool:
    """Copies the snapshot into an empty data dir. Never overwrites existing data. Returns True if it copied."""
    import shutil

    with _lock:
        if _projects_file().exists() or not (seed_dir / "projects.json").exists():
            return False
        for item in _SNAPSHOT_ITEMS:
            src = seed_dir / item
            if src.is_dir():
                shutil.copytree(src, config.data_dir() / item, dirs_exist_ok=True)
            elif src.exists():
                config.data_dir().mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, config.data_dir() / item)
        return True


def write_snapshot(seed_dir: Path) -> None:
    """Replaces seed_dir with the current projects and reports (caches are left out)."""
    import shutil

    with _lock:
        shutil.rmtree(seed_dir, ignore_errors=True)
        seed_dir.mkdir(parents=True)
        for item in _SNAPSHOT_ITEMS:
            src = config.data_dir() / item
            if src.is_dir():
                shutil.copytree(src, seed_dir / item)
            elif src.exists():
                shutil.copy2(src, seed_dir / item)
