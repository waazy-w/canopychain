import { keccak256, toBytes } from "viem";
import type { GeoJSONPolygon, ProjectDetail, VerificationReport } from "../api/types";
import { polygonAreaHa, round } from "../geo";

// Demo data used when the backend is unreachable. Shapes match docs/api.md exactly.

export const METHODOLOGY = "canopychain-prototype-v0 (NOT a certified methodology)";
export const TCO2E_PER_HA = 450;
export const REGIONAL_LOSS_RATE_PCT = 2.1;

export function mockHash(report: Omit<VerificationReport, "reportHash">): string {
  return keccak256(toBytes(JSON.stringify(report)));
}

interface ReportInput {
  projectId: number;
  polygon: GeoJSONPolygon;
  vintage: number;
  baselineCoverPct: number;
  lossPctOfArea: number;
  status: VerificationReport["status"];
  createdAt: string;
  previews: string; // prefix under /mock/
}

export function buildReport(input: ReportInput): VerificationReport {
  const areaHa = polygonAreaHa(input.polygon);
  const baselineCover = round(areaHa * input.baselineCoverPct);
  const deforestedHa = round(areaHa * input.lossPctOfArea);
  const currentCover = round(baselineCover - deforestedHa);
  const expectedLossHa = (baselineCover * REGIONAL_LOSS_RATE_PCT) / 100;
  const avoidedLossHa = round(Math.max(0, expectedLossHa - deforestedHa));
  const day = input.createdAt.slice(0, 10);
  const idSuffix = keccak256(toBytes(`${input.projectId}-${input.createdAt}`)).slice(2, 8);
  const body: Omit<VerificationReport, "reportHash"> = {
    reportId: `rep_${day}_${idSuffix}`,
    projectId: input.projectId,
    polygon: input.polygon,
    areaHa,
    vintage: input.vintage,
    baseline: { date: `${input.vintage - 1}-10-01`, forestCoverHa: baselineCover, meanNdvi: 0.71 },
    current: {
      date: day,
      forestCoverHa: currentCover,
      meanNdvi: round(0.71 - input.lossPctOfArea * 1.5, 2),
    },
    deforestedHa,
    regionalBaselineLossRatePct: REGIONAL_LOSS_RATE_PCT,
    avoidedLossHa,
    tco2ePerHa: TCO2E_PER_HA,
    creditsEstimated: input.status === "verified" ? Math.round(avoidedLossHa * TCO2E_PER_HA) : 0,
    methodology: METHODOLOGY,
    imagery: {
      source: "sentinel-2-l2a (Microsoft Planetary Computer)",
      baselineSceneIds: [`S2B_MSIL2A_${input.vintage - 1}1001_MOCK`],
      currentSceneIds: [`S2A_MSIL2A_${day.replaceAll("-", "")}_MOCK`],
      previewBaselineUrl: `/mock/${input.previews}-baseline.svg`,
      previewCurrentUrl: `/mock/${input.previews}-current.svg`,
    },
    status: input.status,
    createdAt: input.createdAt,
    txHash: null,
    onChainError: "Mock mode: nothing was sent on-chain.",
  };
  return { ...body, reportHash: mockHash(body) };
}

const ATLANTIC_FOREST: GeoJSONPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [-48.31, -25.2],
      [-48.262, -25.205],
      [-48.255, -25.172],
      [-48.288, -25.161],
      [-48.315, -25.176],
      [-48.31, -25.2],
    ],
  ],
};

const KALIMANTAN_PEAT: GeoJSONPolygon = {
  type: "Polygon",
  coordinates: [
    [
      [113.9, -2.3],
      [113.952, -2.302],
      [113.958, -2.265],
      [113.91, -2.258],
      [113.9, -2.3],
    ],
  ],
};

export function initialProjects(): ProjectDetail[] {
  const p1Report = buildReport({
    projectId: 1,
    polygon: ATLANTIC_FOREST,
    vintage: 2026,
    baselineCoverPct: 0.94,
    lossPctOfArea: 0.003,
    status: "verified",
    createdAt: "2026-10-18T12:00:00Z",
    previews: "p1",
  });
  const p2Verified = buildReport({
    projectId: 2,
    polygon: KALIMANTAN_PEAT,
    vintage: 2026,
    baselineCoverPct: 0.9,
    lossPctOfArea: 0.004,
    status: "verified",
    createdAt: "2026-10-17T09:30:00Z",
    previews: "p2",
  });
  const p2Reversal = buildReport({
    projectId: 2,
    polygon: KALIMANTAN_PEAT,
    vintage: 2026,
    baselineCoverPct: 0.9,
    lossPctOfArea: 0.11,
    status: "reversal_detected",
    createdAt: "2026-10-19T08:15:00Z",
    previews: "p2-reversal",
  });
  p2Reversal.lostCredits = Math.round(p2Reversal.deforestedHa * TCO2E_PER_HA);

  return [
    {
      projectId: 1,
      name: "Mata Atlântica Restoration Block",
      owner: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
      polygon: ATLANTIC_FOREST,
      areaHa: p1Report.areaHa,
      createdAt: "2026-10-18T11:00:00Z",
      onChainRegistered: false,
      latestReport: summary(p1Report),
      reports: [p1Report],
    },
    {
      projectId: 2,
      name: "Kalimantan Peat Swamp Forest",
      owner: "0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2",
      polygon: KALIMANTAN_PEAT,
      areaHa: p2Verified.areaHa,
      createdAt: "2026-10-17T08:00:00Z",
      onChainRegistered: false,
      latestReport: summary(p2Reversal),
      reports: [p2Reversal, p2Verified],
    },
  ];
}

export function summary(r: VerificationReport) {
  return {
    reportId: r.reportId,
    status: r.status,
    creditsEstimated: r.creditsEstimated,
    vintage: r.vintage,
    txHash: r.txHash ?? null,
    createdAt: r.createdAt,
  };
}
