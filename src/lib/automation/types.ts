/**
 * Automation engine types (PRD-014). Actions run only inside an approved policy,
 * with opt-in, approval gating, dry-run, idempotency, rollback, audit, and
 * automatic disable after repeated failure.
 */

export type AutomationClass =
  | "notification"
  | "ticket_routing"
  | "evidence_collection"
  | "low_risk_remediation"
  | "high_risk_remediation";

export interface AutomationPolicy {
  id: string;
  name: string;
  automationClass: AutomationClass;
  /** Policy has been reviewed and approved for use. */
  approved: boolean;
  /** Currently enabled (auto-disabled after repeated failures). */
  enabled: boolean;
  /** The customer has opted in to this automation. */
  customerOptIn: boolean;
  /** Requires an explicit human approval on each run (remediation classes). */
  requiresApproval: boolean;
  autoDisableThreshold: number;
  consecutiveFailures: number;
}

export interface RunContext {
  actor: string;
  customerId: string;
  now: string;
  idempotencyKey: string;
  dryRun?: boolean;
  approval?: { approvedBy: string };
}

export type ActionStatus = "executed" | "blocked" | "dry_run" | "skipped" | "failed";

/** Immutable record of an automation action (PRD-014 audit requirement). */
export interface AutomationAudit {
  actionId: string;
  policyId: string;
  automationClass: AutomationClass;
  actor: string;
  customerId: string;
  status: ActionStatus;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown> | null;
  verification: boolean | null;
  reason: string | null;
  approvedBy: string | null;
  timestamp: string;
}

export interface ActionResult {
  status: ActionStatus;
  audit: AutomationAudit;
  rollbackAvailable: boolean;
}

/** The side-effecting operation. `verify` confirms the outcome; `rollback` undoes
 *  it where possible. Both are optional-to-succeed but recorded when present. */
export interface Executor {
  execute(inputs: Record<string, unknown>): Promise<{
    outputs: Record<string, unknown>;
    verify?: () => Promise<boolean>;
    rollback?: () => Promise<void>;
  }>;
}
