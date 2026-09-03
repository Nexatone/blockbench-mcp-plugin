# risky_eval execution contract

Prefer get_project_info, get_project_capabilities, query_model, get_element and apply_model_batch. Use risky_eval for necessary native operations missing from typed tools. Return small JSON-serializable values; never return Project or a rendering graph.

risky_eval executes with plugin privileges. Its lexical restrictions are not a sandbox. Current validation rejects comments and console calls; return inspection values directly. Example: ({version:Blockbench.version,project:Project?.uuid??null}).

There is no implicit Undo transaction or automatic rollback for arbitrary code. Validate targets and check the intended project and Undo.current_save before initEdit. Capture correct native Undo aspects, commit synchronously and finishEdit once. In 5.1.6, cancelEdit(true) reverts tracked changes; cancelEdit() alone only cancels history recording. Preserve unrelated projects and selection.

Never await while owning Undo. Stage I/O first, then recheck project identity and edit ownership. A timeout cannot interrupt synchronous JavaScript; bound loops and output. Consult the native API reference when module access is needed and respect permissions.
