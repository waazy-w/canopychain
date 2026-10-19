import { API_URL } from "../config";
import { mockRequest } from "../mock";
import { ApiError } from "./errors";
import { isMockMode, setMockMode, shouldReprobe } from "./mode";
import type {
  MonitorResponse,
  ProjectDetail,
  ProjectSummary,
  RegisterRequest,
  RegisterResponse,
  ReviewRequest,
  ReviewResponse,
  VerificationReport,
  VerifyResponse,
} from "./types";

export { ApiError };

const GET_TIMEOUT_MS = 5_000;
const POST_TIMEOUT_MS = 180_000; // verification pulls satellite imagery: 30–120 s is normal

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  // GETs fall back to mock data when the backend is unreachable. POSTs only use mocks once mock mode
  // is already on, so a backend crash mid-verification surfaces as an error instead of fake data.
  if (isMockMode() && (method === "POST" || !shouldReprobe())) {
    return mockRequest<T>(method, path, body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), method === "GET" ? GET_TIMEOUT_MS : POST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (method === "GET") {
      setMockMode(true);
      return mockRequest<T>(method, path, body);
    }
    const timedOut = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(0, timedOut ? "The backend took too long to respond." : "Could not reach the backend.");
  } finally {
    clearTimeout(timer);
  }

  setMockMode(false);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && typeof data.error === "string" && data.error) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const api = {
  listProjects: () => request<ProjectSummary[]>("GET", "/api/projects"),
  getProject: (id: number) => request<ProjectDetail>("GET", `/api/projects/${id}`),
  registerProject: (body: RegisterRequest) => request<RegisterResponse>("POST", "/api/projects", body),
  reviewProject: (id: number, body: ReviewRequest) =>
    request<ReviewResponse>("POST", `/api/projects/${id}/review`, body),
  isApprover: (address: string) =>
    request<{ address: string; isApprover: boolean }>("GET", `/api/approvers/${address}`),
  verify: (id: number) => request<VerifyResponse>("POST", `/api/projects/${id}/verify`),
  monitor: (id: number, simulateDeforestation: boolean) =>
    request<MonitorResponse>(
      "POST",
      `/api/projects/${id}/monitor${simulateDeforestation ? "?simulateDeforestation=true" : ""}`,
    ),
  getReport: (reportId: string) => request<VerificationReport>("GET", `/api/reports/${reportId}`),
};

/** Preview image URLs are relative to the API base; mock previews are served by this app. */
export function resolveAssetUrl(url: string): string {
  if (/^https?:\/\//.test(url) || url.startsWith("/mock/")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}
