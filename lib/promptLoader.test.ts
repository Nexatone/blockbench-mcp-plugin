import { expect, test } from "bun:test";
import bundled from "@/prompts/manifest.json";
import { getAvailablePromptNames, getPromptContent, initPromptLoader, setPromptOverride, clearPromptOverride } from "./promptLoader";

test("first offline initialization provides bundled prompts and honors overrides", async () => {
  await initPromptLoader(false);
  const name = Object.keys(bundled.prompts)[0] as keyof typeof bundled.prompts;
  expect(getAvailablePromptNames()).toContain(name);
  expect(getPromptContent(name)).toBe(bundled.prompts[name]);
  setPromptOverride(name, "Local customized prompt");
  expect(getPromptContent(name)).toBe("Local customized prompt");
  clearPromptOverride(name);
  expect(getPromptContent(name)).toBe(bundled.prompts[name]);
});
