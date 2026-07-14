import type { EvidenceContext } from "@/lib/ai/evidence";
import type { GroundedResult, GroundingMetadata } from "@/lib/ai/schema";
import { REASONING_MODEL } from "@/lib/ai/schema";
import { getPrompt, systemPrompt, userContent, type TaskId } from "@/lib/ai/prompts";
import { callModel, isConfigured, ModelRefusalError } from "@/lib/ai/client";
import { validateOutput } from "@/lib/ai/validate";
import { deterministicReasoning } from "@/lib/ai/deterministic";

/**
 * Run a grounded reasoning task. Prefers the model when configured and its output
 * validates; otherwise falls back to the deterministic grounded assembler. Every
 * result carries full grounding metadata (AI_GOVERNANCE grounding requirements)
 * and a validation verdict. An invalid or refused model output never reaches the
 * caller — it is replaced by the deterministic result.
 */
export async function reason(taskId: TaskId, evidence: EvidenceContext): Promise<GroundedResult> {
  const prompt = getPrompt(taskId);

  const grounding = (engine: GroundingMetadata["engine"], finding_ids: string[]): GroundingMetadata => ({
    customer_id: evidence.customer_id,
    risk_event_id: evidence.risk_event_id,
    supporting_finding_ids: finding_ids,
    sources: evidence.sources,
    evidence_timestamps: evidence.evidence_timestamps,
    model_version: engine === "model" ? REASONING_MODEL : "deterministic-assembler",
    prompt_id: prompt.id,
    prompt_version: prompt.version,
    engine,
  });

  if (isConfigured()) {
    try {
      const output = await callModel(systemPrompt(taskId), userContent(taskId, evidence));
      const validation = validateOutput(output, evidence);
      if (validation.valid) {
        return { output, grounding: grounding("model", output.supporting_finding_ids), validation };
      }
      // Model output failed validation — fall through to the deterministic path.
    } catch (err) {
      if (!(err instanceof ModelRefusalError)) {
        // Network/parse/other error — degrade gracefully to deterministic.
      }
    }
  }

  const output = deterministicReasoning(taskId, evidence);
  const validation = validateOutput(output, evidence);
  return { output, grounding: grounding("deterministic", output.supporting_finding_ids), validation };
}
