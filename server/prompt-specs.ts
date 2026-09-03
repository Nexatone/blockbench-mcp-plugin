import { z } from "zod";
import type { PromptSpec } from "@/lib/factories";

export const strategyArguments = z.object({
  format: z.string().optional().describe("Native format ID; inspect get_project_capabilities for available formats."),
  approach: z.enum(["ui", "programmatic", "import", "geometry"]).optional(),
});
export const promptDocs: PromptSpec[] = [
  { name: "blockbench_native_apis", description: "Concise native module and permission reference for Blockbench 5.1.6 plugin code.", argsSchema: z.object({}), status: "stable" },
  { name: "blockbench_code_eval_safety", description: "Execution contract, state checks and Undo requirements for the risky_eval escape hatch.", argsSchema: z.object({}), status: "stable" },
  { name: "model_creation_strategy", title: "Model Creation Strategy", description: "Efficient native modeling workflow with optional format and approach guidance.", argsSchema: strategyArguments, status: "stable" },
  { name: "hytale_model_creation", title: "Hytale Model Creation Guide", description: "Format-aware Hytale modeling workflow; requires the optional Hytale plugin.", argsSchema: z.object({ format_type: z.enum(["character", "prop", "both"]).optional().default("both") }), status: "experimental" },
  { name: "hytale_animation_workflow", title: "Hytale Animation Workflow", description: "Native Hytale animation workflow and schema-compatible keyframe guidance.", argsSchema: z.object({ animation_type: z.enum(["walk", "idle", "attack", "general"]).optional().default("general") }), status: "experimental" },
  { name: "hytale_attachments", title: "Hytale Attachments System", description: "Discover and configure Hytale attachments and pieces using registered resources.", argsSchema: z.object({}), status: "experimental" },
];
