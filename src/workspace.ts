import type { Wire } from './sim/model';

export interface WorkspaceHistory {
  past: Wire[][];
  present: Wire[];
  future: Wire[][];
}

export interface WorkspaceDocument {
  name: string;
  history: WorkspaceHistory;
}

export interface WorkspaceState {
  workbench: WorkspaceDocument;
  example: { id: string; workspace: WorkspaceDocument } | null;
}

export type WorkspaceAction =
  | { type: 'set-name'; name: string }
  | { type: 'commit'; wires: Wire[] }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'enter-example'; id: string; name: string; wires: Wire[] }
  | { type: 'exit-example' }
  | { type: 'replace-project'; name: string; wires: Wire[] };

const HISTORY_LIMIT = 60;

function cloneWires(wires: Wire[]): Wire[] {
  return wires.map((wire) => ({
    ...wire,
    ...(wire.points ? { points: wire.points.map((point) => ({ ...point })) } : {}),
  }));
}

function createDocument(name: string, wires: Wire[]): WorkspaceDocument {
  return { name, history: { past: [], present: cloneWires(wires), future: [] } };
}

export function createWorkspaceState(name: string, wires: Wire[]): WorkspaceState {
  return { workbench: createDocument(name, wires), example: null };
}

export function currentWorkspace(state: WorkspaceState): WorkspaceDocument {
  return state.example?.workspace ?? state.workbench;
}

function commit(document: WorkspaceDocument, wires: Wire[]): WorkspaceDocument {
  return {
    ...document,
    history: {
      past: [...document.history.past, document.history.present].slice(-HISTORY_LIMIT),
      present: cloneWires(wires),
      future: [],
    },
  };
}

function updateVisible(
  state: WorkspaceState,
  update: (document: WorkspaceDocument) => WorkspaceDocument,
): WorkspaceState {
  const current = currentWorkspace(state);
  const next = update(current);
  if (current === next) return state;
  return state.example
    ? { ...state, example: { ...state.example, workspace: next } }
    : { ...state, workbench: next };
}

/** Autonomous work is the persistence target; examples are separate in-memory exercises. */
export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'set-name':
      return updateVisible(state, (document) =>
        document.name === action.name ? document : { ...document, name: action.name },
      );
    case 'commit':
      return updateVisible(state, (document) => commit(document, action.wires));
    case 'undo':
      return updateVisible(state, (document) => {
        const { past, present, future } = document.history;
        if (!past.length) return document;
        return {
          ...document,
          history: {
            past: past.slice(0, -1),
            present: past[past.length - 1],
            future: [present, ...future],
          },
        };
      });
    case 'redo':
      return updateVisible(state, (document) => {
        const { past, present, future } = document.history;
        if (!future.length) return document;
        return {
          ...document,
          history: {
            past: [...past, present].slice(-HISTORY_LIMIT),
            present: future[0],
            future: future.slice(1),
          },
        };
      });
    case 'enter-example':
      return {
        ...state,
        example: { id: action.id, workspace: createDocument(action.name, action.wires) },
      };
    case 'exit-example':
      return state.example ? { ...state, example: null } : state;
    case 'replace-project':
      return {
        workbench: { ...commit(state.workbench, action.wires), name: action.name },
        example: null,
      };
  }
}
