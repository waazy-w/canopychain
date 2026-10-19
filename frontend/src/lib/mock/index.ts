import { ApiError } from "../api/errors";
import type {
  MonitorResponse,
  ProjectDetail,
  ProjectSummary,
  RegisterRequest,
  RegisterResponse,
  VerifyResponse,
} from "../api/types";
import { polygonAreaHa } from "../geo";
import { buildReport, initialProjects, summary, TCO2E_PER_HA } from "./data";

// In-memory mock backend. State lives for the browser session (lost on reload).
let projects: ProjectDetail[] | null = null;
const db = () => (projects ??= initialProjects());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MOCK_ONCHAIN_NOTE = "Mock mode: nothing was sent on-chain.";

function find(id: number): ProjectDetail {
  const p = db().find((x) => x.projectId === id);
  if (!p) throw new ApiError(404, `Project ${id} not found`);
  return p;
}

function toSummary(p: ProjectDetail): ProjectSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { reports, ...rest } = p;
  return rest;
}

function currentVintage() {
  return new Date().getUTCFullYear();
}

export async function mockRequest<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const url = new URL(path, "http://mock");
  const parts = url.pathname.split("/").filter(Boolean); // ["api", "projects", "1", "verify"]
  await sleep(method === "GET" ? 150 : 400);

  if (parts[0] !== "api") throw new ApiError(404, "Not found");

  if (parts[1] === "projects" && parts.length === 2) {
    if (method === "GET") return db().map(toSummary) as T;
    const req = body as RegisterRequest;
    if (!req?.name || !req?.owner || req?.polygon?.type !== "Polygon") {
      throw new ApiError(400, "name, owner and a GeoJSON Polygon are required");
    }
    const projectId = Math.max(0, ...db().map((p) => p.projectId)) + 1;
    db().push({
      projectId,
      name: req.name,
      owner: req.owner,
      polygon: req.polygon,
      areaHa: polygonAreaHa(req.polygon),
      createdAt: new Date().toISOString(),
      onChainRegistered: false,
      latestReport: null,
      reports: [],
    });
    return { projectId, txHash: null } satisfies RegisterResponse as T;
  }

  if (parts[1] === "projects" && parts.length >= 3) {
    const p = find(Number(parts[2]));
    if (parts.length === 3 && method === "GET") return structuredClone(p) as T;

    if (parts[3] === "verify" && method === "POST") {
      const vintage = currentVintage();
      if (p.reports.some((r) => r.vintage === vintage && r.status === "verified")) {
        throw new ApiError(409, `Project ${p.projectId} is already verified for vintage ${vintage}`);
      }
      await sleep(3_500); // stands in for the 30–120 s satellite pipeline
      const report = buildReport({
        projectId: p.projectId,
        polygon: p.polygon,
        vintage,
        baselineCoverPct: 0.92,
        lossPctOfArea: 0.002,
        status: "verified",
        createdAt: new Date().toISOString(),
        previews: "generic",
      });
      p.reports.unshift(report);
      p.latestReport = summary(report);
      return { ...report, txHash: null, onChainError: MOCK_ONCHAIN_NOTE } satisfies VerifyResponse as T;
    }

    if (parts[3] === "monitor" && method === "POST") {
      const simulate = url.searchParams.get("simulateDeforestation") === "true";
      const verified = p.reports.find((r) => r.status === "verified");
      if (!verified) throw new ApiError(400, "Run a verification before monitoring");
      await sleep(2_500);
      const report = buildReport({
        projectId: p.projectId,
        polygon: p.polygon,
        vintage: verified.vintage,
        baselineCoverPct: 0.92,
        lossPctOfArea: simulate ? 0.12 : 0.002,
        status: simulate ? "reversal_detected" : "verified",
        createdAt: new Date().toISOString(),
        previews: simulate ? "generic-reversal" : "generic",
      });
      const lostCredits = simulate ? Math.round(report.deforestedHa * TCO2E_PER_HA) : 0;
      report.lostCredits = lostCredits;
      if (simulate) report.creditsEstimated = 0;
      p.reports.unshift(report);
      p.latestReport = summary(report);
      return {
        ...report,
        txHash: null,
        onChainError: MOCK_ONCHAIN_NOTE,
        lostCredits,
      } satisfies MonitorResponse as T;
    }
  }

  if (parts[1] === "reports" && parts[2] && method === "GET") {
    for (const p of db()) {
      const r = p.reports.find((x) => x.reportId === parts[2]);
      if (r) return structuredClone(r) as T;
    }
    throw new ApiError(404, `Report ${parts[2]} not found`);
  }

  throw new ApiError(404, "Not found");
}
