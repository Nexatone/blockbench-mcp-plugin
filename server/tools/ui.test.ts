import { afterEach, expect, test } from "bun:test";
import { getAllToolDefinitions } from "@/lib/factories";
import { registerUITools } from "./ui";

registerUITools();
const globals = globalThis as unknown as Record<string, unknown>;
const prior = Object.getOwnPropertyDescriptors(globalThis);
afterEach(() => {
  for (const key of ["Project", "Undo", "evalFixture"]) {
    if (prior[key]) Object.defineProperty(globalThis, key, prior[key]);
    else delete globals[key];
  }
});
const execute = (code: string) => getAllToolDefinitions().risky_eval.execute({ code });

test("risky_eval runs without a project or access to the project-scoped Undo getter", async () => {
  globals.Project = 0;
  Object.defineProperty(globalThis, "Undo", {
    configurable: true,
    get() { throw new Error("No project Undo system"); },
  });
  expect(await execute("Promise.resolve(6 * 7)")).toBe("42");
  expect(await execute("undefined")).toContain("no result was returned");
});

test("risky_eval inspection preserves active edits and does not discard redo", async () => {
  globals.Project = { saved: true };
  const save = {};
  const history = ["past", "redo"];
  let calls = 0;
  globals.Undo = { current_save: save, history, index: 1,
    initEdit() { calls++; }, finishEdit() { calls++; } };
  expect(await execute("Project.saved")).toBe("true");
  expect(calls).toBe(0);
  expect((globals.Undo as { current_save: object }).current_save).toBe(save);
  expect(history).toEqual(["past", "redo"]);
});

test("risky_eval leaves explicit Undo transactions to the caller", async () => {
  globals.Project = {};
  const calls: unknown[] = [];
  globals.Undo = {
    initEdit(aspects: unknown) { calls.push(aspects); },
    finishEdit(label: string) { calls.push(label); },
  };
  expect(await execute('Undo.initEdit({display_slots: ["gui"]}); Undo.finishEdit("Display edit"); true')).toBe("true");
  expect(calls).toEqual([{ display_slots: ["gui"] }, "Display edit"]);
});

test("risky_eval can create, switch and close projects without finalizing another Undo system", async () => {
  globals.Project = 0;
  globals.Undo = undefined;
  globals.evalFixture = { create() { globals.Project = { name: "new" }; }, close() { globals.Project = 0; } };
  expect(await execute('evalFixture.create(); Project.name')).toBe('"new"');
  expect(await execute("evalFixture.close(); 42")).toBe("42");
});

test("risky_eval rejects script errors for the MCP error boundary", async () => {
  globals.Project = 0;
  globals.Undo = undefined;
  await expect(execute('throw new Error("script failure")')).rejects.toThrow("script failure");
  await expect(execute('Promise.reject(new Error("async failure"))')).rejects.toThrow("async failure");
});
