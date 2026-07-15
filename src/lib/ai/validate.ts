import type { EvidenceContext } from "@/lib/ai/evidence";
import type { ReasoningOutput, ValidationResult } from "@/lib/ai/schema";
import { hasSensitiveContent } from "@/lib/ai/redaction";

/**
 * Output validation (PRD-007 "unsupported claims are rejected"; AI_GOVERNANCE
 * grounding). Rejects outputs that cite unknown findings, leak sensitive content,
 * fail to ground an OK verdict, or under-flag high-impact approval.
 */
export function validateOutput(output: ReasoningOutput, evidence: EvidenceContext): ValidationResult {
  const issues: string[] = [];
  const allowed = new Set(evidence.allowed_finding_ids);

  // No cited finding may be outside the supplied evidence — this is the core
  // anti-fabrication check.
  for (const id of output.supporting_finding_ids) {
    if (!allowed.has(id)) issues.push(`Cites finding not in evidence: ${id}`);
  }

  // No sensitive content may appear in any free-text field.
  const textFields: [string, string][] = [
    ["summary", output.summary],
    ["business_impact", output.business_impact],
    ["technical_reasoning", output.technical_reasoning],
    ["recommended_action", output.recommended_action],
  ];
  for (const [field, value] of textFields) {
    if (hasSensitiveContent(value)) issues.push(`Sensitive content in ${field}`);
  }

  if (output.confidence < 0 || output.confidence > 1) {
    issues.push(`Confidence out of range: ${output.confidence}`);
  }

  if (output.status === "INSUFFICIENT_EVIDENCE") {
    if (output.missing_evidence.length === 0) {
      issues.push("INSUFFICIENT_EVIDENCE without listing missing evidence");
    }
  } else {
    // An OK verdict must be grounded in at least one supplied finding.
    if (evidence.allowed_finding_ids.length > 0 && output.supporting_finding_ids.length === 0) {
      issues.push("OK verdict cites no supporting evidence");
    }
    if (!output.summary.trim()) issues.push("Empty summary");
    if (!output.recommended_action.trim()) issues.push("Empty recommended_action");

    // High-impact findings must be gated behind human approval.
    const hasHighImpact = evidence.findings.some(
      (f) => f.criticality === "Critical" || f.criticality === "High",
    );
    if (hasHighImpact && !output.requires_human_approval) {
      issues.push("High-impact evidence must require human approval");
    }
  }

  return { valid: issues.length === 0, issues };
}
