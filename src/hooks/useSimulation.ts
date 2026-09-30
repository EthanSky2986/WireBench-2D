import { useCallback, useEffect, useReducer } from 'react';
import type { Wire } from '../sim/model';
import { createSimulationState, simulationReducer } from '../sim/simulationState';
import type { SimulationState } from '../sim/simulationState';

export interface SimulationController extends Pick<
  SimulationState,
  'powered' | 'inputs' | 'result'
> {
  operate: (deviceId: string, active: boolean) => void;
  setPower: (powered: boolean) => void;
  resetSimulation: (wires: Wire[]) => void;
}

/** Browser lifecycle events are translated into the same tested domain events. */
export function useSimulation(wires: Wire[]): SimulationController {
  const [state, dispatch] = useReducer(simulationReducer, wires, createSimulationState);

  useEffect(() => {
    dispatch({ type: 'replace-wires', wires });
  }, [wires]);

  useEffect(() => {
    const release = () => dispatch({ type: 'release-momentary' });
    const visibility = () => {
      if (document.hidden) release();
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

  return {
    powered: state.powered,
    inputs: state.inputs,
    result: state.result,
    operate,
    setPower,
    resetSimulation,
  };
}
