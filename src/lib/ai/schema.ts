/**
 * Structured output contract for the AI reasoning layer (AI_GOVERNANCE.md +
 * prompts/change-explanation.md). Field names are snake_case to match the PRD
 * governance schema verbatim. Every reasoning output must validate against this.
 */

export type ReasoningStatus = "OK" | "INSUFFICIENT_EVIDENCE";

/** The model's own output — grounding metadata (IDs, sources, versions) is
 * attached deterministically by the reasoning layer, never by the model. */
export interface ReasoningOutput {
  status: ReasoningStatus;
  summary: string;
  business_impact: string;
  technical_reasoning: string;
  recommended_action: string;
  estimated_effort_hours: number;
  suggested_owner_role: string;
  confidence: number; // 0..1
  /** Finding IDs the output relies on — must be a subset of supplied evidence. */
  supporting_finding_ids: string[];
  assumptions: string[];
  /** Populated (with verification steps) when status is INSUFFICIENT_EVIDENCE. */
  missing_evidence: string[];
  requires_human_approval: boolean;
}

/** JSON Schema passed to the Messages API via output_config.format. Strict-mode
 * compatible: object types, arrays, enums, additionalProperties:false, all
 * required. No numeric/string constraints (unsupported by structured outputs). */
export const REASONING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["OK", "INSUFFICIENT_EVIDENCE"] },
    summary: { type: "string" },
    business_impact: { type: "string" },
    technical_reasoning: { type: "string" },
    recommended_action: { type: "string" },
    estimated_effort_hours: { type: "number" },
    suggested_owner_role: { type: "string" },
    confidence: { type: "number" },
    supporting_finding_ids: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    missing_evidence: { type: "array", items: { type: "string" } },
    requires_human_approval: { type: "boolean" },
  },
  required: [
    "status",
    "summary",
    "business_impact",
    "technical_reasoning",
    "recommended_action",
    "estimated_effort_hours",
    "suggested_owner_role",
    "confidence",
    "supporting_finding_ids",
    "assumptions",
    "missing_evidence",
    "requires_human_approval",
  ],
} as const;

/** Grounding metadata attached to every reasoning result (AI_GOVERNANCE grounding
 * requirements). Sourced from deterministic evidence, not the model. */
export interface GroundingMetadata {
  customer_id: string;
  risk_event_id: string | null;
  supporting_finding_ids: string[];
  sources: string[];
  evidence_timestamps: { earliest: string | null; latest: string | null };
  model_version: string;
  prompt_id: string;
  prompt_version: string;
  /** How the output was produced. */
  engine: "model" | "deterministic";
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export interface GroundedResult {
  output: ReasoningOutput;
  grounding: GroundingMetadata;
  validation: ValidationResult;
}

/** The reasoning model. Kept in one place so grounding metadata is consistent. */
export const REASONING_MODEL = "claude-opus-4-8";
