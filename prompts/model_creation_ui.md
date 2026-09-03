# Native UI fallback

Start with project info, capabilities and a scoped query_model. Build geometry with typed batches before UI actions. trigger_action is a fallback for necessary native features missing from tools; check mode and selection first.

fill_dialog uses the actual open dialog's field IDs. Do not confirm unrelated dialogs. Use capture_app_screenshot for UI diagnosis and capture_screenshot for final model review. Synthetic clicks remain experimental and layout-dependent; avoid repeated screenshots between small edits.
