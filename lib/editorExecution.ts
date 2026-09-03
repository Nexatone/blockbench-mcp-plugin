/** One queue for all MCP/UI tool invocations: Blockbench state is application-wide. */
export class EditorQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(work: () => Promise<T> | T, signal?: AbortSignal): Promise<T> {
    const result = this.tail.then(() => {
      signal?.throwIfAborted();
      return work();
    });
    this.tail = result.catch(() => { });
    return result;
  }
}

export const editorQueue = new EditorQueue();

/** Fail before replacing a human/native operation's in-progress Undo save. */
export function requireIdleEdit(): void {
  if (typeof Undo !== "undefined" && Undo?.current_save) {
    throw new Error("EDIT_IN_PROGRESS: finish the current editor operation before retrying.");
  }
}

/** Synchronous native commit. Never await while this transaction owns Undo. */
export function withUndoEdit<T>(label: string, aspects: UndoAspects, work: () => T, after?: () => UndoAspects): T {
  requireIdleEdit();
  const project = Project;
  const undo = Undo as typeof Undo & { current_selection_save?: unknown };
  const saved = project?.saved;
  const previousSelection = undo.current_selection_save;
  undo.initEdit(aspects);
  const ownedSave = undo.current_save;
  const ownedSelection = undo.current_selection_save;
  try {
    const result = work();
    if (result instanceof Promise) throw new Error("Native commits must be synchronous.");
    if (Project !== project || undo.current_save !== ownedSave) throw new Error("EDIT_CHANGED: native transaction ownership changed.");
    undo.finishEdit(label, after?.() ?? aspects);
    return result;
  } catch (error) {
    if (Project === project && undo.current_save === ownedSave) {
      // 5.1.6 supports revert_changes; bundled older types omit the parameter.
      (undo.cancelEdit as (revert: boolean) => void)(true);
      // Native cancelEdit reverts model data but leaves its selection save open.
      if (ownedSelection !== previousSelection && undo.current_selection_save === ownedSelection) {
        delete undo.current_selection_save;
      }
      if (project && saved !== undefined) project.saved = saved;
    }
    throw error;
  }
}
