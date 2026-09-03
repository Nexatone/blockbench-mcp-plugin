import { createPrompt } from "@/lib/factories";
import { getPromptContent } from "@/lib/promptLoader";
import { isHytalePluginInstalled } from "@/lib/hytale";
import { promptDocs } from "../prompt-specs";

export function registerHytalePrompts(): void {
  if (!isHytalePluginInstalled()) return;
  for (const spec of promptDocs.slice(3)) createPrompt(spec.name, {
    ...spec, async generate(args) {
      const focus = args.format_type ?? args.animation_type;
      return { messages: [{ role: "user", content: { type: "text", text: getPromptContent(spec.name) + (focus ? "\nRequested focus: " + focus + "." : "") } }] };
    }
  }, spec.status);
}
