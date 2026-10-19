"""CanopyChain verification API. Run: uvicorn app.main:app --reload (from backend/)."""

import logging
from typing import Any

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from . import config, service, storage
from .oracle import get_oracle
from .satellite import SatelliteError

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("canopychain")

app = FastAPI(title="CanopyChain API", version="0.3")
app.add_middleware(
    CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"]
)


class ProjectIn(BaseModel):
    name: str = Field(max_length=120)
    owner: str
    polygon: dict[str, Any]


class VerifyOptions(BaseModel):
    regionalBaselineLossRatePct: float | None = Field(default=None, ge=0, le=100)
    tco2ePerHa: float | None = Field(default=None, gt=0, le=2000)


def _error(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": message})


@app.exception_handler(HTTPException)
async def _http_error(_: Request, exc: HTTPException):
    return _error(exc.status_code, str(exc.detail))


@app.exception_handler(RequestValidationError)
async def _validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    where = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    return _error(400, f"{where}: {first.get('msg', 'invalid request')}" if where else "invalid request body")


@app.exception_handler(service.NotFound)
async def _not_found(_: Request, exc: service.NotFound):
    return _error(404, str(exc))


@app.exception_handler(service.BadRequest)
async def _bad_request(_: Request, exc: service.BadRequest):
    return _error(400, str(exc))


@app.exception_handler(service.Conflict)
async def _conflict(_: Request, exc: service.Conflict):
    return _error(409, str(exc))


@app.exception_handler(SatelliteError)
async def _satellite_error(_: Request, exc: SatelliteError):
    return _error(500, f"satellite analysis failed: {exc}")


@app.exception_handler(Exception)
async def _unexpected(_: Request, exc: Exception):
    log.exception("unhandled error")
    return _error(500, f"internal error: {exc.__class__.__name__}")


@app.get("/api/health")
def health():
    oracle = get_oracle()
    return {"ok": True, "oracleEnabled": oracle.enabled, "oracleDisabledReason": oracle.disabled_reason()}


@app.post("/api/projects")
def create_project(body: ProjectIn):
    return service.create_project(body.name, body.owner, body.polygon)


@app.get("/api/projects")
def list_projects():
    return service.list_projects()


@app.get("/api/projects/{project_id}")
def get_project(project_id: int):
    return service.get_project(project_id)


@app.post("/api/projects/{project_id}/verify")
def verify(project_id: int, options: VerifyOptions | None = Body(default=None)):
    options = options or VerifyOptions()
    return service.verify(project_id, options.regionalBaselineLossRatePct, options.tco2ePerHa)


@app.post("/api/projects/{project_id}/monitor")
def monitor(project_id: int, simulateDeforestation: bool = False):
    return service.monitor(project_id, simulateDeforestation)


@app.get("/api/reports/{report_id}")
def get_report(report_id: str):
    report = storage.get_report(report_id)
    if not report:
        raise HTTPException(404, f"report {report_id} not found")
    return report


@app.get("/api/reports/{report_id}/{which}.png")
def get_preview(report_id: str, which: str):
    path = storage.report_png_path(report_id, which)
    if not path:
        raise HTTPException(404, f"preview {which}.png for {report_id} not found")
    return FileResponse(path, media_type="image/png")
