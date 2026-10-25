import { describe, expect, it } from 'vitest';
import { simulate } from './engine';
import { EXAMPLES } from './examples';
import { hasSupplyPath, preferredLoadId, traceLoad } from './loadTrace';
import { TERMINAL_IDS, type Wire } from './model';

const connect = (...pairs: [string, string][]): Wire[] =>
  pairs.map(([from, to], index) => ({ id: `w${index + 1}`, from, to, color: '#ef4444' }));
const example = (id: string) => EXAMPLES.find((item) => item.id === id)!.wires;

describe('stable load connectivity explanations', () => {
  it('uses one supply-path predicate for running and partial device states', () => {
    expect(hasSupplyPath('energized')).toBe(true);
    expect(hasSupplyPath('partial')).toBe(true);
    expect(hasSupplyPath('energized-not-running')).toBe(true);
    expect(hasSupplyPath('unconnected')).toBe(false);
    expect(hasSupplyPath('fault')).toBe(false);
  });

  it('shows both lamp supply and return while pressed, then clears evidence on release', () => {
    const wires = example('button-lamp');
    const pressed = simulate(wires, { SB2: true }, true);
    const trace = traceLoad(wires, pressed, true, 'HL2');
    expect(trace.status).toBe('energized');
    expect(trace.ends).toEqual([
      { terminalId: 'HL2:1', potential: 'L', connection: 'rail' },
      { terminalId: 'HL2:2', potential: 'N', connection: 'rail' },
    ]);
    expect(trace.wireIds).toEqual(['lamp-1', 'lamp-2', 'lamp-3']);
    expect(trace.contactIds).toEqual(['SB2:NO3-NO4']);
    expect(trace.terminalIds).toEqual([
      'HL2:1',
      'HL2:2',
      'POWER:L',
      'POWER:N',
      'SB2:NO3',
      'SB2:NO4',
    ]);

    const released = traceLoad(wires, simulate(wires, {}, true, pressed.coils), true, 'HL2');
    expect(released.status).toBe('unconnected');
    expect(released.ends[0].potential).toBe('floating');
    expect(released.ends[1].potential).toBe('N');
    expect(released.wireIds).toEqual([]);
    expect(released.contactIds).toEqual([]);
  });

  it('explains a jog coil independently from its lamp and does not invent self-holding', () => {
    const wires = example('contactor-jog');
    const pressed = simulate(wires, { SB2: true }, true);
    const coil = traceLoad(wires, pressed, true, 'KM1');
    const lamp = traceLoad(wires, pressed, true, 'HL2');
    expect(coil.wireIds).toEqual(['jog-1', 'jog-2', 'jog-3']);
    expect(coil.contactIds).toEqual(['SB2:NO3-NO4']);
    expect(lamp.wireIds).toEqual(['jog-4', 'jog-5', 'jog-6']);
    expect(lamp.contactIds).toEqual(['KM1:13-14']);
    const released = simulate(wires, {}, true, pressed.coils);
    expect(traceLoad(wires, released, true, 'KM1').status).toBe('unconnected');
    expect(traceLoad(wires, released, true, 'HL2').status).toBe('unconnected');
  });

  it('includes both valid start and holding branches, then retains only holding after release', () => {
    const wires = example('self-hold');
    const pressed = simulate(wires, { SB2: true }, true);
    const before = traceLoad(wires, pressed, true, 'KM1');
    expect(before.wireIds).toEqual(Array.from({ length: 8 }, (_, index) => `hold-${index + 1}`));
    expect(before.contactIds).toEqual([
      'ESTOP:NC1-NC2',
      'FR1:95-96',
      'KM1:13-14',
      'SB1:NC1-NC2',
      'SB2:NO3-NO4',
    ]);

    const released = simulate(wires, {}, true, pressed.coils);
    const after = traceLoad(wires, released, true, 'KM1');
    expect(after.status).toBe('energized');
    expect(after.wireIds).toEqual(['hold-1', 'hold-2', 'hold-3', 'hold-6', 'hold-7', 'hold-8']);
    expect(after.contactIds).toEqual(['ESTOP:NC1-NC2', 'FR1:95-96', 'KM1:13-14', 'SB1:NC1-NC2']);
    expect(after.terminalIds).not.toContain('SB2:NO3');
    expect(after.terminalIds).not.toContain('SB2:NO4');
    expect(
      traceLoad(wires, simulate(wires, { SB1: true }, true, released.coils), true, 'KM1').status,
    ).toBe('unconnected');
    // The earlier explanation is immutable evidence of that earlier stable state.
    expect(before.contactIds).toContain('SB2:NO3-NO4');
  });

  it('loses holding after release when the actual holding connection is missing', () => {
    const wires = example('self-hold').filter((wire) => wire.id !== 'hold-8');
    const pressed = simulate(wires, { SB2: true }, true);
    const before = traceLoad(wires, pressed, true, 'KM1');
    expect(before.status).toBe('energized');
    expect(before.contactIds).not.toContain('KM1:13-14');
    expect(before.wireIds).not.toContain('hold-7');
    const released = simulate(wires, {}, true, pressed.coils);
    expect(traceLoad(wires, released, true, 'KM1').status).toBe('unconnected');
  });

  it('excludes dangling L branches, including a closed loop attached at a single vertex', () => {
    const wires = connect(
      ['POWER:L', 'HL1:1'],
      ['HL1:2', 'POWER:N'],
      ['HL1:1', 'SB3:NC1'],
      ['SB3:NC2', 'SQ2:NC1'],
      ['SQ2:NC2', 'HL1:1'],
      ['POWER:L', 'HL2:1'],
    );
    const state = simulate(wires, {}, true);
    expect(state.potential['SB3:NC1']).toBe('L');
    expect(state.closedContacts).toContain('SB3:NC1-NC2');
    const trace = traceLoad(wires, state, true, 'HL1');
    expect(trace.status).toBe('energized');
    expect(trace.wireIds).toEqual(['w1', 'w2']);
    expect(trace.contactIds).toEqual([]);
  });

  it('includes a wire and a parallel closed contact without merging their identities', () => {
    const wires = connect(
      ['POWER:L', 'SB2:NO3'],
      ['SB2:NO4', 'HL2:1'],
      ['HL2:2', 'POWER:N'],
      ['SB2:NO3', 'SB2:NO4'],
    );
    const trace = traceLoad(wires, simulate(wires, { SB2: true }, true), true, 'HL2');
    expect(trace.wireIds).toEqual(['w1', 'w2', 'w3', 'w4']);
    expect(trace.contactIds).toEqual(['SB2:NO3-NO4']);
    const released = traceLoad(wires, simulate(wires, {}, true), true, 'HL2');
    expect(released.status).toBe('energized');
    expect(released.contactIds).toEqual([]);
  });

  it('supports reversed rail orientation and parallel return branches', () => {
    const wires = connect(
      ['POWER:N', 'HL2:1'],
      ['HL2:1', 'SB1:NC1'],
      ['SB1:NC2', 'POWER:N'],
      ['HL2:2', 'POWER:L'],
    );
    const trace = traceLoad(wires, simulate(wires, {}, true), true, 'HL2');
    expect(trace.status).toBe('energized');
    expect(trace.ends.map((end) => end.potential)).toEqual(['N', 'L']);
    expect(trace.wireIds).toEqual(['w1', 'w2', 'w3', 'w4']);
    expect(trace.contactIds).toEqual(['SB1:NC1-NC2']);
  });

  it('reports objective unconnected and same-rail facts without calling a load a conductor', () => {
    const wires = connect(['POWER:L', 'HL1:1'], ['HL1:2', 'POWER:L'], ['POWER:N', 'KM1:A2']);
    const state = simulate(wires, {}, true);
    expect(traceLoad(wires, state, true, 'HL1').status).toBe('same-rail');
    const coil = traceLoad(wires, state, true, 'KM1');
    expect(coil.status).toBe('unconnected');
    expect(coil.ends.map((end) => end.potential)).toEqual(['floating', 'N']);
    expect(traceLoad(wires, state, true, 'SB1').ends).toEqual([]);
  });

  it('does not reconstruct successful evidence from fault-time or unpowered states', () => {
    const circuits = [
      connect(['POWER:L', 'POWER:N']),
      connect(['POWER:L', 'HL1:1'], ['HL1:2', 'HL2:1'], ['HL2:2', 'POWER:N']),
      connect(['POWER:L', 'KM1:61'], ['KM1:62', 'KM1:A1'], ['KM1:A2', 'POWER:N']),
    ];
    expect(circuits.map((wires) => simulate(wires, {}, true).fault?.kind)).toEqual([
      'short',
      'unsupported',
      'unstable',
    ]);
    for (const wires of circuits) {
      const trace = traceLoad(wires, simulate(wires, {}, true), true, 'KM1');
      expect(trace.status).toBe('fault');
      expect(trace.wireIds).toEqual([]);
      expect(trace.contactIds).toEqual([]);
      expect(trace.terminalIds).toEqual([]);
    }
    const wires = example('button-lamp');
    const state = simulate(wires, { SB2: true }, false);
    expect(traceLoad(wires, state, false, 'HL2').status).toBe('unpowered');
    expect(traceLoad(wires, state, false, 'HL2').wireIds).toEqual([]);
  });

  it('ignores geometry, color and wire array order without modifying the inputs', () => {
    const wires = example('self-hold');
    const state = simulate(wires, { SB2: true }, true);
    const expected = traceLoad(wires, state, true, 'KM1');
    const changed = wires
      .map((wire) => ({ ...wire, color: '#123456', points: [{ x: 7, y: 9 }] }))
      .reverse();
    const snapshot = JSON.stringify({ changed, state });
    expect(traceLoad(changed, state, true, 'KM1')).toEqual(expected);
    expect(JSON.stringify({ changed, state })).toBe(snapshot);
    expect(traceLoad([], state, true, 'KM1').status).toBe('unconnected');
  });

  it('handles a dense 499-wire network without enumerating its exponential path combinations', () => {
    const vertices = TERMINAL_IDS.filter((id) => /^KM\d:/.test(id) && !/:A[12]$/.test(id)).slice(
      0,
      32,
    );
    const pairs: [string, string][] = [
      ['POWER:L', vertices[0]],
      [vertices[vertices.length - 1], 'HL1:1'],
      ['HL1:2', 'POWER:N'],
    ];
    vertices.forEach((from, index) => {
      for (const to of vertices.slice(index + 1)) pairs.push([from, to]);
    });
    const wires = connect(...pairs);
    expect(wires).toHaveLength(499);
    const trace = traceLoad(wires, simulate(wires, {}, true), true, 'HL1');
    expect(trace.status).toBe('energized');
    expect(trace.wireIds).toEqual(wires.map((wire) => wire.id).sort());
  });
});

describe('motor observation', () => {
  const motorExample = () => example('motor-self-hold');

  it('identifies the wired star point while the main contactor is open', () => {
    const wires = motorExample();
    const state = simulate(wires, {}, true);
    const trace = traceLoad(wires, state, true, 'MOTOR');
    expect(state.coils.KM1).toBe(false);
    expect(
      trace.ends.filter((end) => end.connection === 'star-point').map((end) => end.terminalId),
    ).toEqual(['MOTOR:U2', 'MOTOR:V2', 'MOTOR:W2']);
    expect(trace.status).toBe('unconnected');
  });

  it('keeps structural star-point labels while power is off without showing a supply path', () => {
    const wires = motorExample();
    const state = simulate(wires, {}, false);
    const trace = traceLoad(wires, state, false, 'MOTOR');
    expect(trace.status).toBe('unpowered');
    expect(
      trace.ends.filter((end) => end.connection === 'star-point').map((end) => end.terminalId),
    ).toEqual(['MOTOR:U2', 'MOTOR:V2', 'MOTOR:W2']);
    expect(trace.wireIds).toEqual([]);
  });

  it('explains all three winding paths when the model classifies the motor as running', () => {
    const wires = motorExample();
    const running = simulate(wires, { SB2: true }, true);
    expect(running.motors.MOTOR).toBe(true);
    const trace = traceLoad(wires, running, true, 'MOTOR');
    expect(trace.multiWinding).toBe(true);
    expect(trace.status).toBe('energized');
    expect(trace.ends.map((end) => end.terminalId)).toEqual([
      'MOTOR:U1',
      'MOTOR:U2',
      'MOTOR:V1',
      'MOTOR:V2',
      'MOTOR:W1',
      'MOTOR:W2',
    ]);
    // Each phase conductor and each winding terminal must be explained.
    expect(trace.terminalIds).toEqual(
      expect.arrayContaining([
        'MOTOR:U1',
        'MOTOR:V1',
        'MOTOR:W1',
        'MOTOR:U2',
        'MOTOR:V2',
        'MOTOR:W2',
      ]),
    );
    expect(trace.windings.map(({ phase, supplied }) => [phase, supplied])).toEqual([
      ['U', true],
      ['V', true],
      ['W', true],
    ]);
    expect(trace.ends.filter((end) => end.connection === 'star-point')).toHaveLength(3);
    expect(trace.wireIds).toEqual(expect.arrayContaining(['motor-13', 'motor-14']));
    expect(trace.contactIds).toEqual(
      expect.arrayContaining(['KM1:L1-T1', 'KM1:L2-T2', 'KM1:L3-T3']),
    );
    expect(trace.wireIds.length).toBeGreaterThan(0);
  });

  it('reports a missing phase as partial instead of a running motor', () => {
    const wires = motorExample().filter(
      (wire) => wire.from !== 'POWER:W2' && wire.to !== 'POWER:W2',
    );
    const state = simulate(wires, { SB2: true }, true);
    expect(state.motors.MOTOR).toBe(false);
    const trace = traceLoad(wires, state, true, 'MOTOR');
    expect(trace.status).toBe('partial');
    // The live U and V windings are still explained, so the learner sees what works.
    expect(trace.terminalIds).toEqual(expect.arrayContaining(['MOTOR:U1', 'MOTOR:V1']));
  });

  it('reports energized windings without claiming a three-phase run condition', () => {
    const twoPhase = motorExample().map((wire) =>
      wire.from === 'POWER:W2' ? { ...wire, from: 'POWER:V2' } : wire,
    );
    const state = simulate(twoPhase, { SB2: true }, true);
    expect(state.fault).toBeNull();
    expect(Object.values(state.windings).every(Boolean)).toBe(true);
    expect(state.motors.MOTOR).toBe(false);

    const trace = traceLoad(twoPhase, state, true, 'MOTOR');
    expect(trace.status).toBe('energized-not-running');
    expect(trace.terminalIds).toEqual(expect.arrayContaining(['MOTOR:U1', 'MOTOR:V1', 'MOTOR:W1']));
  });

  it('explains a repeated-phase three-winding connection without stopping its control circuit', () => {
    const wires = connect(
      ['POWER:U2', 'MOTOR:U1'],
      ['MOTOR:U2', 'POWER:V2'],
      ['POWER:U2', 'MOTOR:V1'],
      ['MOTOR:V2', 'POWER:V2'],
      ['POWER:V2', 'MOTOR:W1'],
      ['MOTOR:W2', 'POWER:W2'],
      ['POWER:L', 'KM1:A1'],
      ['KM1:A2', 'POWER:N'],
    );
    const state = simulate(wires, {}, true);
    const trace = traceLoad(wires, state, true, 'MOTOR');

    expect(state.fault).toBeNull();
    expect(state.coils.KM1).toBe(true);
    expect(trace.status).toBe('energized-not-running');
    expect(trace.motorProblem).toBe('no-pattern');
  });

  it('reports an undefined supply relationship instead of labeling it same-phase', () => {
    const wires = connect(['POWER:U2', 'MOTOR:U1'], ['POWER:N', 'MOTOR:U2']);
    const state = simulate(wires, {}, true);
    const trace = traceLoad(wires, state, true, 'MOTOR');

    expect(state.fault).toBeNull();
    expect(trace.status).toBe('unconnected');
    expect(trace.motorProblem).toBe('undefined-supply');
  });

  it('keeps an undefined neutral reference local and does not claim winding supply', () => {
    const wires = connect(
      ['POWER:L', 'KM1:A1'],
      ['KM1:A2', 'POWER:N'],
      ['POWER:U2', 'MOTOR:U1'],
      ['POWER:V2', 'MOTOR:V1'],
      ['POWER:W2', 'MOTOR:W1'],
      ['MOTOR:U2', 'MOTOR:V2'],
      ['MOTOR:V2', 'MOTOR:W2'],
      ['MOTOR:W2', 'POWER:N'],
    );
    const state = simulate(wires, {}, true);
    const trace = traceLoad(wires, state, true, 'MOTOR');

    expect(state.fault).toBeNull();
    expect(state.coils.KM1).toBe(true);
    expect(trace.status).toBe('unconnected');
    expect(trace.motorProblem).toBe('undefined-star-rail');
    expect(trace.windings.every(({ supplied }) => !supplied)).toBe(true);
  });

  it('does not report same-phase star windings as energized', () => {
    const samePhase = motorExample().map((wire) =>
      wire.from === 'POWER:V2' || wire.from === 'POWER:W2' ? { ...wire, from: 'POWER:U2' } : wire,
    );
    const state = simulate(samePhase, { SB2: true }, true);

    expect(Object.values(state.windings).every(Boolean)).toBe(false);
    expect(state.motors.MOTOR).toBe(false);
    const trace = traceLoad(samePhase, state, true, 'MOTOR');
    expect(trace.status).toBe('unconnected');
    expect(trace.motorProblem).toBe('same-phase');
  });

  it('does not claim a trace for a stopped motor with no phase supply', () => {
    const wires = motorExample();
    const stopped = simulate(wires, {}, true);
    expect(stopped.motors.MOTOR).toBe(false);
    expect(traceLoad(wires, stopped, true, 'MOTOR').status).toBe('unconnected');
  });
});

describe('default observation target', () => {
  it('opens a motor example on the motor rather than on its contactor coil', () => {
    expect(preferredLoadId(example('motor-self-hold'), 'KM1')).toBe('MOTOR');
  });

  it('keeps the existing examples on the load they are about', () => {
    expect(preferredLoadId(example('button-lamp'), 'KM1')).toBe('HL2');
    expect(preferredLoadId(example('contactor-jog'), 'KM1')).toBe('KM1');
    expect(preferredLoadId(example('self-hold'), 'KM1')).toBe('KM1');
  });

  it('falls back to the first observable load when nothing is wired yet', () => {
    expect(preferredLoadId([], null)).toBe('KM1');
    expect(preferredLoadId([], 'MOTOR')).toBe('MOTOR');
  });

  it('honours a preferred load that is tied for the most connections', () => {
    // Both HL1 and HL2 are fully wired here, so the learner's own choice stays.
    const wires = connect(
      ['POWER:L', 'HL1:1'],
      ['HL1:2', 'POWER:N'],
      ['POWER:L', 'HL2:1'],
      ['HL2:2', 'POWER:N'],
    );
    expect(preferredLoadId(wires, 'HL2')).toBe('HL2');
    expect(preferredLoadId(wires, 'HL1')).toBe('HL1');
  });

  it('does not let a partly wired motor outrank a complete lamp by terminal count', () => {
    const wires = connect(
      ['POWER:U2', 'MOTOR:U1'],
      ['POWER:V2', 'MOTOR:V1'],
      ['POWER:W2', 'MOTOR:W1'],
      ['POWER:L', 'HL2:1'],
      ['HL2:2', 'POWER:N'],
    );
    expect(preferredLoadId(wires, 'MOTOR')).toBe('HL2');
  });
});

describe('partial motor copy', () => {
  it('reports a missing phase as partial, with strings in both languages', () => {
    const wires = example('motor-self-hold').filter(
      (wire) => wire.from !== 'POWER:W2' && wire.to !== 'POWER:W2',
    );
    const state = simulate(wires, { SB2: true }, true);
    expect(traceLoad(wires, state, true, 'MOTOR').status).toBe('partial');
  });
});
