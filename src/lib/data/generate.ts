import type {
  Capability,
  Customer,
  Integration,
  IntegrationState,
  MetricDefinition,
  MetricObservation,
} from "@/lib/types";
import { METRIC_CATALOG } from "@/lib/metrics/catalog";
import { hash32, mulberry32, stableId } from "@/lib/util/rng";
import { TENANT_ID, type Condition, type RosterEntry } from "@/lib/data/roster";

/** Fixed reference time so all generated data (and tests) are reproducible. */
export const REFERENCE_NOW = "2026-07-14T14:00:00.000Z";
const NOW_MS = Date.parse(REFERENCE_NOW);

/** Percentage metrics emit a PARTIAL value; everything else is pass/fail. */
function isPercentageMetric(def: MetricDefinition): boolean {
  return def.populationBased || def.id === "M365-001" || def.id === "HALO-005";
}

/** Parse a pass threshold (0..1) from the metric's target text. */
function passThreshold(def: MetricDefinition): number {
  const pct = def.target.match(/(\d+(?:\.\d+)?)%/);
  if (pct) {
    const t = parseFloat(pct[1]) / 100;
    return Math.min(t, 0.98); // allow 100% targets to still PASS in practice
  }
  return 0.95;
}

function toCustomer(entry: RosterEntry): Customer {
  return {
    id: stableId(`customer|${entry.key}`),
    tenantId: TENANT_ID,
    displayName: entry.displayName,
    tier: entry.tier,
    industry: entry.industry,
    employeeCount: entry.employeeCount,
    managedPopulation: entry.managedPopulation,
    accountOwner: entry.accountOwner,
    serviceManager: entry.serviceManager,
    criticality: entry.criticality,
    contractedCapabilities: entry.contractedCapabilities,
    onboardingDate: entry.onboardingDate,
  };
}

function baseObservation(
  customerId: string,
  def: MetricDefinition,
  entry: RosterEntry,
): MetricObservation {
  const rng = mulberry32(hash32(`${entry.key}|${def.id}`));
  const contracted = entry.contractedCapabilities.includes(def.capability);

  const ageHours = Math.round(rng() * def.freshnessThresholdHours * 0.5 * 10) / 10;
  const sourceReliability = Math.round((0.9 + rng() * 0.09) * 100) / 100;
  const evidenceQuality = Math.round((0.9 + rng() * 0.09) * 100) / 100;
  const observedAt = new Date(NOW_MS - ageHours * 3600000).toISOString();

  if (!contracted) {
    return {
      customerId,
      metricId: def.id,
      state: "NOT_PURCHASED",
      value: 0,
      observedAt: REFERENCE_NOW,
      ageHours: 0,
      source: def.source,
      populationExpected: 0,
      populationObserved: 0,
      sourceReliability: 1,
      evidenceQuality: 1,
      evidenceNote: "Capability not contracted",
    };
  }

  const populationExpected = def.populationBased
    ? Math.max(1, Math.round(entry.managedPopulation * populationFactor(def.capability)))
    : 0;

  if (isPercentageMetric(def)) {
    const value = clampUnit(entry.baseHealth + (rng() - 0.4) * 0.12);
    const threshold = passThreshold(def);
    const state = value >= threshold ? "PASS" : "PARTIAL";
    const populationObserved = def.populationBased
      ? Math.round(populationExpected * value)
      : 0;
    return {
      customerId,
      metricId: def.id,
      state,
      value: Math.round(value * 1000) / 1000,
      observedAt,
      ageHours,
      source: def.source,
      populationExpected,
      populationObserved,
      sourceReliability,
      evidenceQuality,
      evidenceNote:
        state === "PASS"
          ? `${Math.round(value * 100)}% meets ${def.target}`
          : `${Math.round(value * 100)}% below ${def.target}`,
    };
  }

  // Binary / count metric.
  const pass = rng() < entry.baseHealth;
  return {
    customerId,
    metricId: def.id,
    state: pass ? "PASS" : "FAIL",
    value: pass ? 1 : 0,
    observedAt,
    ageHours,
    source: def.source,
    populationExpected,
    populationObserved: pass ? populationExpected : 0,
    sourceReliability,
    evidenceQuality,
    evidenceNote: pass ? `Meets target (${def.target})` : `Does not meet target (${def.target})`,
  };
}

function populationFactor(capability: Capability): number {
  switch (capability) {
    case "identity_security":
    case "m365_security":
      return 1.1; // identities can exceed device count
    case "endpoint_management":
    case "edr":
    case "mdr":
      return 1.0;
    case "backup":
      return 0.25; // servers / protected systems
    case "network_management":
      return 0.08;
    case "documentation":
    case "grc":
      return 0.3;
    default:
      return 0.5;
  }
}

function applyCondition(obs: MetricObservation, c: Condition, def: MetricDefinition): MetricObservation {
  const next: MetricObservation = { ...obs, state: c.state };
  if (c.value !== undefined) next.value = c.value;
  if (c.populationExpected !== undefined) next.populationExpected = c.populationExpected;
  if (c.populationObserved !== undefined) next.populationObserved = c.populationObserved;
  if (c.ageHours !== undefined) {
    next.ageHours = c.ageHours;
    next.observedAt = new Date(NOW_MS - c.ageHours * 3600000).toISOString();
  }
  if (c.sourceReliability !== undefined) next.sourceReliability = c.sourceReliability;
  if (c.evidenceQuality !== undefined) next.evidenceQuality = c.evidenceQuality;

  // Sensible defaults for evidence-quality by unverified state so confidence drops.
  switch (c.state) {
    case "EXPECTED_DATA_MISSING":
      if (c.evidenceQuality === undefined) next.evidenceQuality = 0;
      next.populationObserved = c.populationObserved ?? 0;
      next.value = 0;
      break;
    case "SOURCE_ERROR":
      if (c.evidenceQuality === undefined) next.evidenceQuality = 0.1;
      next.value = 0;
      break;
    case "DATA_STALE":
      if (c.ageHours === undefined) {
        next.ageHours = def.freshnessThresholdHours * 4;
        next.observedAt = new Date(NOW_MS - next.ageHours * 3600000).toISOString();
      }
      break;
    case "UNKNOWN":
      if (c.evidenceQuality === undefined) next.evidenceQuality = 0.2;
      next.value = 0;
      break;
    case "FAIL":
      next.value = 0;
      if (def.populationBased && c.populationObserved === undefined) {
        next.populationObserved = Math.round(next.populationExpected * 0.35);
      }
      break;
    case "PASS":
      next.value = 1;
      if (def.populationBased) next.populationObserved = next.populationExpected;
      break;
    default:
      break;
  }
  if (c.note) next.evidenceNote = c.note;
  return next;
}

export interface GeneratedCustomer {
  customer: Customer;
  observations: MetricObservation[];
  integrations: Integration[];
}

export function generateCustomer(entry: RosterEntry): GeneratedCustomer {
  const customer = toCustomer(entry);
  const conditionByMetric = new Map(entry.conditions.map((c) => [c.metricId, c]));

  const observations = METRIC_CATALOG.map((def) => {
    let obs = baseObservation(customer.id, def, entry);
    const cond = conditionByMetric.get(def.id);
    if (cond) obs = applyCondition(obs, cond, def);
    return obs;
  });

  const integrations = buildIntegrations(customer, observations, entry);
  return { customer, observations, integrations };
}

const CRITICAL_CAPS: Capability[] = [
  "edr",
  "backup",
  "identity_security",
  "service_management",
];

const VENDOR_BY_CAP: Record<Capability, string> = {
  endpoint_management: "NinjaOne",
  edr: "CrowdStrike",
  identity_security: "Microsoft Graph / Entra ID",
  m365_security: "Microsoft 365",
  mdr: "Huntress",
  backup: "MSP360",
  network_management: "UniFi / Meraki",
  documentation: "IT Glue",
  service_management: "HaloPSA",
  grc: "ControlMap",
};

function buildIntegrations(
  customer: Customer,
  observations: MetricObservation[],
  entry: RosterEntry,
): Integration[] {
  return customer.contractedCapabilities.map((cap) => {
    const capObs = observations.filter((o) => {
      const def = METRIC_CATALOG.find((m) => m.id === o.metricId);
      return def?.capability === cap;
    });
    let state: IntegrationState = "HEALTHY";
    let lastSuccessAgeHours = 1;
    let failureCount = 0;
    if (capObs.some((o) => o.state === "EXPECTED_DATA_MISSING")) {
      state = "OFFLINE";
      lastSuccessAgeHours = 26;
      failureCount = 6;
    } else if (capObs.some((o) => o.state === "SOURCE_ERROR")) {
      state = "AUTH_FAILED";
      lastSuccessAgeHours = 18;
      failureCount = 4;
    } else if (capObs.some((o) => o.state === "DATA_STALE")) {
      state = "DEGRADED";
      lastSuccessAgeHours = Math.max(...capObs.map((o) => o.ageHours), 48);
      failureCount = 2;
    }
    return {
      customerId: customer.id,
      type: VENDOR_BY_CAP[cap],
      capability: cap,
      state,
      lastSuccessAgeHours: Math.round(lastSuccessAgeHours * 10) / 10,
      failureCount,
      critical: CRITICAL_CAPS.includes(cap),
    };
  });
}

function clampUnit(n: number): number {
  return Math.max(0, Math.min(1, n));
}
