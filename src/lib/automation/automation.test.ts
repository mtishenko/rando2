import { describe, it, expect } from "vitest";
import { AutomationEngine, requiresApproval } from "@/lib/automation/engine";
import type { AutomationPolicy, Executor, RunContext } from "@/lib/automation/types";
import { REFERENCE_NOW } from "@/lib/data/generate";

function policy(over: Partial<AutomationPolicy> = {}): AutomationPolicy {
  return {
    id: "pol-1",
    name: "Test policy",
    automationClass: "notification",
    approved: true,
    enabled: true,
    customerOptIn: true,
    requiresApproval: false,
    autoDisableThreshold: 3,
    consecutiveFailures: 0,
    ...over,
  };
}

function ctx(over: Partial<RunContext> = {}): RunContext {
  return { actor: "svc-manager", customerId: "c1", now: REFERENCE_NOW, idempotencyKey: "k1", ...over };
}

const okExecutor: Executor = {
  async execute(inputs) {
    return { outputs: { done: true, ...inputs }, verify: async () => true, rollback: async () => {} };
  },
};

describe("Automation engine (PRD-014)", () => {
  it("executes an approved, opted-in notification and audits actor/policy/inputs/outputs/verification", async () => {
    const e = new AutomationEngine();
    e.registerPolicy(policy());
    const r = await e.run("pol-1", { message: "hi" }, ctx(), okExecutor);
    expect(r.status).toBe("executed");
    expect(r.audit.actor).toBe("svc-manager");
    expect(r.audit.policyId).toBe("pol-1");
    expect(r.audit.inputs).toEqual({ message: "hi" });
    expect(r.audit.outputs).toMatchObject({ done: true });
    expect(r.audit.verification).toBe(true);
  });

  it("blocks anything outside approved scope", async () => {
    const e = new AutomationEngine();
    e.registerPolicy(policy({ id: "unapproved", approved: false }));
    const r = await e.run("unapproved", {}, ctx(), okExecutor);
    expect(r.status).toBe("blocked");
    expect(r.audit.reason).toBe("policy not approved");
  });

  it("blocks when the customer has not opted in", async () => {
    const e = new AutomationEngine();
    e.registerPolicy(policy({ id: "no-optin", customerOptIn: false }));
    const r = await e.run("no-optin", {}, ctx(), okExecutor);
    expect(r.status).toBe("blocked");
    expect(r.audit.reason).toContain("opted in");
  });

  it("requires explicit approval for remediation classes", async () => {
    const e = new AutomationEngine();
    e.registerPolicy(
      policy({ id: "remediate", automationClass: "high_risk_remediation", requiresApproval: true }),
    );
    const blocked = await e.run("remediate", {}, ctx(), okExecutor);
    expect(blocked.status).toBe("blocked");
    expect(blocked.audit.reason).toContain("approval");

    const approved = await e.run(
      "remediate",
      {},
      ctx({ idempotencyKey: "k2", approval: { approvedBy: "ciso" } }),
      okExecutor,
    );
    expect(approved.status).toBe("executed");
    expect(approved.audit.approvedBy).toBe("ciso");
    expect(requiresApproval("high_risk_remediation")).toBe(true);
  });

  it("dry-run never executes", async () => {
    const e = new AutomationEngine();
    e.registerPolicy(policy());
    let executed = false;
    const spy: Executor = { async execute() { executed = true; return { outputs: {} }; } };
    const r = await e.run("pol-1", { a: 1 }, ctx({ dryRun: true }), spy);
    expect(r.status).toBe("dry_run");
    expect(executed).toBe(false);
    expect(r.audit.outputs).toMatchObject({ predicted: true });
  });

  it("is idempotent — the same key does not re-execute", async () => {
    const e = new AutomationEngine();
    e.registerPolicy(policy());
    let count = 0;
    const counting: Executor = { async execute() { count++; return { outputs: {} }; } };
    await e.run("pol-1", {}, ctx({ idempotencyKey: "same" }), counting);
    const second = await e.run("pol-1", {}, ctx({ idempotencyKey: "same" }), counting);
    expect(count).toBe(1);
    expect(second.status).toBe("skipped");
  });

  it("auto-disables a policy after repeated failures", async () => {
    const e = new AutomationEngine();
    e.registerPolicy(policy({ id: "flaky", autoDisableThreshold: 2 }));
    const failing: Executor = { async execute() { throw new Error("boom"); } };
    const r1 = await e.run("flaky", {}, ctx({ idempotencyKey: "f1" }), failing);
    expect(r1.status).toBe("failed");
    expect(e.getPolicy("flaky")!.enabled).toBe(true);
    const r2 = await e.run("flaky", {}, ctx({ idempotencyKey: "f2" }), failing);
    expect(r2.status).toBe("failed");
    expect(e.getPolicy("flaky")!.enabled).toBe(false); // disabled after 2
    const r3 = await e.run("flaky", {}, ctx({ idempotencyKey: "f3" }), failing);
    expect(r3.status).toBe("blocked");
    expect(r3.audit.reason).toBe("policy disabled");
  });

  it("supports rollback of an executed action", async () => {
    const e = new AutomationEngine();
    e.registerPolicy(policy());
    let rolledBack = false;
    const rbExecutor: Executor = {
      async execute() {
        return { outputs: {}, rollback: async () => { rolledBack = true; } };
      },
    };
    const r = await e.run("pol-1", {}, ctx(), rbExecutor);
    expect(r.rollbackAvailable).toBe(true);
    expect(await e.rollback(r.audit.actionId)).toBe(true);
    expect(rolledBack).toBe(true);
  });
});
