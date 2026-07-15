import type { RiskEvent } from "@/lib/types";
import type { CustomerModel } from "@/lib/data/compute";
import { getMetric } from "@/lib/metrics/catalog";
import { stableId } from "@/lib/util/rng";
import { redactText } from "@/lib/ai/redaction";
import { REASONING_MODEL } from "@/lib/ai/schema";

/** A single grounded fact the model is permitted to reason over. */
export interface EvidenceFinding {
  finding_id: string;
  metric_id: string;
  metric_name: string;
  criticality: string;
  state: string;
  /** Redacted evidence line — no users, hosts, IPs, or CVEs. */
  evidence: string;
  source: string;
  observed_at: string;
}

/**
 * The complete, redacted evidence package handed to the reasoning layer. This is
 * the ONLY information the model may use — nothing else is in the prompt, so the
 * model cannot invent facts (AI_GOVERNANCE "AI may not invent missing evidence").
 */
export interface EvidenceContext {
  customer_id: string;
  customer_name: string;
  risk_event_id: string | null;
  capability: string | null;
  category: string | null;
  priority_score: number | null;
  priority_band: string | null;
  confidence: number;
  findings: EvidenceFinding[];
  sources: string[];
  evidence_timestamps: { earliest: string | null; latest: string | null };
  model_version: string;
  /** All finding IDs the model is allowed to cite. */
  allowed_finding_ids: string[];
}

function findingIdFor(customerId: string, metricId: string): string {
  return stableId(`finding|${customerId}|${metricId}`);
}

function timestamps(findings: EvidenceFinding[]): { earliest: string | null; latest: string | null } {
  const ts = findings.map((f) => f.observed_at).filter(Boolean).sort();
  return { earliest: ts[0] ?? null, latest: ts[ts.length - 1] ?? null };
}

export function buildRiskEventEvidence(event: RiskEvent, model: CustomerModel): EvidenceContext {
  const findings: EvidenceFinding[] = event.metricIds.map((metricId) => {
    const def = getMetric(metricId);
    const obs = model.observations.find((o) => o.metricId === metricId);
    return {
      finding_id: findingIdFor(model.customer.id, metricId),
      metric_id: metricId,
      metric_name: def.name,
      criticality: def.criticality,
      state: obs?.state ?? "UNKNOWN",
      evidence: redactText(obs?.evidenceNote ?? ""),
      source: def.source,
      observed_at: obs?.observedAt ?? "",
    };
  });

  const sources = Array.from(new Set(findings.map((f) => f.source))).filter((s) => s !== "All");

  return {
    customer_id: model.customer.id,
    customer_name: model.customer.displayName,
    risk_event_id: event.id,
    capability: event.capability,
    category: event.category,
    priority_score: event.priorityScore,
    priority_band: event.priorityBand,
    confidence: event.confidence,
    findings,
    sources,
    evidence_timestamps: timestamps(findings),
    model_version: REASONING_MODEL,
    allowed_finding_ids: findings.map((f) => f.finding_id),
  };
}

/** Evidence for a whole customer (QBR / executive narrative): the top open events. */
export function buildCustomerEvidence(model: CustomerModel, maxEvents = 6): EvidenceContext {
  const findings: EvidenceFinding[] = [];
  for (const event of model.events.slice(0, maxEvents)) {
    const metricId = event.metricIds[0];
    if (!metricId) continue;
    const def = getMetric(metricId);
    const obs = model.observations.find((o) => o.metricId === metricId);
    findings.push({
      finding_id: findingIdFor(model.customer.id, metricId),
      metric_id: metricId,
      metric_name: `${event.title}`,
      criticality: def.criticality,
      state: obs?.state ?? "UNKNOWN",
      evidence: redactText(obs?.evidenceNote ?? ""),
      source: def.source,
      observed_at: obs?.observedAt ?? "",
    });
  }
  const sources = Array.from(new Set(findings.map((f) => f.source))).filter((s) => s !== "All");
  return {
    customer_id: model.customer.id,
    customer_name: model.customer.displayName,
    risk_event_id: null,
    capability: null,
    category: null,
    priority_score: null,
    priority_band: null,
    confidence: model.scores.confidence,
    findings,
    sources,
    evidence_timestamps: timestamps(findings),
    model_version: REASONING_MODEL,
    allowed_finding_ids: findings.map((f) => f.finding_id),
  };
}
