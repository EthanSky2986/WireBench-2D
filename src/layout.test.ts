import { describe, expect, it } from 'vitest';
import { TERMINAL_IDS } from './sim/model';
import {
  SOCKETS,
  SOCKET_MAP,
  PLACEMENT_MAP,
  strips,
  clampPoint,
  BUTTON_STRIPS,
  wirePoints,
} from './layout';
import { encodeProject, parseProject } from './project';

describe('layout and persisted wiring contract', () => {
  it('exposes every model terminal exactly once', () => {
    expect(SOCKETS.map((s) => s.id).sort()).toEqual([...TERMINAL_IDS].sort());
    expect(new Set(SOCKETS.map((s) => `${s.x},${s.y}`)).size).toBe(SOCKETS.length);
  });
  it('keeps connection endpoints anchored when the route changes', () => {
    const route = wirePoints('POWER:L', 'KM1:A1', [{ x: 999, y: 666 }]);
    expect(route[0]).toEqual(SOCKET_MAP['POWER:L']);
    expect(route.at(-1)).toEqual(SOCKET_MAP['KM1:A1']);
  });
  it('matches the sketch order: motor terminals, both SQ strips, both SQ bodies, SB terminals', () => {
    const motor = strips.find((s) => s.deviceId === 'MOTOR')!,
      sq1 = strips.find((s) => s.deviceId === 'SQ1')!,
      sq2 = strips.find((s) => s.deviceId === 'SQ2')!,
      sb1 = strips.find((s) => s.deviceId === 'SB1')!,
      body1 = PLACEMENT_MAP.SQ1,
      body2 = PLACEMENT_MAP.SQ2;
    expect(motor.x + motor.labels.length * motor.step + 6).toBeLessThan(sq1.x - 6);
    expect(sq1.x + sq1.labels.length * sq1.step + 6).toBeLessThan(sq2.x - 6);
    expect(sq2.x + sq2.labels.length * sq2.step + 6).toBeLessThan(body1.x);
    expect(body1.x + body1.size).toBeLessThan(body2.x);
    expect(body2.x + body2.size + 6).toBeLessThan(sb1.x - 6);
    for (const [group, body] of [
      [sq1, body1],
      [sq2, body2],
    ] as const) {
      expect(body.y).toBeLessThan(group.y + 62);
      expect(body.y + body.size).toBeGreaterThan(group.y);
      expect(body.labelX).toBeGreaterThan(group.x);
      expect(body.labelX).toBeLessThan(group.x + group.labels.length * group.step);
      expect(body.labelY).toBeLessThan(group.y);
    }
  });
  it('keeps the SB and emergency-stop terminals in one continuous bank without merging identities', () => {
    expect(BUTTON_STRIPS.map((s) => s.deviceId)).toEqual(['SB1', 'SB2', 'SB3', 'ESTOP']);
    expect(BUTTON_STRIPS.map((s) => s.labels.length)).toEqual([4, 4, 4, 2]);
    for (let i = 1; i < BUTTON_STRIPS.length; i++) {
      const previous = BUTTON_STRIPS[i - 1],
        current = BUTTON_STRIPS[i];
      expect(current.x).toBe(previous.x + previous.labels.length * previous.step);
      expect(current.y).toBe(previous.y);
    }
    const ids = BUTTON_STRIPS.flatMap((s) => s.labels.map((label) => `${s.deviceId}:${label}`));
    expect(new Set(ids).size).toBe(14);
    const saved = parseProject(
      encodeProject('SB continuity', [
        {
          id: 'button-connection',
          from: 'SB2:NO4',
          to: 'ESTOP:NC1',
          color: '#32866d',
          points: [{ x: 1190, y: 610 }],
        },
      ]),
    ).wires[0];
    const route = wirePoints(saved.from, saved.to, saved.points);
    expect(route[0]).toEqual(SOCKET_MAP['SB2:NO4']);
    expect(route.at(-1)).toEqual(SOCKET_MAP['ESTOP:NC1']);
    expect(route[1]).toEqual({ x: 1190, y: 610 });
  });
  it('restores custom SQ routes by stable terminal IDs after the visual rearrangement', () => {
    const wires = [
      {
        id: 'sq-custom-route',
        from: 'SQ1:NO3',
        to: 'SQ2:NC1',
        color: '#527da3',
        points: [
          { x: 610, y: 580 },
          { x: 610, y: 615 },
        ],
      },
    ];
    const saved = parseProject(encodeProject('SQ route', wires)).wires;
    expect(saved).toEqual(wires);
    const [wire] = saved,
      route = wirePoints(wire.from, wire.to, wire.points);
    expect(route[0]).toEqual(SOCKET_MAP['SQ1:NO3']);
    expect(route.at(-1)).toEqual(SOCKET_MAP['SQ2:NC1']);
    expect(route.slice(1, -1)).toEqual(wires[0].points);
  });
  it('keeps a route dragged far outside the panel saveable', () => {
    const wires = [
      {
        id: 'far-route',
        from: 'POWER:L',
        to: 'HL1:1',
        color: '#32866d',
        points: [clampPoint({ x: -9000, y: 12000 })],
      },
    ];
    expect(parseProject(encodeProject('越界拖动', wires)).wires).toEqual(wires);
  });
});
