import type { Wire } from './sim/model';
import { saveStoredProject, type ProjectSaveResult } from './storage';

export interface AutosaveDraft {
  name: string;
  wires: Wire[];
}

export interface ProjectAutosave {
  schedule: (draft: AutosaveDraft) => void;
  flush: () => void;
  dispose: () => void;
}

/** One pending autonomous draft; flush is synchronous before a page disappears. */
export function createProjectAutosave(
  onSaved: (result: ProjectSaveResult) => void,
  save: typeof saveStoredProject = saveStoredProject,
): ProjectAutosave {
  let pending: AutosaveDraft | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const cancelTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const flush = () => {
    cancelTimer();
    if (disposed || !pending) return;
    const draft = pending;
    pending = null;
    onSaved(save(draft.name, draft.wires));
  };
  return {
    schedule(draft) {
      if (disposed) return;
      cancelTimer();
      pending = draft;
      timer = setTimeout(flush, 500);
    },
    flush,
    dispose() {
      disposed = true;
      pending = null;
      cancelTimer();
    },
  };
}
