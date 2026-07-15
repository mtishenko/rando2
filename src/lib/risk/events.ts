import type {
  Capability,
  Customer,
  Finding,
  Integration,
  MetricCategory,
  MetricDefinition,
  MetricObservation,
  RiskEvent,
  RiskEventState,
} from "@/lib/types";
import { METRICS_BY_ID, CRITICALITY_SEVERITY } from "@/lib/metrics/catalog";
import { stableId } from "@/lib/util/rng";
import { isApplicable } from "@/lib/scoring/state";
import {
  computePriority,
  priorityBand,
  priorityScore,
  type PriorityContext,
} from "@/lib/risk/priority";
import { buildRecommendation } from "@/lib/risk/recommendations";

/** Per-event contextual flags sourced from seed / operational state. */
export interface EventFlags {
  ownerByCapability?: Partial<Record<Capability, string>>;
  stateByCapability?: Partial<Record<Capability, RiskEventState>>;
  trendByCapability?: Partial<Record<Capability, "improving" | "flat" | "worsening">>;
  ageDaysByCapability?: Partial<Record<Capability, number>>;
  recurrenceByCapability?: Partial<Record<Capability, number>>;
  execEscalationCapabilities?: Capability[];
  fundedRemediationCapabilities?: Capability[];
  compensatingControlMetrics?: string[];
  exceptionMetrics?: string[];
  responsibilityByCapability?: Partial<Record<Capability, number>>;
}

export interface BuildRiskOptions {
  customer: Customer;
  observations: MetricObservation[];
  integrations: Integration[];
  confidence: number;
  totalScorableWeight: number;
  health7dChange: number;
  flags?: EventFlags;
}

/** An observation is a finding when it is applicable and not a clean pass. */
function isFinding(obs: MetricObservation): boolean {
  return isApplicable(obs.state) && obs.state !== "PASS" && obs.state !== "EXCEPTION_ACTIVE";
}

function findingSeverity(def: MetricDefinition, obs: MetricObservation): number {
  const stateFactor =
    obs.state === "FAIL"
      ? 1
      : obs.state === "PARTIAL"
        ? 0.6
        : 0.5; // missing / stale / error / unknown
  return Math.round(CRITICALITY_SEVERITY[def.criticality] * stateFactor * 100) / 100;
}

export function buildFindings(observations: MetricObservation[]): Finding[] {
  const findings: Finding[] = [];
  for (const obs of observations) {
    const def = METRICS_BY_ID[obs.metricId];
    if (!def || !isFinding(obs)) continue;
    findings.push({
      id: stableId(`finding|${obs.customerId}|${obs.metricId}`),
      customerId: obs.customerId,
      metricId: obs.metricId,
      state: obs.state,
      severity: findingSeverity(def, obs),
      observedAt: obs.observedAt,
    });
  }
  return findings;
}

/**
 * Verification gate. A closed ticket does not resolve a backup event until a
 * successful backup is observed (TESTING_STRATEGY scenario 3). Returns the
 * metric whose PASS is required, or null when the driving metric itself suffices.
 */
function verificationMetricFor(def: MetricDefinition): string {
  if (def.capability === "backup") return "BACKUP-002";
  return def.id;
}

function shortReason(def: MetricDefinition, obs: MetricObservation): string {
  switch (obs.state) {
    case "EXPECTED_DATA_MISSING":
      return `${def.name}: expected data missing`;
    case "DATA_STALE":
      return `${def.name}: evidence stale`;
    case "SOURCE_ERROR":
      return `${def.name}: source error`;
    case "UNKNOWN":
      return `${def.name}: state unknown`;
    case "PARTIAL":
      return `${def.name} below target`;
    default:
      return `${def.name} failing`;
  }
}

/**
 * Group a customer's findings into persistent risk events (one per capability),
 * score priority, attach a recommendation, and compute TV inclusion reasons.
 */
export function buildRiskEvents(opts: BuildRiskOptions): RiskEvent[] {
  const { customer, observations, confidence, totalScorableWeight, health7dChange } = opts;
  const flags = opts.flags ?? {};

  const findingsByCapability = new Map<Capability, MetricObservation[]>();
  for (const obs of observations) {
    if (!isFinding(obs)) continue;
    const def = METRICS_BY_ID[obs.metricId];
    if (!def) continue;
    const list = findingsByCapability.get(def.capability) ?? [];
    list.push(obs);
    findingsByCapability.set(def.capability, list);
  }

  const events: RiskEvent[] = [];

  for (const [capability, group] of findingsByCapability) {
    // Driving finding = highest-priority observation in the group.
    let best: { obs: MetricObservation; def: MetricDefinition; score: number; breakdown: RiskEvent["breakdown"] } | null =
      null;

    const owner = flags.ownerByCapability?.[capability] ?? null;
    const trend = flags.trendByCapability?.[capability] ?? "flat";
    const ageDays = flags.ageDaysByCapability?.[capability] ?? 3;
    const recurrenceCount = flags.recurrenceByCapability?.[capability] ?? 0;
    const responsibility = flags.responsibilityByCapability?.[capability] ?? 0.95;
    const executiveEscalation =
      flags.execEscalationCapabilities?.includes(capability) ?? false;
    const activeFundedRemediation =
      flags.fundedRemediationCapabilities?.includes(capability) ?? false;

    for (const obs of group) {
      const def = METRICS_BY_ID[obs.metricId];
      if (!def) continue;
      const ctx: PriorityContext = {
        customer,
        def,
        obs,
        trend,
        ageDays,
        recurrenceCount,
        confidence,
        responsibility,
        hasApprovedException: flags.exceptionMetrics?.includes(def.id) ?? false,
        hasCompensatingControl: flags.compensatingControlMetrics?.includes(def.id) ?? false,
        activeFundedRemediation,
        executiveEscalation,
        owner,
      };
      const breakdown = computePriority(ctx);
      const score = priorityScore(breakdown);
      if (!best || score > best.score) best = { obs, def, score, breakdown };
    }

    if (!best) continue;
    const { def, obs, score, breakdown } = best;

    const eventId = stableId(`risk|${customer.id}|${capability}`);
    const verificationMetricId = verificationMetricFor(def);
    const verifyObs = observations.find((o) => o.metricId === verificationMetricId);
    const verificationSatisfied = verifyObs?.state === "PASS";

    const category: MetricCategory = def.category;
    const state: RiskEventState = flags.stateByCapability?.[capability] ?? "OPEN";
    const now = obs.observedAt;
    const firstSeen = new Date(new Date(now).getTime() - ageDays * 86400000).toISOString();

    const recommendation = buildRecommendation(eventId, def, obs, totalScorableWeight);

    const event: RiskEvent = {
      id: eventId,
      customerId: customer.id,
      title: `${capabilityLabel(capability)} — ${def.name}`,
      capability,
      category,
      state,
      priorityScore: score,
      priorityBand: priorityBand(score),
      businessImpact: def.businessRisk,
      primaryReason: shortReason(def, obs),
      confidence: Math.round(confidence * 100) / 100,
      findingIds: group.map((o) => stableId(`finding|${o.customerId}|${o.metricId}`)),
      metricIds: group.map((o) => o.metricId),
      firstSeenAt: firstSeen,
      lastSeenAt: now,
      ageDays,
      recurrenceCount,
      trend,
      owner,
      verificationMetricId,
      verificationSatisfied,
      recommendation,
      breakdown,
      tvInclusionReasons: [],
    };

    event.tvInclusionReasons = computeInclusionReasons(event, def, obs, {
      health7dChange,
      integrations: opts.integrations,
      executiveEscalation,
    });
    events.push(event);
  }

  events.sort((a, b) => b.priorityScore - a.priorityScore);
  return events;
}

/** TV top-10 inclusion rules (TV_DASHBOARD_SPEC.md). */
function computeInclusionReasons(
  event: RiskEvent,
  def: MetricDefinition,
  obs: MetricObservation,
  ctx: { health7dChange: number; integrations: Integration[]; executiveEscalation: boolean },
): string[] {
  const reasons: string[] = [];
  if (event.priorityScore >= 700) reasons.push("Priority ≥ 700");
  if (ctx.health7dChange <= -5) reasons.push("Health declined ≥ 5 in 7 days");
  if (def.criticality === "Critical" && isUnverifiedState(obs.state))
    reasons.push("Critical unverified control");
  const criticalIntegrationFailure = ctx.integrations.some(
    (i) => i.critical && i.state !== "HEALTHY" && i.capability === event.capability,
  );
  if (criticalIntegrationFailure) reasons.push("Critical integration failure");
  if ((def.id === "BACKUP-002" || def.id === "BACKUP-003") && obs.state === "FAIL")
    reasons.push("Failed production backup");
  if (
    def.category === "Security" &&
    def.criticality === "Critical" &&
    obs.state === "FAIL"
  )
    reasons.push("Active high-severity security event");
  if (ctx.executiveEscalation) reasons.push("Executive escalation");
  return reasons;
}

function isUnverifiedState(state: MetricObservation["state"]): boolean {
  return (
    state === "EXPECTED_DATA_MISSING" ||
    state === "DATA_STALE" ||
    state === "SOURCE_ERROR" ||
    state === "UNKNOWN"
  );
}

function capabilityLabel(capability: Capability): string {
  const labels: Record<Capability, string> = {
    endpoint_management: "Endpoint Management",
    edr: "Endpoint Detection & Response",
    identity_security: "Identity Security",
    m365_security: "Microsoft 365 Security",
    mdr: "Managed Detection & Response",
    backup: "Backup & Recovery",
    network_management: "Network Management",
    documentation: "Documentation",
    service_management: "Service Management",
    grc: "Governance, Risk & Compliance",
  };
  return labels[capability];
}

/**
 * Verification-gated resolution. An event may be MITIGATED (e.g. its ticket was
 * closed) but only becomes VERIFIED_RESOLVED once its verification metric passes.
 */
export function canVerifyResolve(event: RiskEvent): boolean {
  return event.verificationSatisfied;
}

export function resolvedState(event: RiskEvent): RiskEventState {
  if (event.verificationSatisfied) return "VERIFIED_RESOLVED";
  if (event.state === "MITIGATED") return "MITIGATED";
  return event.state;
}

export { capabilityLabel };
