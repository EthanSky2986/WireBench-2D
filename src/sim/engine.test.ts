import { describe, expect, it } from 'vitest';
import { simulate } from './engine';
import { EXAMPLES } from './examples';
import { DEVICES, TERMINAL_IDS } from './model';
import type { Wire } from './model';

const connect = (...pairs: [string, string][]): Wire[] =>
  pairs.map(([from, to], index) => ({ id: `w${index + 1}`, from, to, color: '#ef4444' }));
const example = (id: string) => EXAMPLES.find((item) => item.id === id)!.wires;

describe('terminal identity and wire connectivity', () => {
  it('defines unique complete terminal IDs for the whole hand-drawn bench', () => {
    expect(DEVICES).toHaveLength(16);
    expect(TERMINAL_IDS).toHaveLength(113);
    expect(new Set(TERMINAL_IDS).size).toBe(TERMINAL_IDS.length);
    expect(TERMINAL_IDS).toContain('POWER:U2');
    expect(TERMINAL_IDS).toContain('MOTOR:U2');
  });

  it('does not merge adjacent terminals or same local labels on different devices', () => {
    const state = simulate(connect(['POWER:L', 'HL1:1'], ['HL2:2', 'POWER:N']), {}, true);
    expect(state.lamps).toEqual({ HL1: false, HL2: false, HL3: false });
    expect(state.potential['HL2:1']).toBe('floating');
    expect(state.potential['HL1:2']).toBe('floating');
  });

  it('ignores visual wire crossings, line color, and bend points electrically', () => {
    const wires = connect(['POWER:L', 'HL1:1'], ['HL1:2', 'POWER:N']);
    wires[0].points = [
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ];
    wires[1].points = [
      { x: 100, y: 200 },
      { x: 200, y: 100 },
    ];
    wires[0].color = '#0000ff';
    wires[1].color = '#ff0000';
    const state = simulate(wires, {}, true);
    expect(state.fault).toBeNull();
    expect(state.lamps.HL1).toBe(true);
  });

  it('reports an unknown imported terminal without crashing the graph solver', () => {
    const state = simulate(connect(['POWER:L', 'HL9:1']), {}, true);
    expect(state.fault?.kind).toBe('unsupported');
    expect(state.fault?.terminals).toEqual(['HL9:1']);
  });
});

describe('loads require a complete, independent supply path', () => {
  it.each([
    [
      'normal',
      [
        ['POWER:L', 'HL2:1'],
        ['HL2:2', 'POWER:N'],
      ],
      true,
    ],
    [
      'reversed',
      [
        ['POWER:N', 'HL2:1'],
        ['HL2:2', 'POWER:L'],
      ],
      true,
    ],
    ['only one lead', [['POWER:L', 'HL2:1']], false],
    [
      'both on L',
      [
        ['POWER:L', 'HL2:1'],
        ['HL2:2', 'POWER:L'],
      ],
      false,
    ],
    [
      'both on N',
      [
        ['POWER:N', 'HL2:1'],
        ['HL2:2', 'POWER:N'],
      ],
      false,
    ],
  ] as [string, [string, string][], boolean][])(
    'handles a lamp with %s',
    (_name, pairs, expected) => {
      const state = simulate(connect(...pairs), {}, true);
      expect(state.fault).toBeNull();
      expect(state.lamps.HL2).toBe(expected);
    },
  );

  it('does not energize a coil with a single connected lead or with equal potentials', () => {
    expect(simulate(connect(['POWER:L', 'KM1:A1']), {}, true).coils.KM1).toBe(false);
    expect(
      simulate(connect(['POWER:L', 'KM1:A1'], ['POWER:L', 'KM1:A2']), {}, true).coils.KM1,
    ).toBe(false);
  });

  it('supports all coils and lamps on parallel branches without treating loads as shorts', () => {
    const pairs: [string, string][] = [1, 2, 3].flatMap(
      (n) =>
        [
          ['POWER:L', `KM${n}:A1`],
          [`KM${n}:A2`, 'POWER:N'],
          ['POWER:L', `HL${n}:1`],
          [`HL${n}:2`, 'POWER:N'],
        ] as [string, string][],
    );
    const state = simulate(connect(...pairs), {}, true);
    expect(state.fault).toBeNull();
    expect(state.coils).toEqual({ KM1: true, KM2: true, KM3: true });
    expect(state.lamps).toEqual({ HL1: true, HL2: true, HL3: true });
    expect(state.potential['KM1:A1']).toBe('L');
    expect(state.potential['KM1:A2']).toBe('N');
  });

  it('explicitly rejects series lamps and a coil/lamp divider', () => {
    for (const [from, to] of [
      ['HL1:1', 'HL1:2'],
      ['KM1:A1', 'KM1:A2'],
    ]) {
      const state = simulate(
        connect(['POWER:L', from], [to, 'HL2:1'], ['HL2:2', 'POWER:N']),
        {},
        true,
      );
      expect(state.fault?.kind).toBe('unsupported');
      expect(Object.values(state.coils).some(Boolean)).toBe(false);
      expect(Object.values(state.lamps).some(Boolean)).toBe(false);
    }
  });

  it('rejects a parallel load group in series with another load', () => {
    const state = simulate(
      connect(
        ['POWER:L', 'HL1:1'],
        ['POWER:L', 'HL2:1'],
        ['HL1:2', 'HL2:2'],
        ['HL1:2', 'HL3:1'],
        ['HL3:2', 'POWER:N'],
      ),
      {},
      true,
    );
    expect(state.fault?.kind).toBe('unsupported');
    expect(state.fault?.terminals).toEqual(expect.arrayContaining(['HL1:1', 'HL2:1', 'HL3:2']));
  });

  it('does not reject dangling loads alongside a valid parallel branch', () => {
    const state = simulate(
      connect(['POWER:L', 'HL1:1'], ['HL1:2', 'POWER:N'], ['POWER:L', 'HL2:1'], ['HL2:2', 'HL3:1']),
      {},
      true,
    );
    expect(state.fault).toBeNull();
    expect(state.lamps).toEqual({ HL1: true, HL2: false, HL3: false });
  });

  it('does not reject an unpowered load cluster whose branches all return to one rail', () => {
    const state = simulate(
      connect(['POWER:L', 'HL1:1'], ['HL1:2', 'HL2:1'], ['HL2:2', 'POWER:L']),
      {},
      true,
    );
    expect(state.fault).toBeNull();
    expect(state.lamps.HL1).toBe(false);
    expect(state.lamps.HL2).toBe(false);
  });

  it('allows a bypassed series load and only energizes the remaining complete load', () => {
    const state = simulate(
      connect(['POWER:L', 'HL1:1'], ['HL1:1', 'HL1:2'], ['HL1:2', 'HL2:1'], ['HL2:2', 'POWER:N']),
      {},
      true,
    );
    expect(state.fault).toBeNull();
    expect(state.lamps).toEqual({ HL1: false, HL2: true, HL3: false });
  });
});

describe('contacts follow actual inputs and their parent coil', () => {
  it.each(['SB1', 'SB2', 'SB3', 'SQ1', 'SQ2'])(
    '%s switches both independent NO and NC paths',
    (id) => {
      const wires = connect(
        ['POWER:L', `${id}:NC1`],
        [`${id}:NC2`, 'HL1:1'],
        ['HL1:2', 'POWER:N'],
        ['POWER:L', `${id}:NO3`],
        [`${id}:NO4`, 'HL2:1'],
        ['HL2:2', 'POWER:N'],
      );
      expect(simulate(wires, {}, true).lamps).toEqual({ HL1: true, HL2: false, HL3: false });
      expect(simulate(wires, { [id]: true }, true).lamps).toEqual({
        HL1: false,
        HL2: true,
        HL3: false,
      });
    },
  );

  it('does not assign start/stop behavior based on button color or ID', () => {
    const wires = connect(['POWER:L', 'SB1:NO3'], ['SB1:NO4', 'HL2:1'], ['HL2:2', 'POWER:N']);
    expect(simulate(wires, { SB1: true }, true).lamps.HL2).toBe(true);
  });

  it('moves every main and auxiliary contact together, then releases on supply removal', () => {
    const wires = connect(['POWER:L', 'KM2:A1'], ['KM2:A2', 'POWER:N']);
    const active = simulate(wires, {}, true);
    for (const label of ['L1-T1', 'L2-T2', 'L3-T3', '13-14', '53-54', '83-84'])
      expect(active.closedContacts).toContain(`KM2:${label}`);
    for (const label of ['61-62', '71-72'])
      expect(active.closedContacts).not.toContain(`KM2:${label}`);
    const released = simulate([], {}, true, active.coils);
    expect(released.coils.KM2).toBe(false);
    expect(released.closedContacts).toContain('KM2:61-62');
    expect(released.closedContacts).not.toContain('KM2:13-14');
  });

  it('does not light a lamp merely because a contactor energizes', () => {
    const state = simulate(connect(['POWER:L', 'KM1:A1'], ['KM1:A2', 'POWER:N']), {}, true);
    expect(state.coils.KM1).toBe(true);
    expect(state.lamps).toEqual({ HL1: false, HL2: false, HL3: false });
  });

  it('resolves a cascade of three coils in the same user action', () => {
    const state = simulate(
      connect(
        ['POWER:L', 'KM1:A1'],
        ['KM1:A2', 'POWER:N'],
        ['POWER:L', 'KM1:13'],
        ['KM1:14', 'KM2:A1'],
        ['KM2:A2', 'POWER:N'],
        ['POWER:L', 'KM2:13'],
        ['KM2:14', 'KM3:A1'],
        ['KM3:A2', 'POWER:N'],
        ['POWER:L', 'KM3:13'],
        ['KM3:14', 'HL3:1'],
        ['HL3:2', 'POWER:N'],
      ),
      {},
      true,
    );
    expect(state.fault).toBeNull();
    expect(state.coils).toEqual({ KM1: true, KM2: true, KM3: true });
    expect(state.lamps.HL3).toBe(true);
  });

  it('changes thermal auxiliary contacts without opening its three power paths', () => {
    const wires = connect(['POWER:L', 'FR2:L1'], ['FR2:T1', 'HL1:1'], ['HL1:2', 'POWER:N']);
    const state = simulate(wires, { FR2: true }, true);
    expect(state.lamps.HL1).toBe(true);
    expect(state.closedContacts).toContain('FR2:L1-T1');
    expect(state.closedContacts).toContain('FR2:L2-T2');
    expect(state.closedContacts).toContain('FR2:L3-T3');
    expect(state.closedContacts).toContain('FR2:97-98');
    expect(state.closedContacts).not.toContain('FR2:95-96');
  });

  it('keeps unrelated circuits operating when emergency stop or FR is not wired in', () => {
    const state = simulate(
      connect(['POWER:L', 'KM1:A1'], ['KM1:A2', 'POWER:N']),
      { ESTOP: true, FR1: true },
      true,
    );
    expect(state.coils.KM1).toBe(true);
  });
});

describe('example circuits and self-holding memory', () => {
  it('runs the button-lamp example only while SB2 is pressed', () => {
    const wires = example('button-lamp');
    expect(simulate(wires, {}, true).lamps.HL2).toBe(false);
    expect(simulate(wires, { SB2: true }, true).lamps.HL2).toBe(true);
    expect(simulate(wires, {}, true).lamps.HL2).toBe(false);
  });

  it('runs the contactor-jog example without an accidental latch', () => {
    const wires = example('contactor-jog');
    const on = simulate(wires, { SB2: true }, true);
    expect(on.coils.KM1).toBe(true);
    expect(on.lamps.HL2).toBe(true);
    const off = simulate(wires, {}, true, on.coils);
    expect(off.coils.KM1).toBe(false);
    expect(off.lamps.HL2).toBe(false);
  });

  it('starts, holds after release, stops, and waits for another start command', () => {
    const wires = example('self-hold');
    const initial = simulate(wires, {}, true);
    expect(initial.lamps).toEqual({ HL1: true, HL2: false, HL3: false });
    const starting = simulate(wires, { SB2: true }, true, initial.coils);
    expect(starting.coils.KM1).toBe(true);
    const holding = simulate(wires, {}, true, starting.coils);
    expect(holding.coils.KM1).toBe(true);
    expect(holding.lamps).toEqual({ HL1: false, HL2: true, HL3: false });
    const stopped = simulate(wires, { SB1: true }, true, holding.coils);
    expect(stopped.coils.KM1).toBe(false);
    expect(simulate(wires, {}, true, stopped.coils).coils.KM1).toBe(false);
  });

  it('cannot hold when the actual self-holding wire is removed', () => {
    const wires = example('self-hold').filter((wire) => wire.from !== 'KM1:14');
    const starting = simulate(wires, { SB2: true }, true);
    expect(starting.coils.KM1).toBe(true);
    expect(simulate(wires, {}, true, starting.coils).coils.KM1).toBe(false);
  });

  it.each(['ESTOP', 'FR1'])(
    '%s breaks the wired holding circuit; resetting alone does not restart it',
    (input) => {
      const wires = example('self-hold');
      const running = simulate(wires, { SB2: true }, true);
      const tripped = simulate(wires, { [input]: true }, true, running.coils);
      expect(tripped.coils.KM1).toBe(false);
      expect(tripped.lamps.HL3).toBe(input === 'FR1');
      expect(simulate(wires, {}, true, tripped.coils).coils.KM1).toBe(false);
    },
  );

  it('a physically bypassed emergency stop does not magically stop the circuit', () => {
    const wires = [
      ...example('self-hold'),
      { id: 'bypass', from: 'ESTOP:NC1', to: 'ESTOP:NC2', color: '#000' },
    ];
    const running = simulate(wires, { SB2: true }, true);
    expect(simulate(wires, { ESTOP: true }, true, running.coils).coils.KM1).toBe(true);
  });

  it('power-off releases coils, blanks potentials, and clears electrical holding memory', () => {
    const wires = example('self-hold');
    const running = simulate(wires, { SB2: true }, true);
    const off = simulate(wires, {}, false, running.coils);
    expect(off.coils.KM1).toBe(false);
    expect(Object.values(off.lamps).some(Boolean)).toBe(false);
    expect(Object.values(off.potential).every((potential) => potential === 'floating')).toBe(true);
    expect(simulate(wires, {}, true, off.coils).coils.KM1).toBe(false);
  });
});

describe('fault detection and useful localization', () => {
  it('finds a direct short and does not count lamp branches as its path', () => {
    const wires = connect(['POWER:L', 'POWER:N'], ['POWER:L', 'HL1:1'], ['HL1:2', 'POWER:N']);
    const state = simulate(wires, {}, true);
    expect(state.fault?.kind).toBe('short');
    expect(state.fault?.wireIds).toEqual(['w1']);
    expect(state.fault?.terminals).toEqual(['POWER:L', 'POWER:N']);
    expect(state.lamps.HL1).toBe(false);
  });

  it('finds a short through a pressed button and provides the conductor path', () => {
    const wires = connect(['POWER:L', 'SB3:NO3'], ['SB3:NO4', 'POWER:N']);
    expect(simulate(wires, {}, true).fault).toBeNull();
    const state = simulate(wires, { SB3: true }, true);
    expect(state.fault?.kind).toBe('short');
    expect(state.fault?.wireIds).toEqual(['w1', 'w2']);
    expect(state.fault?.terminals).toEqual(['POWER:L', 'SB3:NO3', 'SB3:NO4', 'POWER:N']);
  });

  it('detects a short created by a contactor after its coil energizes', () => {
    const state = simulate(
      connect(
        ['POWER:L', 'KM1:A1'],
        ['KM1:A2', 'POWER:N'],
        ['POWER:L', 'KM1:L1'],
        ['KM1:T1', 'POWER:N'],
      ),
      {},
      true,
    );
    expect(state.fault?.kind).toBe('short');
    expect(state.fault?.wireIds).toEqual(['w3', 'w4']);
  });

  it('does not report a short while supply is off', () => {
    expect(simulate(connect(['POWER:L', 'POWER:N']), {}, false).fault).toBeNull();
  });

  it('rejects motor and three-phase reserved terminals explicitly', () => {
    for (const terminal of ['POWER:U2', 'POWER:V2', 'POWER:W2', 'MOTOR:U1', 'MOTOR:U2']) {
      const state = simulate(connect([terminal, 'KM1:L1']), {}, true);
      expect(state.fault?.kind).toBe('unsupported');
      expect(state.fault?.terminals).toContain(terminal);
    }
  });

  it('detects coil chatter caused by its own normally closed contact', () => {
    const state = simulate(
      connect(['POWER:L', 'KM1:61'], ['KM1:62', 'KM1:A1'], ['KM1:A2', 'POWER:N']),
      {},
      true,
    );
    expect(state.fault?.kind).toBe('unstable');
    expect(state.fault?.terminals).toContain('KM1:A1');
    expect(state.coils.KM1).toBe(false);
  });

  it('recovers from an unstable circuit after its problematic wire is removed', () => {
    const state = simulate(connect(['KM1:62', 'KM1:A1'], ['KM1:A2', 'POWER:N']), {}, true);
    expect(state.fault).toBeNull();
    expect(state.coils.KM1).toBe(false);
  });
});
