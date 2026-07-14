import type { MetricState, RiskEventState } from "@/lib/types";

/** Health / score band → semantic color token (see globals.css). */
export function scoreBand(score: number): "excellent" | "good" | "watch" | "poor" | "critical" {
  if (score >= 90) return "excellent";
  if (score >= 80) return "good";
  if (score >= 65) return "watch";
  if (score >= 50) return "poor";
  return "critical";
}

export function priorityBandClass(band: string): string {
  return `band-${band.toLowerCase()}`;
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

export function trendArrow(n: number): string {
  if (n > 0.5) return "▲";
  if (n < -0.5) return "▼";
  return "▬";
}

export function trendClass(n: number, invert = false): string {
  const good = invert ? n < 0 : n > 0;
  const bad = invert ? n > 0 : n < 0;
  if (Math.abs(n) < 0.5) return "trend-flat";
  return good ? "trend-up" : bad ? "trend-down" : "trend-flat";
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

export function metricStateClass(s: MetricState): string {
  switch (s) {
    case "PASS":
      return "state-pass";
    case "PARTIAL":
      return "state-partial";
    case "FAIL":
      return "state-fail";
    case "EXCEPTION_ACTIVE":
      return "state-exception";
    case "NOT_PURCHASED":
    case "NOT_APPLICABLE":
      return "state-na";
    default:
      return "state-unverified";
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
  const months = Math.round(days / 30);
  return `${months} mo`;
}
