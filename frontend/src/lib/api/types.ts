// Backend REST schemas (docs/api.md §1–2).

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][]; // [[[lng, lat], ...]]
}

export type ReportStatus = "verified" | "reversal_detected" | "failed";

export interface Snapshot {
  date: string;
  forestCoverHa: number;
  meanNdvi: number;
}

export interface Imagery {
  source: string;
  baselineSceneIds: string[];
  currentSceneIds: string[];
  previewBaselineUrl: string;
  previewCurrentUrl: string;
}

export interface VerificationReport {
  reportId: string;
  projectId: number;
  polygon: GeoJSONPolygon;
  areaHa: number;
  vintage: number;
  baseline: Snapshot;
  current: Snapshot;
  deforestedHa: number;
  regionalBaselineLossRatePct: number;
  avoidedLossHa: number;
  tco2ePerHa: number;
  creditsEstimated: number;
  methodology: string;
  imagery: Imagery;
  status: ReportStatus;
  /** "monitoring" for re-checks (POST /monitor). Absent on mock reports. */
  kind?: "verification" | "monitoring";
  createdAt: string;
  reportHash: string;
  // Present on verify/monitor responses, and on stored reports when the backend keeps them.
  txHash?: string | null;
  onChainError?: string | null;
  lostCredits?: number;
}

export interface OnChainResult {
  txHash: string | null;
  onChainError: string | null;
}

export type VerifyResponse = VerificationReport & OnChainResult;
export type MonitorResponse = VerificationReport & OnChainResult & { lostCredits: number };

export interface ReportSummary {
  reportId: string;
  status: ReportStatus;
  kind?: "verification" | "monitoring";
  creditsEstimated: number;
  vintage: number;
  txHash: string | null;
  createdAt: string;
}

export interface ProjectSummary {
  projectId: number;
  name: string;
  owner: string;
  polygon: GeoJSONPolygon;
  areaHa: number;
  createdAt: string;
  onChainRegistered: boolean;
  latestReport: ReportSummary | null;
}

export interface ProjectDetail extends ProjectSummary {
  reports: VerificationReport[]; // newest first
}

export interface RegisterRequest {
  name: string;
  owner: string;
  polygon: GeoJSONPolygon;
}

export interface RegisterResponse {
  projectId: number;
  txHash: string | null;
}
