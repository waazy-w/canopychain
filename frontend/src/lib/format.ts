const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const fmtHa = (n: number) => `${num.format(n)} ha`;
export const fmtNum = (n: number | bigint) => (typeof n === "bigint" ? int.format(n) : num.format(n));
export const fmtCredits = (n: number | bigint) => `${int.format(n)} tCO2e`;

export function fmtDate(iso: string | number | bigint) {
  const d = typeof iso === "string" ? new Date(iso) : new Date(Number(iso) * 1000);
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}

export function errorMessage(err: unknown): string {
  if (!err) return "";
  if (typeof err === "object" && err !== null) {
    const e = err as { shortMessage?: string; message?: string };
    return e.shortMessage || e.message || String(err);
  }
  return String(err);
}
