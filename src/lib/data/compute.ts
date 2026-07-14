import type {
  AttentionRow,
  CommandCenterData,
  Customer,
  CustomerScores,
  Finding,
  Integration,
  MetricObservation,
  PortfolioScores,
  RiskEvent,
  VerifiedWin,
} from "@/lib/types";
import { METRICS_BY_ID } from "@/lib/metrics/catalog";
import { computeCustomerScores, effectiveWeight } from "@/lib/scoring/customer";
import { isScorable } from "@/lib/scoring/state";
import { aggregatePortfolioMetric, computeImpact } from "@/lib/scoring/portfolio";
import { buildFindings, buildRiskEvents, type EventFlags } from "@/lib/risk/events";
import { generateCustomer, REFERENCE_NOW } from "@/lib/data/generate";
import { ROSTER, type RosterEntry } from "@/lib/data/roster";
import { hash32 } from "@/lib/util/rng";

export interface CustomerModel {
  customer: Customer;
  scores: CustomerScores;
  observations: MetricObservation[];
  integrations: Integration[];
  findings: Finding[];
  events: RiskEvent[];
  topEvent: RiskEvent | null;
}

export interface PortfolioModel {
  generatedAt: string;
  customers: CustomerModel[];
  portfolio: PortfolioScores;
  commandCenter: CommandCenterData;
  allEvents: RiskEvent[];
}

const HEALTH_THRESHOLD = 80;

function totalScorableWeight(observations: MetricObservation[]): number {
  let w = 0;
  for (const obs of observations) {
    const def = METRICS_BY_ID[obs.metricId];
    if (def && isScorable(obs.state)) w += effectiveWeight(def);
  }
  return w;
}

function buildCustomerModel(entry: RosterEntry): CustomerModel {
  const { customer, observations, integrations } = generateCustomer(entry);
  const scores = computeCustomerScores(customer, observations, {
    healthDelta30d: entry.healthDelta30d,
    coverageDelta30d: entry.coverageDelta30d,
    health7dChange: entry.health7dChange,
  });

  const stateByCapability: EventFlags["stateByCapability"] = {};
  for (const cap of entry.mitigatedCapabilities ?? []) stateByCapability[cap] = "MITIGATED";

  const flags: EventFlags = {
    ownerByCapability: entry.ownerByCapability,
    trendByCapability: entry.trendByCapability,
    ageDaysByCapability: entry.ageDaysByCapability,
    recurrenceByCapability: entry.recurrenceByCapability,
    execEscalationCapabilities: entry.execEscalationCapabilities,
    fundedRemediationCapabilities: entry.fundedRemediationCapabilities,
    exceptionMetrics: entry.exceptionMetrics,
    compensatingControlMetrics: entry.compensatingControlMetrics,
    stateByCapability,
  };

  const events = buildRiskEvents({
    customer,
    observations,
    integrations,
    confidence: scores.confidence,
    totalScorableWeight: totalScorableWeight(observations),
    health7dChange: entry.health7dChange,
    flags,
  });

  const findings = buildFindings(observations);
  const topEvent = events[0] ?? null;
  return { customer, scores, observations, integrations, findings, events, topEvent };
}

/** MVP-synthesized monthly outcome counts (pending historical snapshots). */
function monthlyResolvedFor(entry: RosterEntry): number {
  return hash32(`resolved|${entry.key}`) % 4; // 0..3
}

function buildPortfolio(models: CustomerModel[]): PortfolioScores {
  const scoreById = new Map(models.map((m) => [m.customer.id, m.scores]));
  const customers = models.map((m) => m.customer);

  const health = aggregatePortfolioMetric(customers, (c) => scoreById.get(c.id)!.health);
  const coverage = aggregatePortfolioMetric(customers, (c) => scoreById.get(c.id)!.coverage);
  const confidence = aggregatePortfolioMetric(
    customers,
    (c) => scoreById.get(c.id)!.confidence * 100,
  ) / 100;

  const customersBelowThreshold = models.filter((m) => m.scores.health < HEALTH_THRESHOLD).length;
  const criticalUnverifiedControls = models.reduce(
    (s, m) => s + m.scores.unverifiedCriticalControls,
    0,
  );
  const unhealthyIntegrations = models.reduce(
    (s, m) => s + m.integrations.filter((i) => i.state !== "HEALTHY").length,
    0,
  );

  const risksResolvedThisMonth = ROSTER.reduce((s, e) => s + monthlyResolvedFor(e), 0);
  const openCritical = models.reduce(
    (s, m) => s + m.events.filter((e) => e.priorityBand === "Critical").length,
    0,
  );

  const improving = models.filter((m) => m.scores.healthDelta30d > 0);
  const healthImprovementPoints =
    improving.length > 0
      ? improving.reduce((s, m) => s + m.scores.healthDelta30d, 0) / improving.length
      : 0;
  const coverageImproving = models.filter((m) => m.scores.coverageDelta30d > 0);
  const coverageImprovementPoints =
    coverageImproving.length > 0
      ? coverageImproving.reduce((s, m) => s + m.scores.coverageDelta30d, 0) / coverageImproving.length
      : 0;

  const recurrencesPrevented = 6;
  const impact = computeImpact({
    verifiedRiskReduction:
      risksResolvedThisMonth / Math.max(1, risksResolvedThisMonth + openCritical),
    healthImprovementPoints,
    coverageImprovementPoints,
    recurrencePrevention: recurrencesPrevented / (recurrencesPrevented + 4),
    durableControlImprovement: 0.55,
  });

  const healthDelta30d = round1(
    models.reduce((s, m) => s + m.scores.healthDelta30d, 0) / models.length,
  );
  const coverageDelta30d = round1(
    models.reduce((s, m) => s + m.scores.coverageDelta30d, 0) / models.length,
  );

  return {
    health,
    coverage,
    confidence: Math.round(confidence * 1000) / 1000,
    impact,
    customersBelowThreshold,
    criticalUnverifiedControls,
    unhealthyIntegrations,
    risksResolvedThisMonth,
    coverageGainedThisMonth: Math.round(coverageImprovementPoints * 10) / 10,
    recurrencesPrevented,
    healthDelta30d,
    coverageDelta30d,
  };
}

function buildAttention(models: CustomerModel[]): AttentionRow[] {
  const qualifying = models.filter(
    (m) => m.topEvent && m.topEvent.tvInclusionReasons.length > 0,
  );
  qualifying.sort((a, b) => (b.topEvent!.priorityScore - a.topEvent!.priorityScore));

  return qualifying.slice(0, 10).map((m, i) => {
    const e = m.topEvent!;
    return {
      rank: i + 1,
      customer: m.customer,
      scores: m.scores,
      topEvent: e,
      priorityScore: e.priorityScore,
      priorityBand: e.priorityBand,
      primaryReason: e.primaryReason,
      owner: e.owner,
      riskAgeDays: e.ageDays,
      health7dChange: m.scores.health7dChange,
      nextBestAction: e.recommendation.action,
      expectedImprovement: e.recommendation.expectedHealthImprovement,
      inclusionReasons: e.tvInclusionReasons,
    };
  });
}

function buildVerifiedWins(models: CustomerModel[]): VerifiedWin[] {
  // Highlight customers that improved this period (positive 30-day health delta).
  return models
    .filter((m) => m.scores.healthDelta30d > 0)
    .sort((a, b) => b.scores.healthDelta30d - a.scores.healthDelta30d)
    .slice(0, 5)
    .map((m) => ({
      customer: m.customer.displayName,
      description: `Health up ${m.scores.healthDelta30d} pts over 30 days; coverage ${
        m.scores.coverageDelta30d >= 0 ? "+" : ""
      }${m.scores.coverageDelta30d} pts`,
      impactPoints: m.scores.healthDelta30d,
    }));
}

function buildCommandCenter(models: CustomerModel[], portfolio: PortfolioScores): CommandCenterData {
  // Median age of real-time collectors (freshness threshold <= 48h) — a stable
  // "how fresh is our data" indicator that isn't skewed by long-cadence metrics
  // (e.g. 180-day runbook currency) or by not-purchased placeholders.
  const ages = models
    .flatMap((m) => m.observations)
    .filter((o) => {
      const def = METRICS_BY_ID[o.metricId];
      return o.state !== "NOT_PURCHASED" && def && def.freshnessThresholdHours <= 48;
    })
    .map((o) => o.ageHours)
    .sort((a, b) => a - b);
  const freshness = ages.length === 0 ? 0 : ages[Math.floor(ages.length / 2)];
  return {
    generatedAt: REFERENCE_NOW,
    operatingDay: new Date(REFERENCE_NOW).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }),
    dataFreshnessHours: Math.round(freshness * 10) / 10,
    portfolio,
    topAttention: buildAttention(models),
    verifiedWins: buildVerifiedWins(models),
  };
}

let cached: PortfolioModel | null = null;

/** Build (and memoize) the full portfolio model from seed data. */
export function getPortfolioModel(): PortfolioModel {
  if (cached) return cached;
  const models = ROSTER.map(buildCustomerModel);
  const portfolio = buildPortfolio(models);
  const commandCenter = buildCommandCenter(models, portfolio);
  const allEvents = models
    .flatMap((m) => m.events)
    .sort((a, b) => b.priorityScore - a.priorityScore);
  cached = {
    generatedAt: REFERENCE_NOW,
    customers: models,
    portfolio,
    commandCenter,
    allEvents,
  };
  return cached;
}

export function getCustomerModel(customerId: string): CustomerModel | undefined {
  return getPortfolioModel().customers.find((m) => m.customer.id === customerId);
}

export function getRiskEvent(riskEventId: string): { event: RiskEvent; model: CustomerModel } | undefined {
  const pm = getPortfolioModel();
  for (const m of pm.customers) {
    const event = m.events.find((e) => e.id === riskEventId);
    if (event) return { event, model: m };
  }
  return undefined;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
