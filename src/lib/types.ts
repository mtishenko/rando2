/**
 * Canonical data model for Edgefi Pulse.
 * Mirrors DATA_MODEL.md. Enums use the exact string values defined in the PRD
 * so that scoring, risk, and UI layers share one vocabulary.
 */

// ---------------------------------------------------------------------------
// Enumerations (DATA_MODEL.md)
// ---------------------------------------------------------------------------

/** Point-in-time evaluation state of a metric for a customer. */
export type MetricState =
  | "PASS"
  | "PARTIAL"
  | "FAIL"
  | "EXPECTED_DATA_MISSING"
  | "DATA_STALE"
  | "SOURCE_ERROR"
  | "NOT_APPLICABLE"
  | "NOT_PURCHASED"
  | "EXCEPTION_ACTIVE"
  | "UNKNOWN";

export type IntegrationState =
  | "HEALTHY"
  | "DEGRADED"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "OFFLINE"
  | "NOT_CONFIGURED"
  | "DISABLED";

export type RiskEventState =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "PENDING_CUSTOMER"
  | "PENDING_VENDOR"
  | "MITIGATED"
  | "VERIFIED_RESOLVED"
  | "ACCEPTED"
  | "SUPPRESSED"
  | "REOPENED";

export type MetricCategory =
  | "Security"
  | "Reliability"
  | "Experience"
  | "Coverage"
  | "Compliance";

export type Criticality = "Critical" | "High" | "Medium" | "Low";

export type CustomerTier = "Strategic" | "Enterprise" | "Core" | "Foundation";

/**
 * Vendor-neutral capability. A customer only carries metrics for capabilities
 * it is contracted for (CustomerCapability). Uncontracted capabilities produce
 * NOT_PURCHASED and are excluded from both health and coverage.
 */
export type Capability =
  | "endpoint_management"
  | "edr"
  | "identity_security"
  | "m365_security"
  | "mdr"
  | "backup"
  | "network_management"
  | "documentation"
  | "service_management"
  | "grc";

// ---------------------------------------------------------------------------
// Metric definitions (METRIC_CATALOG.md + PRD-004 required fields)
// ---------------------------------------------------------------------------

export interface MetricDefinition {
  id: string;
  name: string;
  category: MetricCategory;
  capability: Capability;
  source: string;
  target: string;
  criticality: Criticality;
  /** Base weight before customer overrides; derived from criticality. */
  weight: number;
  /** Evidence older than this (hours) is treated as DATA_STALE. */
  freshnessThresholdHours: number;
  businessRisk: string;
  remediation: string;
  /** Role that typically owns remediation. */
  ownerRole: string;
  /** Whether a population (expected vs observed) drives this metric. */
  populationBased: boolean;
  version: string;
}

// ---------------------------------------------------------------------------
// Customers & observations
// ---------------------------------------------------------------------------

export interface Customer {
  id: string;
  tenantId: string;
  displayName: string;
  tier: CustomerTier;
  industry: string;
  employeeCount: number;
  /** Managed population weight input (endpoints + identities + servers). */
  managedPopulation: number;
  accountOwner: string;
  serviceManager: string;
  /** 1 (low) to 5 (mission critical) — business criticality multiplier input. */
  criticality: number;
  /** Capabilities the customer is contracted for. */
  contractedCapabilities: Capability[];
  onboardingDate: string;
}

/**
 * A metric evaluation for a customer at a point in time. `value` is the 0..1
 * partial score for percentage metrics (used when state === "PARTIAL").
 */
export interface MetricObservation {
  customerId: string;
  metricId: string;
  state: MetricState;
  /** 0..1 partial score; only meaningful for PARTIAL. */
  value: number;
  observedAt: string;
  ageHours: number;
  source: string;
  /** Expected population for population-based metrics. */
  populationExpected: number;
  /** Observed / reporting population. */
  populationObserved: number;
  /** Confidence inputs, each 0..1. */
  sourceReliability: number;
  evidenceQuality: number;
  /** Human-readable evidence line for drill-downs (TV-safe wording lives elsewhere). */
  evidenceNote: string;
}

export interface Integration {
  customerId: string;
  type: string;
  capability: Capability;
  state: IntegrationState;
  lastSuccessAgeHours: number;
  failureCount: number;
  critical: boolean;
}

// ---------------------------------------------------------------------------
// Scoring outputs
// ---------------------------------------------------------------------------

export interface CategoryScore {
  category: MetricCategory;
  score: number; // 0..100
  weight: number;
  scorableMetricCount: number;
}

export interface CustomerScores {
  customerId: string;
  health: number; // 0..100
  coverage: number; // 0..100
  confidence: number; // 0..1
  categoryScores: CategoryScore[];
  /** Metrics that are applicable but have no usable evidence. */
  unverifiedCriticalControls: number;
  scorableMetricCount: number;
  applicableMetricCount: number;
  /** 30-day (mock) deltas for trend display. */
  healthDelta30d: number;
  coverageDelta30d: number;
  health7dChange: number;
}

// ---------------------------------------------------------------------------
// Risk events & recommendations (PRD-006, risk-event.schema.json)
// ---------------------------------------------------------------------------

export interface Finding {
  id: string;
  customerId: string;
  metricId: string;
  state: MetricState;
  severity: number; // 0..1 derived from criticality + state
  observedAt: string;
}

export interface Recommendation {
  id: string;
  riskEventId: string;
  action: string;
  suggestedOwnerRole: string;
  estimatedEffortHours: number;
  expectedHealthImprovement: number; // points
  expectedRiskReduction: number; // 0..1
  requiresHumanApproval: boolean;
}

export interface PriorityBreakdown {
  severity: number;
  businessCriticality: number;
  exposure: number;
  trend: number;
  age: number;
  population: number;
  confidence: number;
  responsibility: number;
  boosts: { label: string; factor: number }[];
  reductions: { label: string; factor: number }[];
  /** Raw product before normalization. */
  raw: number;
}

export interface RiskEvent {
  id: string;
  customerId: string;
  title: string;
  capability: Capability;
  category: MetricCategory;
  state: RiskEventState;
  priorityScore: number; // 0..1000
  priorityBand: "Critical" | "High" | "Medium" | "Low";
  businessImpact: string;
  /** TV-safe short reason. */
  primaryReason: string;
  confidence: number; // 0..1
  findingIds: string[];
  metricIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  ageDays: number;
  recurrenceCount: number;
  trend: "improving" | "flat" | "worsening";
  owner: string | null;
  /** Verification gate: an event only resolves when this observation passes. */
  verificationMetricId: string | null;
  verificationSatisfied: boolean;
  recommendation: Recommendation;
  breakdown: PriorityBreakdown;
  /** Inclusion reasons for the TV top-10 (TV_DASHBOARD_SPEC inclusion rules). */
  tvInclusionReasons: string[];
}

// ---------------------------------------------------------------------------
// Portfolio & dashboard
// ---------------------------------------------------------------------------

export interface ImpactBreakdown {
  verifiedRiskReduction: number;
  healthImprovement: number;
  coverageImprovement: number;
  recurrencePrevention: number;
  durableControlImprovement: number;
  /** Composite 0..100. */
  total: number;
}

export interface PortfolioScores {
  health: number;
  coverage: number;
  confidence: number;
  impact: ImpactBreakdown;
  customersBelowThreshold: number;
  criticalUnverifiedControls: number;
  unhealthyIntegrations: number;
  risksResolvedThisMonth: number;
  coverageGainedThisMonth: number;
  recurrencesPrevented: number;
  healthDelta30d: number;
  coverageDelta30d: number;
}

export interface AttentionRow {
  rank: number;
  customer: Customer;
  scores: CustomerScores;
  topEvent: RiskEvent;
  priorityScore: number;
  priorityBand: RiskEvent["priorityBand"];
  primaryReason: string;
  owner: string | null;
  riskAgeDays: number;
  health7dChange: number;
  nextBestAction: string;
  expectedImprovement: number;
  inclusionReasons: string[];
}

export interface VerifiedWin {
  customer: string;
  description: string;
  impactPoints: number;
}

export interface CommandCenterData {
  generatedAt: string;
  operatingDay: string;
  dataFreshnessHours: number;
  portfolio: PortfolioScores;
  topAttention: AttentionRow[];
  verifiedWins: VerifiedWin[];
}
