import type { CustomerModel } from "@/lib/data/compute";

/** Compact, fully-serializable customer summary for client components. */
export interface CustomerSummary {
  id: string;
  name: string;
  tier: string;
  industry: string;
  health: number;
  coverage: number;
  confidence: number;
  health7dChange: number;
  healthDelta30d: number;
  coverageDelta30d: number;
  openEvents: number;
  unverifiedCritical: number;
  priorityScore: number;
  priorityBand: string;
  primaryReason: string;
  owner: string | null;
  ageDays: number;
  nextBestAction: string;
  expectedImprovement: number;
  inclusionReasons: string[];
  qualifiesForAttention: boolean;
}

export function toSummary(m: CustomerModel): CustomerSummary {
  const e = m.topEvent;
  return {
    id: m.customer.id,
    name: m.customer.displayName,
    tier: m.customer.tier,
    industry: m.customer.industry,
    health: m.scores.health,
    coverage: m.scores.coverage,
    confidence: m.scores.confidence,
    health7dChange: m.scores.health7dChange,
    healthDelta30d: m.scores.healthDelta30d,
    coverageDelta30d: m.scores.coverageDelta30d,
    openEvents: m.events.length,
    unverifiedCritical: m.scores.unverifiedCriticalControls,
    priorityScore: e?.priorityScore ?? 0,
    priorityBand: e?.priorityBand ?? "Low",
    primaryReason: e?.primaryReason ?? "No open findings",
    owner: e?.owner ?? null,
    ageDays: e?.ageDays ?? 0,
    nextBestAction: e?.recommendation.action ?? "—",
    expectedImprovement: e?.recommendation.expectedHealthImprovement ?? 0,
    inclusionReasons: e?.tvInclusionReasons ?? [],
    qualifiesForAttention: (e?.tvInclusionReasons.length ?? 0) > 0,
  };
}
