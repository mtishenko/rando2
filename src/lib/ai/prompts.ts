import type { EvidenceContext } from "@/lib/ai/evidence";

/**
 * Versioned prompt registry (PRD-007 "model and prompt versioning"). Published
 * prompt versions are immutable — bump the version to change behaviour. Every
 * prompt enforces the AI_GOVERNANCE contract: ground in supplied evidence only,
 * never mark pass/resolved, return strict JSON, escalate insufficient evidence.
 */

export type TaskId =
  | "change-explanation"
  | "risk-correlation"
  | "recommendation-draft"
  | "qbr-narrative";

interface PromptDef {
  id: TaskId;
  version: string;
  /** Task-specific instruction appended to the shared governance system prompt. */
  task: string;
}

const GOVERNANCE_SYSTEM = `You are the Edgefi Pulse reasoning layer.

Rules (these are hard constraints):
- Use ONLY the supplied evidence. Do not infer, assume, or invent facts not present in the evidence.
- You may summarize, correlate, translate technical evidence into business language, and suggest an owner, effort, and remediation.
- You MUST NOT mark any control as passed, mark any event resolved, change scope or applicability, or claim a fix is verified. Deterministic evaluation owns those.
- Never include usernames, hostnames, IP addresses, CVE identifiers, or other customer-confidential technical details in any field. The evidence is already redacted; keep it that way.
- Cite the finding IDs you relied on in supporting_finding_ids. Only cite IDs that appear in the supplied evidence.
- If the evidence is insufficient to answer, set status to "INSUFFICIENT_EVIDENCE" and list what is missing (with verification steps) in missing_evidence.
- High-impact remediation (Critical or High criticality) requires human approval: set requires_human_approval accordingly.
- Respond with a single JSON object matching the required schema. No prose outside the JSON.`;

const PROMPTS: Record<TaskId, PromptDef> = {
  "change-explanation": {
    id: "change-explanation",
    version: "1.0.0",
    task: "Explain why this risk event's priority, health, coverage, or confidence is what it is, grounded in the findings. Give a business-language summary and the technical reasoning.",
  },
  "risk-correlation": {
    id: "risk-correlation",
    version: "1.0.0",
    task: "Correlate the findings into a single coherent risk narrative. Identify the likely common cause and the business consequence if unaddressed.",
  },
  "recommendation-draft": {
    id: "recommendation-draft",
    version: "1.0.0",
    task: "Draft the next best action for this risk event, with a suggested owner role and effort estimate, grounded in the findings.",
  },
  "qbr-narrative": {
    id: "qbr-narrative",
    version: "1.0.0",
    task: "Draft an evidence-grounded QBR executive summary for this customer: current posture, the most material open risks, and recommended next-quarter priorities. Do not claim improvements that are not in the evidence.",
  },
};

export function getPrompt(id: TaskId): PromptDef {
  return PROMPTS[id];
}

export function systemPrompt(id: TaskId): string {
  return `${GOVERNANCE_SYSTEM}\n\nTask: ${PROMPTS[id].task}`;
}

/** The user turn: the redacted evidence package plus a restated instruction. */
export function userContent(id: TaskId, evidence: EvidenceContext): string {
  return [
    "Evidence (the only facts you may use):",
    JSON.stringify(evidence, null, 2),
    "",
    `Produce the ${id} output as strict JSON. Cite finding IDs from allowed_finding_ids only.`,
  ].join("\n");
}
