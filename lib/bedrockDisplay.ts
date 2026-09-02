interface ProjectSaveEvent {
  model: {
    meta?: { model_format?: string };
    display?: Record<string, Record<string, unknown>>;
  };
}

/** Preserve the Bedrock GUI flag omitted by DisplaySlot.export() in BB 5.1.6. */
export function setupBedrockDisplayPersistence(): () => void {
  const onSave = ({ model }: ProjectSaveEvent): void => {
    if (model.meta?.model_format !== "bedrock_block" || !model.display?.gui) return;
    const gui = Project?.display_settings.gui;
    if (gui && "fit_to_frame" in gui && typeof gui.fit_to_frame === "boolean") {
      model.display.gui.fit_to_frame = gui.fit_to_frame;
    }
  };
  // The native project codec emits this for both File > Save and MCP compile.
  // DisplaySlot.extend() already reads the field on project load.
  Blockbench.on("save_project", onSave);
  return () => { Blockbench.removeListener("save_project", onSave); };
}
