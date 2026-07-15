import type { CustomerModel } from "@/lib/data/compute";
import type { RiskEventState } from "@/lib/types";
import type { Capability } from "@/lib/types";
import { getMetric } from "@/lib/metrics/catalog";
import { capabilityLabel } from "@/lib/risk/events";
import { isScorable } from "@/lib/scoring/state";

/**
 * Customer-safe, vendor-free "why this matters" wording per capability. The
 * internal `businessRisk` strings can name vendors (e.g. CrowdStrike, Huntress);
 * the portal never does. Kept capability-level so no product or metric detail
 * reaches the customer (PRD-010 "no internal detail leaks").
 */
const CAPABILITY_CUSTOMER_RISK: Record<Capability, string> = {
  endpoint_management:
    "Unpatched or unmanaged devices are easier for attackers to exploit and harder for us to protect.",
  edr: "Without active threat detection on every device, malicious activity can go unnoticed.",
  identity_security: "Weak account protections are the most common way attackers gain access.",
  m365_security: "Email and Microsoft 365 are frequent targets for phishing and account takeover.",
  mdr: "Continuous monitoring catches threats that slip past automated defenses.",
  backup: "Reliable backups are what let you recover quickly after an incident or ransomware.",
  network_management: "A healthy, up-to-date network keeps your sites online and secure.",
  documentation: "Accurate documentation lets us respond faster and more safely during incidents.",
  service_management: "Timely, high-quality support keeps your team productive.",
  grc: "Complete compliance evidence keeps your certifications and audits on track.",
};

/**
 * Customer-facing view model (PRD-010). Strict display safety: capability-level,
 * business-language wording only — no metric IDs, vendor names, users, hosts, IPs,
 * or CVEs. Confirmed failures are worded distinctly from unverified controls.
 */

export type WorkParty = "edgefi" | "you" | "together";
export type WorkKind = "issue" | "visibility";

export interface PortalWorkItem {
  id: string;
  capability: string;
  /** Business-language description of why this matters. */
  headline: string;
  /** "issue" = a confirmed failure we're fixing; "visibility" = a control we
   *  can't yet verify and are restoring sight of. */
  kind: WorkKind;
  status: string;
  party: WorkParty;
  expectedImprovement: number;
}

export interface PortalAcceptedRisk {
  capability: string;
  note: string;
}

export interface PortalView {
  customerName: string;
  tier: string;
  industry: string;
  health: number;
  coverage: number;
  confidence: number;
  controlsVerified: number;
  controlsTotal: number;
  healthDelta30d: number;
  coverageDelta30d: number;
  workingOn: PortalWorkItem[];
  acceptedRisks: PortalAcceptedRisk[];
  needsYou: PortalWorkItem[];
}

/** Customer-safe status wording. Confirmed failures vs unverified controls are
 *  distinguished by `kind`, not here. */
function statusLabel(state: RiskEventState): string {
  switch (state) {
    case "PENDING_CUSTOMER":
      return "Waiting on you";
    case "PENDING_VENDOR":
      return "Waiting on vendor";
    case "MITIGATED":
      return "Fix applied — verifying";
    case "ACKNOWLEDGED":
      return "Under review";
    case "ASSIGNED":
    case "IN_PROGRESS":
      return "In progress";
    default:
      return "Being worked";
  }
}

export function buildPortalView(model: CustomerModel): PortalView {
  const controlsVerified = model.observations.filter(
    (o) => isScorable(o.state) && (o.state === "PASS" || o.state === "EXCEPTION_ACTIVE"),
  ).length;
  const controlsTotal = model.observations.filter((o) => isScorable(o.state)).length;

  const workingOn: PortalWorkItem[] = [];
  const needsYou: PortalWorkItem[] = [];

  for (const e of model.events) {
    // Classify by the event's DRIVING control (the one that set its priority),
    // falling back to the group. A confirmed FAIL/PARTIAL reads as an "issue";
    // a missing/stale/error control reads as a "visibility" gap — never conflated.
    const stateOf = (id: string | null | undefined) =>
      id ? model.observations.find((o) => o.metricId === id)?.state : undefined;
    const unverified = (s?: string) =>
      s === "EXPECTED_DATA_MISSING" || s === "DATA_STALE" || s === "SOURCE_ERROR" || s === "UNKNOWN";
    const confirmed = (s?: string) => s === "FAIL" || s === "PARTIAL";

    const drivingState = stateOf(e.verificationMetricId);
    const groupStates = e.metricIds.map((id) => stateOf(id));
    const kind: WorkKind = confirmed(drivingState)
      ? "issue"
      : unverified(drivingState)
        ? "visibility"
        : groupStates.some(confirmed)
          ? "issue"
          : "visibility";
    const party: WorkParty = e.state === "PENDING_CUSTOMER" ? "you" : "edgefi";
    const item: PortalWorkItem = {
      id: e.id,
      capability: capabilityLabel(e.capability),
      headline: CAPABILITY_CUSTOMER_RISK[e.capability],
      kind,
      status: statusLabel(e.state),
      party,
      expectedImprovement: e.recommendation.expectedHealthImprovement,
    };
    if (party === "you") needsYou.push(item);
    else workingOn.push(item);
  }

  // Accepted risks: metrics under an active, approved exception.
  const acceptedRisks: PortalAcceptedRisk[] = model.observations
    .filter((o) => o.state === "EXCEPTION_ACTIVE")
    .map((o) => {
      const def = getMetric(o.metricId);
      return {
        capability: capabilityLabel(def.capability),
        note: CAPABILITY_CUSTOMER_RISK[def.capability],
      };
    });

  return {
    customerName: model.customer.displayName,
    tier: model.customer.tier,
    industry: model.customer.industry,
    health: model.scores.health,
    coverage: model.scores.coverage,
    confidence: model.scores.confidence,
    controlsVerified,
    controlsTotal,
    healthDelta30d: model.scores.healthDelta30d,
    coverageDelta30d: model.scores.coverageDelta30d,
    workingOn: workingOn.sort((a, b) => b.expectedImprovement - a.expectedImprovement),
    acceptedRisks,
    needsYou,
  };
}
