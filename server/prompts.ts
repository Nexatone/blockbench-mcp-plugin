import { createPrompt, prompts } from "@/lib/factories";
import { getPromptContent } from "@/lib/promptLoader";
import { promptDocs, strategyArguments } from "./prompt-specs";

for (const spec of promptDocs.slice(0, 2)) createPrompt(spec.name, {
  ...spec, async generate() {
    return { messages: [{ role: "user", content: { type: "text", text: getPromptContent(spec.name) } }] };
  }
}, spec.status);

createPrompt("model_creation_strategy", {
  ...promptDocs[2], argsSchema: strategyArguments, async generate({ format, approach }) {
    const fragments = [getPromptContent("model_creation_" + (approach ?? "programmatic"))];
    if (format === "java_block") fragments.push(getPromptContent("java_block"));
    else if (format === "bedrock" || format === "bedrock_block") fragments.push(getPromptContent("bedrock_block"));
    return { messages: [{ role: "user", content: { type: "text", text: fragments.join("\n\n") } }] };
  }
});
export default prompts;
