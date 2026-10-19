import json

from app import storage


def test_snapshot_round_trip_restores_only_into_empty_storage(data_dir, tmp_path, monkeypatch):
    storage.create_project({"name": "Seeded forest"})
    storage.save_report({"reportId": "rep_1", "projectId": 1, "createdAt": "2026-10-19T00:00:00Z"}, b"png", b"png")
    seed = tmp_path / "seed"
    storage.write_snapshot(seed)
    assert (seed / "projects.json").exists() and (seed / "reports").is_dir()

    fresh = tmp_path / "fresh"
    monkeypatch.setenv("CANOPY_DATA_DIR", str(fresh))
    assert storage.restore_seed(seed) is True
    assert [p["name"] for p in storage.list_projects()] == ["Seeded forest"]
    assert storage.get_report("rep_1")["projectId"] == 1

    # Existing data is never overwritten.
    storage.create_project({"name": "Created after restore"})
    assert storage.restore_seed(seed) is False
    names = [p["name"] for p in json.loads((fresh / "projects.json").read_text(encoding="utf-8"))]
    assert names == ["Seeded forest", "Created after restore"]
