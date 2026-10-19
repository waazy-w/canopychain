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

/** pending → (approver review) → active | rejected; active → reversed when forest loss is flagged. */
export type ProjectLifecycle = "pending" | "rejected" | "active" | "reversed";

export interface ProjectReview {
  decision: "approve" | "reject";
  reviewer: string;
  reviewedAt: string;
  regionalBaselineLossRatePct: number;
  tco2ePerHa: number;
  note: string;
  signature: string;
}

export interface ProjectSummary {
  projectId: number;
  name: string;
  owner: string;
  polygon: GeoJSONPolygon;
  areaHa: number;
  createdAt: string;
  /** Absent on projects created before reviews existed; treat as "active". */
  status?: ProjectLifecycle;
  review?: ProjectReview | null;
  boundaryHash?: string;
  ownerSignature?: string | null;
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
  /** The owner's personal_sign over registrationMessage() (lib/auth.ts). */
  issuedAt: string;
  signature: string;
}

export interface RegisterResponse {
  projectId: number;
  status: ProjectLifecycle;
  txHash: string | null;
}

export interface ReviewRequest {
  decision: "approve" | "reject";
  regionalBaselineLossRatePct: number;
  tco2ePerHa: number;
  note: string;
  /** An approver's personal_sign over reviewMessage() (lib/auth.ts). */
  issuedAt: string;
  signature: string;
}

export interface ReviewResponse extends OnChainResult {
  projectId: number;
  status: ProjectLifecycle;
}
