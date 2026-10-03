import { useCallback, useEffect, useReducer } from 'react';
import type { Wire } from '../sim/model';
import {
  createObservationState,
  observationReducer,
  observationView,
} from '../sim/observationState';
import type { ObservationSnapshot, ObservationView } from '../sim/observationState';
import type { SimulationState } from '../sim/simulationState';

export interface SimulationController
  extends Pick<SimulationState, 'powered' | 'inputs' | 'result'>, ObservationView {
  operate: (deviceId: string, active: boolean) => void;
  setPower: (powered: boolean) => void;
  resetSimulation: (wires: Wire[]) => void;
  snapshots: ObservationSnapshot[];
  selectedSnapshotId: number | null;
  selectSnapshot: (id: number | null) => void;
  releaseMomentary: () => void;
}

/** Browser lifecycle events are translated into the same tested domain events. */
export function useSimulation(wires: Wire[]): SimulationController {
  const [state, dispatch] = useReducer(observationReducer, wires, createObservationState);

  // Adjust before children commit: an effect would briefly expose old traces
  // on a newly edited/imported wiring revision. The identity guard converges
  // after one render and the reducer disarms the run at this same boundary.
  if (state.current.wires !== wires) {
    dispatch({ type: 'replace-wires', wires });
  }

  useEffect(() => {
    const release = () => dispatch({ type: 'release-momentary', reason: 'blur' });
    const visibility = () => {
      if (document.hidden) dispatch({ type: 'release-momentary', reason: 'hidden' });
    };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  const operate = useCallback((deviceId: string, active: boolean) => {
    dispatch({ type: 'input', deviceId, active });
  }, []);
  const setPower = useCallback((powered: boolean) => {
    dispatch({ type: 'power', powered });
  }, []);
  const resetSimulation = useCallback((nextWires: Wire[]) => {
    dispatch({ type: 'reset', wires: nextWires });
  }, []);
  const selectSnapshot = useCallback((id: number | null) => {
    dispatch({ type: 'select-snapshot', id });
  }, []);
  const releaseMomentary = useCallback(() => {
    dispatch({ type: 'release-momentary', reason: 'mode-change' });
  }, []);

  return {
    powered: state.current.powered,
    inputs: state.current.inputs,
    result: state.current.result,
    operate,
    setPower,
    resetSimulation,
    snapshots: state.snapshots,
    selectedSnapshotId: state.selectedSnapshotId,
    selectSnapshot,
    releaseMomentary,
    ...observationView(state),
  };
}
