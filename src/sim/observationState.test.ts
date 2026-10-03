import { describe, expect, it } from 'vitest';
import { EXAMPLES } from './examples';
import type { Wire } from './model';
import {
  createObservationState,
  diffSimulationStates,
  OBSERVATION_HISTORY_LIMIT,
  observationReducer,
  observationView,
} from './observationState';
import type { ObservationCommand, ObservationState } from './observationState';

const circuit = (id: string) => EXAMPLES.find((example) => example.id === id)!.wires;
const run = (state: ObservationState, ...actions: ObservationCommand[]) =>
  actions.reduce(observationReducer, state);
const powerOn: ObservationCommand = { type: 'power', powered: true };
const press = (deviceId: string): ObservationCommand => ({
  type: 'input',
  deviceId,
  active: true,
});
const release = (deviceId: string): ObservationCommand => ({
  type: 'input',
  deviceId,
  active: false,
});

describe('action observation history', () => {
  it('records both press and release even when self-hold keeps all outputs unchanged', () => {
    const initial = createObservationState(circuit('self-hold'));
    const state = run(initial, powerOn, press('SB2'), release('SB2'));
    expect(state.snapshots.map((entry) => entry.action)).toEqual([
      { type: 'initial' },
      powerOn,
      press('SB2'),
      release('SB2'),
    ]);
    expect(state.current.result.coils.KM1).toBe(true);
    const view = observationView(state);
    expect(view.displayed.inputs.SB2).toBe(false);
    expect(view.previousDisplayed!.inputs.SB2).toBe(true);
    const difference = diffSimulationStates(view.previousDisplayed, view.displayed);
    expect(difference.inputs).toEqual([{ id: 'SB2', from: true, to: false }]);
    expect(difference.coils).toEqual([]);
    expect(difference.lamps).toEqual([]);
    expect(difference.openedContacts).toContain('SB2:NO3-NO4');
    expect(difference.closedContacts).toContain('SB2:NC1-NC2');
    expect(initial.snapshots).toHaveLength(1);
    expect(initial.current.result.coils.KM1).toBe(false);
  });

  it('captures the different release outcomes of button-lamp, jog, and self-hold circuits', () => {
    for (const id of ['button-lamp', 'contactor-jog', 'self-hold']) {
      const state = run(createObservationState(circuit(id)), powerOn, press('SB2'), release('SB2'));
      const pressed = state.snapshots[2].state;
      const released = state.snapshots[3].state;
      expect(pressed.result.lamps.HL2).toBe(true);
      expect(released.result.lamps.HL2).toBe(id === 'self-hold');
      if (id !== 'button-lamp') {
        expect(pressed.result.coils.KM1).toBe(true);
        expect(released.result.coils.KM1).toBe(id === 'self-hold');
      }
    }
  });

  it('uses actual wiring when the holding branch is missing and records Stop independently', () => {
    const wires = circuit('self-hold').filter((wire) => wire.from !== 'KM1:14');
    const broken = run(createObservationState(wires), powerOn, press('SB2'), release('SB2'));
    expect(broken.snapshots[2].state.result.coils.KM1).toBe(true);
    expect(broken.snapshots[3].state.result.coils.KM1).toBe(false);

    const held = run(
      createObservationState(circuit('self-hold')),
      powerOn,
      press('SB2'),
      release('SB2'),
      press('SB1'),
      release('SB1'),
    );
    expect(held.snapshots[4].state.result.coils.KM1).toBe(false);
    expect(held.snapshots[5].state.result.coils.KM1).toBe(false);
    expect(held.snapshots[5].action).toEqual(release('SB1'));
  });

  it('does not restore old coil memory or mutate the latest run when inspecting history', () => {
    const held = run(
      createObservationState(circuit('self-hold')),
      powerOn,
      press('SB2'),
      release('SB2'),
    );
    const history = run(held, { type: 'select-snapshot', id: held.snapshots[1].id });
    expect(observationView(history).viewingHistory).toBe(true);
    expect(observationView(history).displayed.result.coils.KM1).toBe(false);
    expect(history.current).toBe(held.current);
    expect(run(history, press('SB1'), powerOn)).toBe(history);

    const latest = run(history, { type: 'select-snapshot', id: null });
    expect(observationView(latest).displayed.result.coils.KM1).toBe(true);
    const stopped = run(latest, press('SB1'));
    expect(stopped.current.result.coils.KM1).toBe(false);
    expect(held.snapshots[3].state.result.coils.KM1).toBe(true);
  });

  it('records safety release causes without replacing the selected historical evidence', () => {
    for (const reason of ['blur', 'hidden', 'mode-change'] as const) {
      const pressed = run(createObservationState(circuit('contactor-jog')), powerOn, press('SB2'));
      const history = run(pressed, { type: 'select-snapshot', id: pressed.snapshots[0].id });
      const action: ObservationCommand = { type: 'release-momentary', reason };
      const released = run(history, action);
      expect(released.current.inputs.SB2).toBe(false);
      expect(released.current.result.coils.KM1).toBe(false);
      expect(released.snapshots.at(-1)!.action).toEqual(action);
      expect(released.selectedSnapshotId).toBe(history.selectedSnapshotId);
      expect(observationView(released).displayed).toBe(observationView(history).displayed);
      expect(run(released, action)).toBe(released);
    }
  });

  it('allows power-off safety during history while preventing power-on and input mutations', () => {
    const held = run(
      createObservationState(circuit('self-hold')),
      powerOn,
      press('SB2'),
      release('SB2'),
    );
    const history = run(held, { type: 'select-snapshot', id: held.snapshots[2].id });
    const off = run(history, { type: 'power', powered: false });
    expect(off.current.powered).toBe(false);
    expect(off.current.result.coils.KM1).toBe(false);
    expect(observationView(off).displayed.result.coils.KM1).toBe(true);
    expect(run(off, powerOn, release('SB2'))).toBe(off);
  });

  it('drops history at every new wiring revision before returning a displayed state', () => {
    const held = run(
      createObservationState(circuit('self-hold')),
      powerOn,
      press('SB2'),
      release('SB2'),
    );
    const history = run(held, { type: 'select-snapshot', id: held.snapshots[2].id });
    const revised = circuit('self-hold').map((wire) => ({ ...wire, color: '#000000' }));
    const changed = run(history, { type: 'replace-wires', wires: revised });
    expect(changed.snapshots).toHaveLength(1);
    expect(changed.snapshots[0].action).toEqual({ type: 'wiring-change' });
    expect(changed.snapshots[0].id).toBeGreaterThan(held.snapshots.at(-1)!.id);
    expect(changed.current.wires).toBe(revised);
    expect(changed.current.powered).toBe(false);
    expect(observationView(changed)).toMatchObject({
      previousDisplayed: null,
      viewingHistory: false,
      displayed: { wires: revised, powered: false },
    });
    expect(run(changed, { type: 'select-snapshot', id: held.snapshots[2].id })).toBe(changed);
    expect(run(changed, { type: 'replace-wires', wires: revised })).toBe(changed);
  });

  it('reset creates a clean baseline without carrying held buttons or old fault history', () => {
    const previous = run(
      createObservationState(circuit('self-hold')),
      powerOn,
      press('SB2'),
      press('FR1'),
    );
    const history = run(previous, { type: 'select-snapshot', id: previous.snapshots[1].id });
    const reset = run(history, { type: 'reset', wires: previous.current.wires });
    expect(reset.snapshots).toHaveLength(1);
    expect(reset.snapshots[0].action).toEqual({ type: 'reset' });
    expect(reset.snapshots[0].step).toBe(0);
    expect(reset.snapshots[0].id).toBeGreaterThan(previous.snapshots.at(-1)!.id);
    expect(reset.current.inputs).toEqual({});
    expect(reset.current.powered).toBe(false);
    expect(reset.selectedSnapshotId).toBeNull();
    expect(reset.current.wires).toBe(previous.current.wires);
  });

  it('bounds retained steps and preserves the preceding action for differences', () => {
    let state = createObservationState(circuit('button-lamp'));
    for (let index = 0; index < OBSERVATION_HISTORY_LIMIT + 30; index++) {
      state = run(state, { type: 'input', deviceId: 'SB2', active: index % 2 === 0 });
    }
    expect(state.snapshots).toHaveLength(OBSERVATION_HISTORY_LIMIT);
    const first = state.snapshots[0];
    expect(first.id).toBeGreaterThan(0);
    expect(first.previousState!.inputs.SB2).not.toBe(first.state.inputs.SB2);
    expect(diffSimulationStates(first.previousState, first.state).inputs).toHaveLength(1);

    const pressed = run(state, press('SB2'));
    const selected = run(pressed, { type: 'select-snapshot', id: pressed.snapshots[0].id });
    const released = run(selected, { type: 'release-momentary', reason: 'blur' });
    expect(released.snapshots).toHaveLength(OBSERVATION_HISTORY_LIMIT);
    expect(observationView(released).displayed).toBe(observationView(selected).displayed);
  });

  it('keeps detached frozen snapshots without freezing external wires or commands', () => {
    const wires = structuredClone(circuit('button-lamp'));
    wires[0].points = [{ x: 10, y: 20 }];
    const state = createObservationState(wires);
    const action = press('SB2');
    const pressed = run(state, action);
    wires[0].from = 'POWER:N';
    wires[0].points[0].x = 99;
    expect(state.snapshots[0].state.wires[0]).toMatchObject({
      from: 'POWER:L',
      points: [{ x: 10, y: 20 }],
    });
    expect(Object.isFrozen(wires)).toBe(false);
    expect(Object.isFrozen(action)).toBe(false);
    expect(Object.isFrozen(pressed.snapshots[1].state.inputs)).toBe(true);
    expect(Object.isFrozen(pressed.snapshots[1].state.result.closedContacts)).toBe(true);
    expect(pressed.snapshots[1].state.wires).toBe(state.snapshots[0].state.wires);
  });

  it('retains fault evidence separately from the contacts visible after a safety release', () => {
    const wires: Wire[] = [
      { id: 'a', from: 'POWER:L', to: 'SB3:NO3', color: '#e35a64' },
      { id: 'b', from: 'SB3:NO4', to: 'POWER:N', color: '#e35a64' },
    ];
    const faulted = run(createObservationState(wires), powerOn, press('SB3'));
    const released = run(faulted, { type: 'release-momentary', reason: 'hidden' });
    const faultSnapshot = released.snapshots[2].state;
    const releasedSnapshot = released.snapshots[3].state;
    expect(faultSnapshot.result.fault?.wireIds).toEqual(['a', 'b']);
    expect(faultSnapshot.result.closedContacts).toContain('SB3:NO3-NO4');
    expect(releasedSnapshot.result.fault).toEqual(faultSnapshot.result.fault);
    expect(releasedSnapshot.result.closedContacts).not.toContain('SB3:NO3-NO4');
    expect(
      Object.values(releasedSnapshot.result.potential).every((value) => value === 'floating'),
    ).toBe(true);
    const off = run(released, { type: 'power', powered: false });
    expect(off.snapshots[4].state.result.fault).toBeNull();
    expect(faultSnapshot.result.fault?.kind).toBe('short');
    expect(
      diffSimulationStates(off.snapshots[4].previousState, off.snapshots[4].state).faultChanged,
    ).toBe(true);
  });

  it('ignores no-op events and normalizes selecting the latest step', () => {
    const initial = createObservationState([]);
    expect(run(initial, release('SB2'), press('KM1'), { type: 'power', powered: false })).toBe(
      initial,
    );
    expect(run(initial, { type: 'select-snapshot', id: 900 })).toBe(initial);
    const state = run(initial, press('SB2'));
    const history = run(state, { type: 'select-snapshot', id: 0 });
    const latest = run(history, { type: 'select-snapshot', id: state.snapshots.at(-1)!.id });
    expect(latest.selectedSnapshotId).toBeNull();
    expect(diffSimulationStates(null, latest.current)).toEqual({
      inputs: [],
      coils: [],
      lamps: [],
      closedContacts: [],
      openedContacts: [],
      powerChanged: false,
      faultChanged: false,
    });
  });
});
