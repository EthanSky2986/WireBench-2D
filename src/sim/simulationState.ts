import { simulate } from './engine';
import type { SimulationResult } from './engine';
import { DEVICES } from './model';
import type { Wire } from './model';

/** Transient operation state is deliberately separate from a saved project. */
export interface SimulationState {
  wires: Wire[];
  powered: boolean;
  inputs: Record<string, boolean>;
  result: SimulationResult;
}

export type SimulationAction =
  | { type: 'input'; deviceId: string; active: boolean }
  | { type: 'release-momentary' }
  | { type: 'power'; powered: boolean }
  | { type: 'replace-wires'; wires: Wire[] }
  | { type: 'reset'; wires: Wire[] };

const OPERABLE_IDS = new Set(
  DEVICES.filter((device) => ['button', 'limit', 'estop', 'thermal'].includes(device.kind)).map(
    (device) => device.id,
  ),
);
const MOMENTARY_IDS = DEVICES.filter((device) => device.kind === 'button').map(
  (device) => device.id,
);

export function createSimulationState(wires: Wire[] = []): SimulationState {
  return { wires, powered: false, inputs: {}, result: simulate(wires, {}, false) };
}

function changeInputs(state: SimulationState, inputs: Record<string, boolean>): SimulationState {
  // Once a fault stops the run, input release still updates mechanical contacts
  // but cannot restart computation or erase the evidence before power-off.
  const result = state.result.fault
    ? { ...simulate(state.wires, inputs, false), fault: state.result.fault }
    : simulate(state.wires, inputs, state.powered, state.result.coils);
  return { ...state, inputs, result };
}

/**
 * Each event resolves against the preceding committed relay state. This also
 * preserves a press/release sequence when React batches several dispatches.
 * No DOM, effects, clocks, or mutable coil refs participate in this transition.
 */
export function simulationReducer(
  state: SimulationState,
  action: SimulationAction,
): SimulationState {
  switch (action.type) {
    case 'input': {
      if (!OPERABLE_IDS.has(action.deviceId) || !!state.inputs[action.deviceId] === action.active)
        return state;
      return changeInputs(state, { ...state.inputs, [action.deviceId]: action.active });
    }
    case 'release-momentary': {
      if (!MOMENTARY_IDS.some((id) => state.inputs[id])) return state;
      const inputs = { ...state.inputs };
      for (const id of MOMENTARY_IDS) inputs[id] = false;
      return changeInputs(state, inputs);
    }
    case 'power': {
      if (state.powered === action.powered) return state;
      return {
        ...state,
        powered: action.powered,
        // A power transition always starts with released coils. Mechanical
        // inputs retain their positions until explicitly operated or reset.
        result: simulate(state.wires, state.inputs, action.powered),
      };
    }
    case 'replace-wires': {
      if (state.wires === action.wires) return state;
      // The editor locks live rewiring. This boundary also disarms unexpected
      // external document changes instead of applying them to a powered run.
      return {
        ...state,
        wires: action.wires,
        powered: false,
        result: simulate(action.wires, state.inputs, false),
      };
    }
    case 'reset':
      return createSimulationState(action.wires);
  }
}
