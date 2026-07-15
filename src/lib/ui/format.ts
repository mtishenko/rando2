import type { MetricState, RiskEventState } from "@/lib/types";

/** Score → status token (ok / warn / danger), the canonical edgefi status colors. */
export function scoreStatus(score: number): "ok" | "warn" | "danger" {
  if (score >= 85) return "ok";
  if (score >= 70) return "warn";
  return "danger";
}

/** Priority band → priority-pill class suffix. */
export function priorityClass(band: string): string {
  return `p-${band.toLowerCase()}`;
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function oneDp(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function signed(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? "+" : ""}${r}`;
}

/** Trend arrow class (status semantics). invert=true means "down is good". */
export function trendClass(n: number, invert = false): "t-up" | "t-down" | "t-flat" {
  if (Math.abs(n) < 0.5) return "t-flat";
  const good = invert ? n < 0 : n > 0;
  return good ? "t-up" : "t-down";
}

export function trendArrow(n: number): string {
  if (n > 0.5) return "▲";
  if (n < -0.5) return "▼";
  return "▬";
}

const METRIC_STATE_LABEL: Record<MetricState, string> = {
  PASS: "Pass",
  PARTIAL: "Partial",
  FAIL: "Fail",
  EXPECTED_DATA_MISSING: "Data missing",
  DATA_STALE: "Stale",
  SOURCE_ERROR: "Source error",
  NOT_APPLICABLE: "N/A",
  NOT_PURCHASED: "Not purchased",
  EXCEPTION_ACTIVE: "Exception",
  UNKNOWN: "Unknown",
};

export function metricStateLabel(s: MetricState): string {
  return METRIC_STATE_LABEL[s];
}

/** Metric-state → chip class (reuses status semantics). */
export function metricStateClass(s: MetricState): string {
  switch (s) {
    case "PASS":
      return "st-pass";
    case "PARTIAL":
      return "st-partial";
    case "FAIL":
      return "st-fail";
    case "EXCEPTION_ACTIVE":
      return "st-exception";
    case "NOT_PURCHASED":
    case "NOT_APPLICABLE":
      return "st-na";
    default:
      return "st-unverified";
  }
}

const RISK_STATE_LABEL: Record<RiskEventState, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  PENDING_CUSTOMER: "Pending customer",
  PENDING_VENDOR: "Pending vendor",
  MITIGATED: "Mitigated",
  VERIFIED_RESOLVED: "Verified resolved",
  ACCEPTED: "Accepted",
  SUPPRESSED: "Suppressed",
  REOPENED: "Reopened",
};

export function riskStateLabel(s: RiskEventState): string {
  return RISK_STATE_LABEL[s];
}

export function ageLabel(days: number): string {
  if (days < 1) return "today";
  if (days === 1) return "1 day";
  if (days < 30) return `${Math.round(days)} days`;
  return `${Math.round(days / 30)} mo`;
}
