import { expect, test } from "bun:test";
import { setupBedrockDisplayPersistence } from "./bedrockDisplay";

test("Bedrock project save preserves GUI fit_to_frame without changing other formats or settings", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const prior = { Project: globals.Project, Blockbench: globals.Blockbench };
  type SaveEvent = { model: { meta?: { model_format?: string }; display?: Record<string, Record<string, unknown>> } };
  let listener: ((event: SaveEvent) => void) | undefined;
  const project = { display_settings: { gui: { fit_to_frame: true } } };
  Object.assign(globals, {
    Project: project,
    Blockbench: {
      on(event: string, fn: typeof listener) { expect(event).toBe("save_project"); listener = fn; },
      removeListener(event: string, fn: typeof listener) { expect(event).toBe("save_project"); expect(fn === listener).toBe(true); listener = undefined; },
    },
  });
  try {
    const teardown = setupBedrockDisplayPersistence();
    const gui: Record<string, unknown> = { rotation: [30, -135, 0] };
    const model = { meta: { model_format: "bedrock_block" }, display: { gui } };
    listener!({ model });
    expect(model.display.gui).toEqual({ rotation: [30, -135, 0], fit_to_frame: true });
    project.display_settings.gui.fit_to_frame = false;
    listener!({ model });
    expect(model.display.gui.fit_to_frame).toBe(false);
    for (const model_format of ["java_block", "bedrock", "free"]) {
      const other = { meta: { model_format }, display: { gui: {} } };
      listener!({ model: other });
      expect(other.display.gui).toEqual({});
    }
    const empty = { meta: { model_format: "bedrock_block" } };
    listener!({ model: empty });
    expect(empty).not.toHaveProperty("display");
    teardown();
    expect(listener).toBeUndefined();
  } finally { Object.assign(globals, prior); }
});
