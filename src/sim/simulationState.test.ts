import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './examples';
import type { Wire } from './model';
import { createSimulationState, simulationReducer } from './simulationState';
import type { SimulationAction, SimulationState } from './simulationState';

const wires = (pairs: [string, string][]): Wire[] =>
  pairs.map(([from, to], index) => ({ id: `wire-${index}`, from, to, color: '#e35a64' }));
const run = (state: SimulationState, ...actions: SimulationAction[]) =>
  actions.reduce(simulationReducer, state);
const powerOn: SimulationAction = { type: 'power', powered: true };
const powerOff: SimulationAction = { type: 'power', powered: false };
const press = (deviceId: string): SimulationAction => ({ type: 'input', deviceId, active: true });
const release = (deviceId: string): SimulationAction => ({
  type: 'input',
  deviceId,
  active: false,
});
const selfHold = EXAMPLES.find((example) => example.id === 'self-hold')!.wires;

describe('event-driven simulation state', () => {
  it('keeps the preceding coil state through consecutive start/release events', () => {
    const initial = createSimulationState(selfHold);
    const running = run(initial, powerOn, press('SB2'), release('SB2'));
    expect(running.result.coils.KM1).toBe(true);
    expect(running.result.lamps.HL2).toBe(true);
    expect(running.inputs.SB2).toBe(false);
    expect(initial.inputs).toEqual({});
    expect(initial.result.coils.KM1).toBe(false);
    expect(run(running, press('SB1'), release('SB1')).result.coils.KM1).toBe(false);
  });

  it('cannot latch a jog circuit through a batched press/release sequence', () => {
    const jog = EXAMPLES.find((example) => example.id === 'contactor-jog')!.wires;
    const state = run(createSimulationState(jog), powerOn, press('SB2'), release('SB2'));
    expect(state.result.coils.KM1).toBe(false);
    expect(state.result.lamps.HL2).toBe(false);
  });

  it('retains a button-induced short and its location after button release', () => {
    const shortWires = wires([
      ['POWER:L', 'SB3:NO3'],
      ['SB3:NO4', 'POWER:N'],
    ]);
    const faulted = run(createSimulationState(shortWires), powerOn, press('SB3'));
    expect(faulted.result.fault?.kind).toBe('short');
    const released = run(faulted, release('SB3'));
    expect(released.powered).toBe(true);
    expect(released.inputs.SB3).toBe(false);
    expect(released.result.fault).toBe(faulted.result.fault);
    expect(released.result.fault?.wireIds).toEqual(['wire-0', 'wire-1']);
    expect(released.result.closedContacts).not.toContain('SB3:NO3-NO4');
    expect(Object.values(released.result.potential).every((value) => value === 'floating')).toBe(
      true,
    );
  });

  it('blocks further output until explicit power-off and supports a fresh run afterward', () => {
    const shortWires = wires([
      ['POWER:L', 'SB3:NO3'],
      ['SB3:NO4', 'POWER:N'],
      ['POWER:L', 'SB2:NO3'],
      ['SB2:NO4', 'HL2:1'],
      ['HL2:2', 'POWER:N'],
    ]);
    const faulted = run(createSimulationState(shortWires), powerOn, press('SB3'), release('SB3'));
    const stillStopped = run(faulted, press('SB2'), powerOn);
    expect(stillStopped.result.lamps.HL2).toBe(false);
    expect(stillStopped.result.fault).toBe(faulted.result.fault);
    const off = run(stillStopped, powerOff);
    expect(off.result.fault).toBeNull();
    expect(off.powered).toBe(false);
    expect(run(off, powerOn).result.lamps.HL2).toBe(true);
  });

  it('keeps unstable and unsupported faults latched through unrelated input changes', () => {
    const cases = [
      wires([
        ['POWER:L', 'KM1:61'],
        ['KM1:62', 'KM1:A1'],
        ['KM1:A2', 'POWER:N'],
      ]),
      wires([['POWER:U2', 'KM1:L1']]),
    ];
    for (const circuit of cases) {
      const faulted = run(createSimulationState(circuit), powerOn);
      expect(faulted.result.fault).not.toBeNull();
      expect(run(faulted, press('FR1'), press('ESTOP'), release('FR1')).result.fault).toBe(
        faulted.result.fault,
      );
    }
  });

  it('power-off clears coils and fault while preserving emergency stop, FR, and limits', () => {
    const state = run(
      createSimulationState(selfHold),
      powerOn,
      press('SB2'),
      release('SB2'),
      press('ESTOP'),
      press('FR1'),
      press('SQ2'),
      powerOff,
    );
    expect(state.inputs).toMatchObject({ ESTOP: true, FR1: true, SQ2: true });
    expect(Object.values(state.result.coils).some(Boolean)).toBe(false);
    expect(state.result.fault).toBeNull();
    expect(state.result.closedContacts).not.toContain('ESTOP:NC1-NC2');
    expect(run(state, powerOn).result.coils.KM1).toBe(false);
  });

  it('releasing interrupted momentary inputs leaves maintained mechanical inputs alone', () => {
    const held = run(
      createSimulationState(selfHold),
      press('SB1'),
      press('SB2'),
      press('SB3'),
      press('ESTOP'),
      press('FR2'),
      press('SQ1'),
    );
    const state = run(held, { type: 'release-momentary' });
    expect(state.inputs).toMatchObject({
      SB1: false,
      SB2: false,
      SB3: false,
      ESTOP: true,
      FR2: true,
      SQ1: true,
    });
    expect(run(state, { type: 'release-momentary' })).toBe(state);
  });

  it('window interruption releases the momentary fault trigger without clearing the fault', () => {
    const shortWires = wires([
      ['POWER:L', 'SB3:NO3'],
      ['SB3:NO4', 'POWER:N'],
    ]);
    const faulted = run(createSimulationState(shortWires), powerOn, press('SB3'));
    const state = run(faulted, { type: 'release-momentary' });
    expect(state.inputs.SB3).toBe(false);
    expect(state.result.fault).toBe(faulted.result.fault);
  });

  it('loading a project resets all transient inputs and starts with power off', () => {
    const prior = run(
      createSimulationState(selfHold),
      powerOn,
      press('ESTOP'),
      press('FR1'),
      press('SQ2'),
      press('SB3'),
    );
    const newWires = EXAMPLES[0].wires;
    const fresh = run(prior, { type: 'reset', wires: newWires });
    expect(fresh.wires).toBe(newWires);
    expect(fresh.inputs).toEqual({});
    expect(fresh.powered).toBe(false);
    expect(fresh.result.fault).toBeNull();
    expect(Object.values(fresh.result.coils).some(Boolean)).toBe(false);
  });

  it('resets the current bench from a running or faulted state without changing its wiring', () => {
    const circuit = [
      { ...selfHold[0], points: [{ x: 610, y: 510 }] },
      ...selfHold.slice(1),
      ...wires([
        ['POWER:L', 'SB3:NO3'],
        ['SB3:NO4', 'POWER:N'],
      ]),
    ];
    const savedCircuit = structuredClone(circuit);
    const running = run(
      createSimulationState(circuit),
      powerOn,
      press('SB2'),
      release('SB2'),
      press('SQ1'),
      press('SQ2'),
      press('FR2'),
    );
    expect(running.result.coils.KM1).toBe(true);
    expect(running.result.lamps.HL2).toBe(true);

    const controls = ['SB1', 'SB2', 'SB3', 'SQ1', 'SQ2', 'FR1', 'FR2', 'ESTOP'];
    const faulted = run(running, ...controls.map(press));
    expect(faulted.result.fault?.kind).toBe('short');
    expect(controls.every((id) => faulted.inputs[id])).toBe(true);

    for (const prior of [running, faulted]) {
      const reset = run(prior, { type: 'reset', wires: prior.wires });
      expect(reset.wires).toBe(circuit);
      expect(reset.wires).toEqual(savedCircuit);
      expect(reset.powered).toBe(false);
      expect(reset.inputs).toEqual({});
      expect(reset.result.fault).toBeNull();
      expect(Object.values(reset.result.coils).some(Boolean)).toBe(false);
      expect(Object.values(reset.result.lamps).some(Boolean)).toBe(false);

      const restarted = run(reset, powerOn, press('SB2'), release('SB2'));
      expect(restarted.result.fault).toBeNull();
      expect(restarted.result.coils.KM1).toBe(true);
      expect(restarted.result.lamps.HL2).toBe(true);
      // Reset clears the stopped run; the unchanged short-circuit branch still faults when operated.
      expect(run(restarted, press('SB3')).result.fault?.kind).toBe('short');
    }
  });

  it('wiring replacements disarm a run and preserve mechanical input positions', () => {
    const prior = run(
      createSimulationState(selfHold),
      powerOn,
      press('SB2'),
      release('SB2'),
      press('SQ1'),
    );
    const replaced = run(prior, { type: 'replace-wires', wires: [] });
    expect(replaced.powered).toBe(false);
    expect(replaced.inputs.SQ1).toBe(true);
    expect(replaced.result.coils.KM1).toBe(false);
    expect(run(replaced, powerOn).result.coils.KM1).toBe(false);
  });

  it('ignores duplicate events and impossible direct operation of coils or lamps', () => {
    const state = createSimulationState(selfHold);
    expect(
      run(state, powerOff, release('SB1'), press('KM1'), press('HL2'), {
        type: 'replace-wires',
        wires: selfHold,
      }),
    ).toBe(state);
  });
});
