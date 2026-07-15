import type { Capability, Customer, CustomerTier, MetricState } from "@/lib/types";
import { stableId } from "@/lib/util/rng";

export const TENANT_ID = stableId("tenant|edgefi");

/** A scripted override applied on top of the deterministic generator. */
export interface Condition {
  metricId: string;
  state: MetricState;
  value?: number;
  populationObserved?: number;
  populationExpected?: number;
  ageHours?: number;
  sourceReliability?: number;
  evidenceQuality?: number;
  note?: string;
}

export interface RosterEntry {
  key: string;
  displayName: string;
  tier: CustomerTier;
  industry: string;
  employeeCount: number;
  managedPopulation: number;
  accountOwner: string;
  serviceManager: string;
  criticality: number; // 1..5
  /** Capabilities the customer is contracted for. */
  contractedCapabilities: Capability[];
  onboardingDate: string;
  /** 0..1 baseline pass propensity for generated observations. */
  baseHealth: number;
  /** Mock trend inputs for display. */
  health7dChange: number;
  healthDelta30d: number;
  coverageDelta30d: number;
  /** Scripted conditions (acceptance scenarios + realism). */
  conditions: Condition[];
  /** Per-capability operational flags. */
  ownerByCapability?: Partial<Record<Capability, string>>;
  trendByCapability?: Partial<Record<Capability, "improving" | "flat" | "worsening">>;
  ageDaysByCapability?: Partial<Record<Capability, number>>;
  recurrenceByCapability?: Partial<Record<Capability, number>>;
  execEscalationCapabilities?: Capability[];
  fundedRemediationCapabilities?: Capability[];
  exceptionMetrics?: string[];
  compensatingControlMetrics?: string[];
  mitigatedCapabilities?: Capability[];
}

const ALL_CAPS: Capability[] = [
  "endpoint_management",
  "edr",
  "identity_security",
  "m365_security",
  "mdr",
  "backup",
  "network_management",
  "documentation",
  "service_management",
  "grc",
];

/** Capabilities minus GRC (most SMB customers don't buy a GRC program). */
const CORE_CAPS: Capability[] = ALL_CAPS.filter((c) => c !== "grc");

export const ROSTER: RosterEntry[] = [
  // --- Acceptance scenario 1: failed production backups → top ten ---------
  {
    key: "harborview",
    displayName: "Harborview Health",
    tier: "Strategic",
    industry: "Healthcare",
    employeeCount: 640,
    managedPopulation: 820,
    accountOwner: "D. Reyes",
    serviceManager: "K. Osei",
    criticality: 5,
    contractedCapabilities: ALL_CAPS,
    onboardingDate: "2023-02-01",
    baseHealth: 0.98,
    health7dChange: -6,
    healthDelta30d: -4,
    coverageDelta30d: 1,
    conditions: [
      { metricId: "BACKUP-002", state: "FAIL", note: "12 of 46 backup jobs failing" },
      { metricId: "BACKUP-003", state: "FAIL", note: "Primary file server backup failed 31h ago" },
    ],
    ownerByCapability: { backup: "K. Osei" },
    trendByCapability: { backup: "worsening" },
    ageDaysByCapability: { backup: 2 },
  },

  // --- Acceptance scenario 2: missing CrowdStrike data --------------------
  {
    key: "cascade",
    displayName: "Cascade Manufacturing",
    tier: "Enterprise",
    industry: "Manufacturing",
    employeeCount: 410,
    managedPopulation: 530,
    accountOwner: "P. Novak",
    serviceManager: "L. Tran",
    criticality: 4,
    contractedCapabilities: ALL_CAPS,
    onboardingDate: "2023-06-15",
    baseHealth: 0.96,
    health7dChange: -1,
    healthDelta30d: 0,
    coverageDelta30d: -7,
    conditions: [
      {
        metricId: "EDR-001",
        state: "EXPECTED_DATA_MISSING",
        note: "CrowdStrike API returning no sensor inventory",
      },
      {
        metricId: "EDR-002",
        state: "EXPECTED_DATA_MISSING",
        note: "No sensor health telemetry received",
      },
    ],
    ownerByCapability: { edr: "L. Tran" },
    trendByCapability: { edr: "worsening" },
    ageDaysByCapability: { edr: 1 },
  },

  // --- Acceptance scenario 3: closed ticket, backup not yet verified ------
  {
    key: "summit",
    displayName: "Summit Financial",
    tier: "Enterprise",
    industry: "Financial Services",
    employeeCount: 220,
    managedPopulation: 300,
    accountOwner: "D. Reyes",
    serviceManager: "K. Osei",
    criticality: 4,
    contractedCapabilities: ALL_CAPS,
    onboardingDate: "2022-11-01",
    baseHealth: 0.97,
    health7dChange: 1,
    healthDelta30d: 2,
    coverageDelta30d: 0,
    conditions: [
      {
        metricId: "BACKUP-002",
        state: "FAIL",
        note: "Remediation ticket closed; awaiting first successful job",
      },
    ],
    ownerByCapability: { backup: "K. Osei" },
    trendByCapability: { backup: "improving" },
    ageDaysByCapability: { backup: 4 },
    mitigatedCapabilities: ["backup"],
    fundedRemediationCapabilities: ["backup"],
  },

  // --- Acceptance scenario 4: no ControlMap contract → not penalized ------
  {
    key: "cedar",
    displayName: "Cedar Legal Group",
    tier: "Core",
    industry: "Legal",
    employeeCount: 95,
    managedPopulation: 130,
    accountOwner: "P. Novak",
    serviceManager: "L. Tran",
    criticality: 3,
    contractedCapabilities: CORE_CAPS, // no GRC
    onboardingDate: "2024-01-20",
    baseHealth: 0.99,
    health7dChange: 0,
    healthDelta30d: 1,
    coverageDelta30d: 0,
    conditions: [],
  },

  // --- Acceptance scenario 5: stale Microsoft Graph connector -------------
  {
    key: "meridian",
    displayName: "Meridian Logistics",
    tier: "Enterprise",
    industry: "Transportation",
    employeeCount: 310,
    managedPopulation: 400,
    accountOwner: "D. Reyes",
    serviceManager: "K. Osei",
    criticality: 3,
    contractedCapabilities: ALL_CAPS,
    onboardingDate: "2023-09-10",
    baseHealth: 0.96,
    health7dChange: -2,
    healthDelta30d: -1,
    coverageDelta30d: -3,
    conditions: [
      {
        metricId: "IDENTITY-001",
        state: "DATA_STALE",
        ageHours: 96,
        sourceReliability: 0.6,
        note: "Microsoft Graph collector last succeeded 4 days ago",
      },
      {
        metricId: "IDENTITY-002",
        state: "DATA_STALE",
        ageHours: 96,
        sourceReliability: 0.6,
        note: "Microsoft Graph collector stale",
      },
      {
        metricId: "IDENTITY-003",
        state: "DATA_STALE",
        ageHours: 96,
        sourceReliability: 0.6,
      },
    ],
    ownerByCapability: { identity_security: "K. Osei" },
    trendByCapability: { identity_security: "worsening" },
    ageDaysByCapability: { identity_security: 4 },
  },

  // --- Additional portfolio customers -------------------------------------
  {
    key: "ironclad",
    displayName: "Ironclad Defense Sys.",
    tier: "Strategic",
    industry: "Defense",
    employeeCount: 780,
    managedPopulation: 950,
    accountOwner: "P. Novak",
    serviceManager: "L. Tran",
    criticality: 5,
    contractedCapabilities: ALL_CAPS,
    onboardingDate: "2022-05-01",
    baseHealth: 0.82,
    health7dChange: -8,
    healthDelta30d: -6,
    coverageDelta30d: 2,
    conditions: [
      { metricId: "IDENTITY-001", state: "FAIL", note: "2 privileged accounts without MFA" },
      { metricId: "IDENTITY-005", state: "FAIL", note: "Unresolved critical risky sign-in" },
      { metricId: "PATCH-002", state: "FAIL", populationObserved: 4 },
    ],
    ownerByCapability: { identity_security: "L. Tran" },
    trendByCapability: { identity_security: "worsening", endpoint_management: "worsening" },
    ageDaysByCapability: { identity_security: 6, endpoint_management: 12 },
    recurrenceByCapability: { identity_security: 2 },
    execEscalationCapabilities: ["identity_security"],
  },
  {
    key: "brightpath",
    displayName: "BrightPath Education",
    tier: "Core",
    industry: "Education",
    employeeCount: 160,
    managedPopulation: 240,
    accountOwner: "D. Reyes",
    serviceManager: "K. Osei",
    criticality: 2,
    contractedCapabilities: CORE_CAPS,
    onboardingDate: "2024-03-15",
    baseHealth: 0.88,
    health7dChange: -3,
    healthDelta30d: -2,
    coverageDelta30d: -1,
    conditions: [
      { metricId: "PATCH-001", state: "PARTIAL", value: 0.86 },
      { metricId: "DEVICE-001", state: "PARTIAL", value: 0.9 },
    ],
    trendByCapability: { endpoint_management: "worsening" },
    ageDaysByCapability: { endpoint_management: 9 },
  },
  {
    key: "northwind",
    displayName: "Northwind Retail",
    tier: "Core",
    industry: "Retail",
    employeeCount: 300,
    managedPopulation: 520,
    accountOwner: "P. Novak",
    serviceManager: "L. Tran",
    criticality: 3,
    contractedCapabilities: CORE_CAPS,
    onboardingDate: "2023-12-01",
    baseHealth: 0.95,
    health7dChange: 2,
    healthDelta30d: 3,
    coverageDelta30d: 1,
    conditions: [
      { metricId: "NETWORK-003", state: "FAIL", note: "Store-7 gateway alert open" },
    ],
    ownerByCapability: { network_management: "L. Tran" },
    trendByCapability: { network_management: "flat" },
    ageDaysByCapability: { network_management: 2 },
    compensatingControlMetrics: ["NETWORK-003"],
  },
  {
    key: "lumen",
    displayName: "Lumen Biosciences",
    tier: "Enterprise",
    industry: "Biotech",
    employeeCount: 240,
    managedPopulation: 330,
    accountOwner: "D. Reyes",
    serviceManager: "K. Osei",
    criticality: 4,
    contractedCapabilities: ALL_CAPS,
    onboardingDate: "2023-04-01",
    baseHealth: 0.98,
    health7dChange: 3,
    healthDelta30d: 4,
    coverageDelta30d: 2,
    conditions: [{ metricId: "GRC-002", state: "FAIL", note: "3 overdue control evidences" }],
    ownerByCapability: { grc: "K. Osei" },
    trendByCapability: { grc: "improving" },
    ageDaysByCapability: { grc: 15 },
  },
  {
    key: "atlas",
    displayName: "Atlas Construction",
    tier: "Foundation",
    industry: "Construction",
    employeeCount: 70,
    managedPopulation: 90,
    accountOwner: "P. Novak",
    serviceManager: "L. Tran",
    criticality: 2,
    contractedCapabilities: CORE_CAPS.filter((c) => c !== "mdr"),
    onboardingDate: "2024-08-01",
    baseHealth: 0.85,
    health7dChange: -1,
    healthDelta30d: 0,
    coverageDelta30d: -2,
    conditions: [{ metricId: "DEVICE-004", state: "FAIL", note: "SMART alert on server drive" }],
    ownerByCapability: { endpoint_management: "L. Tran" },
    ageDaysByCapability: { endpoint_management: 3 },
  },
  {
    key: "vantage",
    displayName: "Vantage Insurance",
    tier: "Enterprise",
    industry: "Insurance",
    employeeCount: 350,
    managedPopulation: 470,
    accountOwner: "D. Reyes",
    serviceManager: "K. Osei",
    criticality: 4,
    contractedCapabilities: ALL_CAPS,
    onboardingDate: "2022-09-15",
    baseHealth: 0.99,
    health7dChange: 1,
    healthDelta30d: 1,
    coverageDelta30d: 0,
    conditions: [],
  },
  {
    key: "pinnacle",
    displayName: "Pinnacle Realty",
    tier: "Foundation",
    industry: "Real Estate",
    employeeCount: 55,
    managedPopulation: 70,
    accountOwner: "P. Novak",
    serviceManager: "L. Tran",
    criticality: 1,
    contractedCapabilities: CORE_CAPS.filter((c) => c !== "mdr" && c !== "network_management"),
    onboardingDate: "2025-01-10",
    baseHealth: 0.97,
    health7dChange: 0,
    healthDelta30d: 1,
    coverageDelta30d: 0,
    conditions: [{ metricId: "HALO-005", state: "PARTIAL", value: 0.9 }],
  },
  {
    key: "everest",
    displayName: "Everest Capital",
    tier: "Strategic",
    industry: "Financial Services",
    employeeCount: 190,
    managedPopulation: 260,
    accountOwner: "D. Reyes",
    serviceManager: "K. Osei",
    criticality: 5,
    contractedCapabilities: ALL_CAPS,
    onboardingDate: "2021-10-01",
    baseHealth: 0.99,
    health7dChange: 0,
    healthDelta30d: 0,
    coverageDelta30d: 1,
    conditions: [{ metricId: "M365-002", state: "EXCEPTION_ACTIVE", note: "Approved forwarding exception for CFO" }],
    exceptionMetrics: ["M365-002"],
  },
  {
    key: "delta",
    displayName: "Delta Media Group",
    tier: "Core",
    industry: "Media",
    employeeCount: 130,
    managedPopulation: 175,
    accountOwner: "P. Novak",
    serviceManager: "L. Tran",
    criticality: 2,
    contractedCapabilities: CORE_CAPS,
    onboardingDate: "2024-05-01",
    baseHealth: 0.87,
    health7dChange: -4,
    healthDelta30d: -3,
    coverageDelta30d: -1,
    conditions: [
      { metricId: "HALO-002", state: "FAIL", note: "Critical ticket beyond SLA" },
      { metricId: "HALO-004", state: "PARTIAL", value: 0.7 },
    ],
    ownerByCapability: { service_management: "L. Tran" },
    trendByCapability: { service_management: "worsening" },
    ageDaysByCapability: { service_management: 5 },
  },
];
