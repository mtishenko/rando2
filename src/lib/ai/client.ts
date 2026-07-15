import Anthropic from "@anthropic-ai/sdk";
import { REASONING_MODEL, REASONING_JSON_SCHEMA, type ReasoningOutput } from "@/lib/ai/schema";

/**
 * Thin wrapper over the Anthropic Messages API for the reasoning layer. When no
 * credential is configured, `isConfigured()` returns false and callers fall back
 * to the deterministic grounded assembler — so the app runs end-to-end in dev.
 */

let cached: Anthropic | null = null;

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function getClient(): Anthropic {
  if (!cached) cached = new Anthropic();
  return cached;
}

export class ModelRefusalError extends Error {
  constructor(public category: string | null) {
    super(`Model refused (category: ${category ?? "unknown"})`);
    this.name = "ModelRefusalError";
  }
}

/**
 * Call the model for a grounded reasoning task. Uses structured outputs so the
 * response is guaranteed to match REASONING_JSON_SCHEMA, and adaptive thinking
 * for the reasoning itself. Throws ModelRefusalError on a safety refusal.
 */
export async function callModel(system: string, user: string): Promise<ReasoningOutput> {
  const client = getClient();
  const response = await client.messages.create({
    model: REASONING_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system,
    output_config: {
      format: { type: "json_schema", schema: REASONING_JSON_SCHEMA },
    },
    messages: [{ role: "user", content: user }],
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") {
    const detail = response.stop_details as { category?: string } | null;
    throw new ModelRefusalError(detail?.category ?? null);
  }

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  if (!textBlock) throw new Error("Model returned no text content");
  return JSON.parse(textBlock.text) as ReasoningOutput;
}
