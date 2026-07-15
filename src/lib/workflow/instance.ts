import { WorkflowEngine } from "@/lib/workflow/engine";
import { InMemoryHaloClient } from "@/lib/workflow/halo";

/**
 * Process-wide workflow engine for the demo (in-memory HaloPSA). A production
 * deployment swaps InMemoryHaloClient for a real Halo REST client and persists
 * work items via the repository layer.
 */
export const haloClient = new InMemoryHaloClient();
export const workflowEngine = new WorkflowEngine(haloClient);
