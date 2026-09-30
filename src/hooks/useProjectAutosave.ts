import { useEffect, useRef } from 'react';
import type { Wire } from '../sim/model';
import type { ProjectSaveResult } from '../storage';
import { createProjectAutosave } from '../autosave';

export interface ProjectAutosaveOptions {
  name: string;
  wires: Wire[];
  onPending: () => void;
  onSaved: (result: ProjectSaveResult) => void;
}

/** Call with the autonomous draft, never the temporary example workspace. */
export function useProjectAutosave({ name, wires, onPending, onSaved }: ProjectAutosaveOptions) {
  const callbacks = useRef({ onPending, onSaved });
  useEffect(() => {
    callbacks.current = { onPending, onSaved };
  }, [onPending, onSaved]);

  useEffect(() => {
    const autosave = createProjectAutosave((result) => callbacks.current.onSaved(result));
    const visibility = () => {
      if (document.hidden) autosave.flush();
    };
    window.addEventListener('pagehide', autosave.flush);
    document.addEventListener('visibilitychange', visibility);
    callbacks.current.onPending();
    autosave.schedule({ name, wires });
    return () => {
      window.removeEventListener('pagehide', autosave.flush);
      document.removeEventListener('visibilitychange', visibility);
      // StrictMode cleanup cancels only; leaving a page uses the lifecycle flush.
      autosave.dispose();
    };
  }, [name, wires]);
}
