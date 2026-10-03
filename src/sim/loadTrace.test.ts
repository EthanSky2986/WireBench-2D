import { describe, expect, it } from 'vitest';
import { simulate } from './engine';
import { EXAMPLES } from './examples';
import { traceLoad } from './loadTrace';
import { TERMINAL_IDS, type Wire } from './model';

const connect = (...pairs: [string, string][]): Wire[] =>
  pairs.map(([from, to], index) => ({ id: `w${index + 1}`, from, to, color: '#ef4444' }));
const example = (id: string) => EXAMPLES.find((item) => item.id === id)!.wires;

describe('stable load connectivity explanations', () => {
  it('shows both lamp supply and return while pressed, then clears evidence on release', () => {
    const wires = example('button-lamp');
    const pressed = simulate(wires, { SB2: true }, true);
    const trace = traceLoad(wires, pressed, true, 'HL2');
    expect(trace.status).toBe('energized');
    expect(trace.ends).toEqual([
      { terminalId: 'HL2:1', potential: 'L' },
      { terminalId: 'HL2:2', potential: 'N' },
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
