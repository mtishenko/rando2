import type {
  ActionResult,
  AutomationAudit,
  AutomationPolicy,
  Executor,
  RunContext,
} from "@/lib/automation/types";
import { stableId } from "@/lib/util/rng";

/**
 * Automation engine (PRD-014). Guarantees: nothing executes outside an approved,
 * enabled, opted-in policy; remediation classes require explicit approval; dry-run
 * never executes; runs are idempotent by key; repeated failures auto-disable the
 * policy; and every action is audited with actor, policy, inputs, outputs, and
 * verification.
 */
export class AutomationEngine {
  private policies = new Map<string, AutomationPolicy>();
  private executed = new Set<string>(); // idempotency keys
  private rollbacks = new Map<string, () => Promise<void>>();
  private audit: AutomationAudit[] = [];

  registerPolicy(policy: AutomationPolicy): void {
    this.policies.set(policy.id, { ...policy });
  }

  getPolicy(id: string): AutomationPolicy | undefined {
    return this.policies.get(id);
  }

  auditLog(): AutomationAudit[] {
    return [...this.audit];
  }

  /** Whether a policy may run in this context — the "approved scope" gate. */
  evaluate(policy: AutomationPolicy, ctx: RunContext): { allowed: boolean; reason: string | null } {
    if (!policy.approved) return { allowed: false, reason: "policy not approved" };
    if (!policy.enabled) return { allowed: false, reason: "policy disabled" };
    if (!policy.customerOptIn) return { allowed: false, reason: "customer has not opted in" };
    if (policy.requiresApproval && !ctx.approval) {
      return { allowed: false, reason: "explicit human approval required" };
    }
    return { allowed: true, reason: null };
  }

  private record(a: AutomationAudit): AutomationAudit {
    this.audit.push(a);
    return a;
  }

  async run(
    policyId: string,
    inputs: Record<string, unknown>,
    ctx: RunContext,
    executor: Executor,
  ): Promise<ActionResult> {
    const policy = this.policies.get(policyId);
    const actionId = stableId(`action|${policyId}|${ctx.idempotencyKey}`);
    const baseAudit = {
      actionId,
      policyId,
      automationClass: policy?.automationClass ?? "notification",
      actor: ctx.actor,
      customerId: ctx.customerId,
      inputs,
      outputs: null as Record<string, unknown> | null,
      verification: null as boolean | null,
      approvedBy: ctx.approval?.approvedBy ?? null,
      timestamp: ctx.now,
    };

    if (!policy) {
      return { status: "blocked", rollbackAvailable: false, audit: this.record({ ...baseAudit, status: "blocked", reason: "unknown policy" }) };
    }

    // Idempotency — replaying the same key never re-executes.
    if (this.executed.has(ctx.idempotencyKey)) {
      return { status: "skipped", rollbackAvailable: this.rollbacks.has(actionId), audit: this.record({ ...baseAudit, status: "skipped", reason: "already executed (idempotent)" }) };
    }

    const gate = this.evaluate(policy, ctx);
    if (!gate.allowed) {
      return { status: "blocked", rollbackAvailable: false, audit: this.record({ ...baseAudit, status: "blocked", reason: gate.reason }) };
    }

    if (ctx.dryRun) {
      return { status: "dry_run", rollbackAvailable: false, audit: this.record({ ...baseAudit, status: "dry_run", outputs: { predicted: true, ...inputs }, reason: "dry run — not executed" }) };
    }

    try {
      const { outputs, verify, rollback } = await executor.execute(inputs);
      const verification = verify ? await verify() : null;
      if (rollback) this.rollbacks.set(actionId, rollback);
      this.executed.add(ctx.idempotencyKey);
      policy.consecutiveFailures = 0;
      return {
        status: "executed",
        rollbackAvailable: Boolean(rollback),
        audit: this.record({ ...baseAudit, status: "executed", outputs, verification, reason: null }),
      };
    } catch (err) {
      policy.consecutiveFailures += 1;
      if (policy.consecutiveFailures >= policy.autoDisableThreshold) {
        policy.enabled = false; // automatic disable after repeated failure
      }
      return {
        status: "failed",
        rollbackAvailable: false,
        audit: this.record({
          ...baseAudit,
          status: "failed",
          reason: err instanceof Error ? err.message : "execution error",
        }),
      };
    }
  }

  async rollback(actionId: string): Promise<boolean> {
    const fn = this.rollbacks.get(actionId);
    if (!fn) return false;
    await fn();
    this.rollbacks.delete(actionId);
    return true;
  }
}

/** Remediation classes require explicit per-run approval. */
export function requiresApproval(automationClass: AutomationPolicy["automationClass"]): boolean {
  return automationClass === "low_risk_remediation" || automationClass === "high_risk_remediation";
}
