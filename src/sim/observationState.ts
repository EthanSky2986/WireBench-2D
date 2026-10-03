import type { Wire } from './model';
import { createSimulationState, simulationReducer } from './simulationState';
import type { SimulationAction, SimulationState } from './simulationState';

export const OBSERVATION_HISTORY_LIMIT = 120;

export type MomentaryReleaseReason = 'blur' | 'hidden' | 'mode-change';

export type ObservationAction =
  | { type: 'initial' | 'wiring-change' | 'reset' }
  | { type: 'input'; deviceId: string; active: boolean }
  | { type: 'power'; powered: boolean }
  | { type: 'release-momentary'; reason: MomentaryReleaseReason };

export interface ObservationSnapshot {
  id: number;
  /** Action number within this wiring revision, independent of selection identity. */
  step: number;
  action: ObservationAction;
  /** Detached, frozen evidence of the stable result after this action. */
  state: SimulationState;
  /** The actual preceding action, even when older history has been trimmed. */
  previousState: SimulationState | null;
}

export interface ObservationState {
  current: SimulationState;
  snapshots: ObservationSnapshot[];
  selectedSnapshotId: number | null;
  nextId: number;
}

export type ObservationCommand =
  | Exclude<SimulationAction, { type: 'release-momentary' }>
  | { type: 'release-momentary'; reason: MomentaryReleaseReason }
  | { type: 'select-snapshot'; id: number | null };

export interface ObservationView {
  displayed: SimulationState;
  previousDisplayed: SimulationState | null;
  viewingHistory: boolean;
}

export interface BooleanStateChange {
  id: string;
  from: boolean;
  to: boolean;
}

export interface SimulationDifference {
  inputs: BooleanStateChange[];
  coils: BooleanStateChange[];
  lamps: BooleanStateChange[];
  closedContacts: string[];
  openedContacts: string[];
  powerChanged: boolean;
  faultChanged: boolean;
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function snapshotState(state: SimulationState, wires: Wire[]): SimulationState {
  // A wiring revision is copied once and shared by its snapshots. Each result
  // is copied separately so neither later reducer events nor external edits can
  // overwrite the evidence that the learner is currently inspecting.
  return freeze({
    ...state,
    wires,
    inputs: { ...state.inputs },
    result: structuredClone(state.result),
  });
}

function beginHistory(
  current: SimulationState,
  action: ObservationAction,
  id: number,
): ObservationState {
  const state = snapshotState(current, freeze(structuredClone(current.wires)));
  return {
    current,
    snapshots: freeze([{ id, step: 0, action: freeze(action), state, previousState: null }]),
    selectedSnapshotId: null,
    nextId: id + 1,
  };
}

export function createObservationState(wires: Wire[] = []): ObservationState {
  return beginHistory(createSimulationState(wires), { type: 'initial' }, 0);
}

function appendSnapshot(
  state: ObservationState,
  current: SimulationState,
  action: ObservationAction,
): ObservationState {
  const previous = state.snapshots[state.snapshots.length - 1].state;
  const snapshot = freeze({
    id: state.nextId,
    step: state.snapshots[state.snapshots.length - 1].step + 1,
    action: freeze({ ...action }),
    state: snapshotState(current, previous.wires),
    previousState: previous,
  });
  const snapshots = [...state.snapshots, snapshot];
  if (snapshots.length > OBSERVATION_HISTORY_LIMIT) {
    // A blur safety release must not evict the very snapshot being inspected.
    const removable = snapshots.findIndex((entry) => entry.id !== state.selectedSnapshotId);
    snapshots.splice(removable, 1);
  }
  return { ...state, current, snapshots: freeze(snapshots), nextId: state.nextId + 1 };
}

/**
 * Observation wraps the existing simulator; selecting history never restores
 * its inputs or coil memory. No-op browser events do not create phantom steps.
 */
export function observationReducer(
  state: ObservationState,
  action: ObservationCommand,
): ObservationState {
  if (action.type === 'select-snapshot') {
    const latestId = state.snapshots[state.snapshots.length - 1].id;
    const id = action.id === latestId ? null : action.id;
    if (id === state.selectedSnapshotId) return state;
    if (id !== null && !state.snapshots.some((entry) => entry.id === id)) return state;
    return { ...state, selectedSnapshotId: id };
  }
  if (action.type === 'replace-wires') {
    if (state.current.wires === action.wires) return state;
    return beginHistory(
      simulationReducer(state.current, action),
      { type: 'wiring-change' },
      state.nextId,
    );
  }
  if (action.type === 'reset') {
    return beginHistory(simulationReducer(state.current, action), { type: 'reset' }, state.nextId);
  }
  // Safety releases and power-off still apply to the live run while the
  // learner reads a snapshot. Ordinary operation requires returning to latest.
  if (
    state.selectedSnapshotId !== null &&
    (action.type === 'input' || (action.type === 'power' && action.powered))
  )
    return state;

  const current = simulationReducer(state.current, action);
  if (current === state.current) return state;
  return appendSnapshot(state, current, action);
}

export function observationView(state: ObservationState): ObservationView {
  const snapshot =
    state.snapshots.find((entry) => entry.id === state.selectedSnapshotId) ??
    state.snapshots[state.snapshots.length - 1];
  return {
    displayed: snapshot.state,
    previousDisplayed: snapshot.previousState,
    viewingHistory: state.selectedSnapshotId !== null,
  };
}

function booleanChanges(
  previous: Record<string, boolean>,
  next: Record<string, boolean>,
): BooleanStateChange[] {
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])]
    .sort()
    .filter((id) => !!previous[id] !== !!next[id])
    .map((id) => ({ id, from: !!previous[id], to: !!next[id] }));
}

/** Differences describe stable action boundaries, not physical contact timing. */
export function diffSimulationStates(
  previous: SimulationState | null,
  next: SimulationState,
): SimulationDifference {
  if (!previous)
    return {
      inputs: [],
      coils: [],
      lamps: [],
      closedContacts: [],
      openedContacts: [],
      powerChanged: false,
      faultChanged: false,
    };
  const beforeContacts = new Set(previous.result.closedContacts);
  const afterContacts = new Set(next.result.closedContacts);
  return {
    inputs: booleanChanges(previous.inputs, next.inputs),
    coils: booleanChanges(previous.result.coils, next.result.coils),
    lamps: booleanChanges(previous.result.lamps, next.result.lamps),
    closedContacts: next.result.closedContacts.filter((id) => !beforeContacts.has(id)),
    openedContacts: previous.result.closedContacts.filter((id) => !afterContacts.has(id)),
    powerChanged: previous.powered !== next.powered,
    faultChanged:
      JSON.stringify(previous.result.fault?.descriptor ?? null) !==
      JSON.stringify(next.result.fault?.descriptor ?? null),
  };
}
