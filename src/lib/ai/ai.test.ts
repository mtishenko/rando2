import { describe, it, expect } from "vitest";
import { redactText, hasSensitiveContent } from "@/lib/ai/redaction";
import { validateOutput } from "@/lib/ai/validate";
import { deterministicReasoning } from "@/lib/ai/deterministic";
import { buildRiskEventEvidence, type EvidenceContext } from "@/lib/ai/evidence";
import { reason } from "@/lib/ai/reason";
import { runEvaluation, type EvalCase } from "@/lib/ai/evaluate";
import { getPortfolioModel } from "@/lib/data/compute";
import type { ReasoningOutput } from "@/lib/ai/schema";

describe("Redaction", () => {
  it("strips emails, IPs, CVEs, hosts, and accounts", () => {
    const raw =
      "Alert on host dc01.corp.example.com (10.0.4.12) for user CORP\\jsmith, ref CVE-2026-1234, contact ops@example.com";
    const red = redactText(raw);
    expect(red).not.toContain("example.com");
    expect(red).not.toContain("10.0.4.12");
    expect(red).not.toContain("CVE-2026-1234");
    expect(red).not.toContain("jsmith");
    expect(red).toContain("[redacted:");
    expect(hasSensitiveContent(raw)).toBe(true);
    expect(hasSensitiveContent(red)).toBe(false);
  });
});

const emptyEvidence: EvidenceContext = {
  customer_id: "c1",
  customer_name: "Test Co",
  risk_event_id: null,
  capability: null,
  category: null,
  priority_score: null,
  priority_band: null,
  confidence: 0.5,
  findings: [],
  sources: [],
  evidence_timestamps: { earliest: null, latest: null },
  model_version: "test",
  allowed_finding_ids: [],
};

describe("Deterministic reasoning", () => {
  it("returns INSUFFICIENT_EVIDENCE when there are no findings", () => {
    const out = deterministicReasoning("change-explanation", emptyEvidence);
    expect(out.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(out.missing_evidence.length).toBeGreaterThan(0);
  });

  it("grounds an OK verdict in the supplied findings", () => {
    const pm = getPortfolioModel();
    const model = pm.customers.find((m) => m.events.length > 0)!;
    const evidence = buildRiskEventEvidence(model.events[0], model);
    const out = deterministicReasoning("change-explanation", evidence);
    expect(out.status).toBe("OK");
    // Every cited finding is from the evidence.
    const allowed = new Set(evidence.allowed_finding_ids);
    expect(out.supporting_finding_ids.every((id) => allowed.has(id))).toBe(true);
    expect(out.supporting_finding_ids.length).toBeGreaterThan(0);
    expect(validateOutput(out, evidence).valid).toBe(true);
  });
});

describe("Validation", () => {
  const base: ReasoningOutput = {
    status: "OK",
    summary: "ok",
    business_impact: "impact",
    technical_reasoning: "reasoning",
    recommended_action: "do the thing",
    estimated_effort_hours: 2,
    suggested_owner_role: "Security Engineer",
    confidence: 0.8,
    supporting_finding_ids: [],
    assumptions: [],
    missing_evidence: [],
    requires_human_approval: true,
  };

  it("rejects a cited finding that is not in the evidence", () => {
    const ev = { ...emptyEvidence, allowed_finding_ids: ["known"] };
    const out = { ...base, supporting_finding_ids: ["fabricated"] };
    const res = validateOutput(out, ev);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.includes("not in evidence"))).toBe(true);
  });

  it("rejects sensitive content that leaked into an output field", () => {
    const ev = { ...emptyEvidence, allowed_finding_ids: ["f1"] };
    const out = { ...base, supporting_finding_ids: ["f1"], summary: "host db01.corp.example.com is down" };
    const res = validateOutput(out, ev);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.includes("Sensitive content"))).toBe(true);
  });
});

describe("AI evaluation harness", () => {
  it("meets grounding, cleanliness, JSON, and status targets across the portfolio", async () => {
    const pm = getPortfolioModel();
    const cases: EvalCase[] = pm.customers
      .filter((m) => m.events.length > 0)
      .map((m) => ({
        taskId: "change-explanation" as const,
        evidence: buildRiskEventEvidence(m.events[0], m),
        expectStatus: "OK" as const,
      }));
    cases.push({ taskId: "change-explanation", evidence: emptyEvidence, expectStatus: "INSUFFICIENT_EVIDENCE" });

    const report = await runEvaluation(cases);
    expect(report.total).toBe(cases.length);
    expect(report.groundingAccuracy).toBe(1);
    expect(report.unsupportedClaimRate).toBe(0);
    expect(report.jsonComplianceRate).toBe(1);
    expect(report.statusAccuracy).toBe(1);
  });

  it("reason() returns full grounding metadata", async () => {
    const pm = getPortfolioModel();
    const model = pm.customers.find((m) => m.events.length > 0)!;
    const evidence = buildRiskEventEvidence(model.events[0], model);
    const { grounding } = await reason("change-explanation", evidence);
    expect(grounding.customer_id).toBe(model.customer.id);
    expect(grounding.risk_event_id).toBe(model.events[0].id);
    expect(grounding.prompt_id).toBe("change-explanation");
    expect(grounding.prompt_version).toBe("1.0.0");
    expect(["model", "deterministic"]).toContain(grounding.engine);
  });
});
