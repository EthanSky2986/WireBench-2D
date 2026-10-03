import { describe, expect, it } from 'vitest';
import { BOARD, SOCKET_MAP, placements, strips, wirePoints, type Point } from '../layout';
import { PROJECT_LIMITS } from '../limits';
import { EXAMPLES } from '../sim/examples';
import type { Wire } from '../sim/model';
import { encodeProject, parseProject } from '../project';
import { arrangeAutomaticWires, routeNewWire } from './wireRouting';

function wire(id: string, from: string, to: string, points?: Point[]): Wire {
  return { id, from, to, color: '#e35a64', ...(points === undefined ? {} : { points }) };
}

function full(wire: Wire): Point[] {
  return wirePoints(wire.from, wire.to, wire.points);
}

function overlap(a: number, b: number, c: number, d: number): number {
  return Math.max(
    0,
    Math.min(Math.max(a, b), Math.max(c, d)) - Math.max(Math.min(a, b), Math.min(c, d)),
  );
}

/** Measure ambiguous shared line length independently of the router's scoring. */
function sharedLength(wires: Wire[]): number {
  let total = 0;
  for (let first = 0; first < wires.length; first++) {
    const a = full(wires[first]);
    for (let second = first + 1; second < wires.length; second++) {
      const b = full(wires[second]);
      for (let i = 1; i < a.length; i++) {
        for (let j = 1; j < b.length; j++) {
          if (a[i - 1].x === a[i].x && a[i].x === b[j - 1].x && b[j - 1].x === b[j].x)
            total += overlap(a[i - 1].y, a[i].y, b[j - 1].y, b[j].y);
          if (a[i - 1].y === a[i].y && a[i].y === b[j - 1].y && b[j - 1].y === b[j].y)
            total += overlap(a[i - 1].x, a[i].x, b[j - 1].x, b[j].x);
        }
      }
    }
  }
  return total;
}

/** Count long parallel runs that would still look crowded at the usual fit scale. */
function crowdedParallelLength(wires: Wire[]): number {
  const segments = wires.flatMap((wire) => {
    const points = full(wire);
    return points.slice(1).map((point, index) => ({ id: wire.id, a: points[index], b: point }));
  });
  let crowded = 0;
  for (let first = 0; first < segments.length; first++) {
    const a = segments[first];
    for (let second = first + 1; second < segments.length; second++) {
      const b = segments[second];
      if (a.id === b.id) continue;
      const horizontal = a.a.y === a.b.y && b.a.y === b.b.y;
      const vertical = a.a.x === a.b.x && b.a.x === b.b.x;
      if (!horizontal && !vertical) continue;
      const separation = horizontal ? Math.abs(a.a.y - b.a.y) : Math.abs(a.a.x - b.a.x);
      const shared = horizontal
        ? overlap(a.a.x, a.b.x, b.a.x, b.b.x)
        : overlap(a.a.y, a.b.y, b.a.y, b.b.y);
      // Short shared socket exits are unavoidable and are not long routing lanes.
      if (separation < 16 && shared > 80) crowded += shared;
    }
  }
  return crowded;
}

function expectOrthogonal(points: Point[]): void {
  for (let index = 1; index < points.length; index++) {
    expect(points[index].x === points[index - 1].x || points[index].y === points[index - 1].y).toBe(
      true,
    );
    expect(points[index]).not.toEqual(points[index - 1]);
  }
}

function hitsRectangle(
  points: Point[],
  rect: { left: number; right: number; top: number; bottom: number },
): boolean {
  return points.slice(1).some((point, index) => {
    const previous = points[index];
    if (point.x === previous.x)
      return (
        point.x > rect.left &&
        point.x < rect.right &&
        overlap(point.y, previous.y, rect.top, rect.bottom) > 0
      );
    return (
      point.y > rect.top &&
      point.y < rect.bottom &&
      overlap(point.x, previous.x, rect.left, rect.right) > 0
    );
  });
}

describe('automatic bench wire routing', () => {
  it('reduces shared line length in the self-hold exercise instead of just choosing different hashes', () => {
    const originals = EXAMPLES.find((example) => example.id === 'self-hold')!.wires;
    const arranged = arrangeAutomaticWires(originals);
    expect(sharedLength(arranged)).toBeLessThan(sharedLength(originals) * 0.6);
  });

  it('leaves breathing room along most long self-hold runs at the usual fitted scale', () => {
    const arranged = arrangeAutomaticWires(
      EXAMPLES.find((example) => example.id === 'self-hold')!.wires,
    );
    const totalLength = arranged.reduce((sum, wire) => {
      const points = full(wire);
      return (
        sum +
        points
          .slice(1)
          .reduce(
            (run, point, index) =>
              run + Math.hypot(point.x - points[index].x, point.y - points[index].y),
            0,
          )
      );
    }, 0);
    // Coincidence alone misses the visual problem: lanes only 10 world units
    // apart are 7 screen pixels apart at 70% fit. Some narrow corridors remain,
    // but nearby long parallel runs should account for under a quarter of wire length.
    expect(crowdedParallelLength(arranged)).toBeLessThan(totalLength * 0.25);
  });

  it('separates several same-row leads and keeps short connections local', () => {
    const originals = [
      wire('a', 'SB1:NC1', 'SB3:NO4'),
      wire('b', 'SB1:NC2', 'SB3:NO3'),
      wire('c', 'SB1:NO3', 'SB3:NC2'),
      wire('d', 'SB1:NO4', 'SB3:NC1'),
    ];
    const arranged = arrangeAutomaticWires(originals);
    expect(sharedLength(arranged)).toBe(0);
    for (const item of arranged) {
      const points = full(item);
      expectOrthogonal(points);
      expect(Math.min(...points.map((point) => point.y))).toBeGreaterThanOrEqual(554);
      expect(points.every((point) => point.x >= 656 && point.x <= 1136)).toBe(true);
    }
    const near = routeNewWire('SB1:NO3', 'SB1:NO4', []);
    expect(near).toHaveLength(4);
    expect(
      Math.max(...near.map((point) => point.x)) - Math.min(...near.map((point) => point.x)),
    ).toBe(40);
  });

  it('preserves exact endpoints and outlet directions for same and opposite strip faces', () => {
    for (const [from, to] of [
      ['KM1:13', 'KM2:13'],
      ['HL1:1', 'HL2:1'],
      ['POWER:L', 'KM1:A1'],
      ['POWER:N', 'HL3:2'],
      ['FR1:96', 'SB2:NO3'],
      ['KM1:14', 'KM1:A1'],
      ['SQ2:NO4', 'MOTOR:W2'],
      ['POWER:L', 'POWER:N'],
    ]) {
      const points = routeNewWire(from, to, []);
      const a = SOCKET_MAP[from];
      const b = SOCKET_MAP[to];
      expect(points[0]).toEqual({ x: a.x, y: a.y });
      expect(points.at(-1)).toEqual({ x: b.x, y: b.y });
      expectOrthogonal(points);
      expect(points[1].x).toBe(a.x);
      expect(Math.sign(points[1].y - a.y)).toBe(a.side === 'top' ? -1 : 1);
      expect(points.at(-2)!.x).toBe(b.x);
      expect(Math.sign(points.at(-2)!.y - b.y)).toBe(b.side === 'top' ? -1 : 1);
    }
  });

  it('avoids device faces and unrelated terminal banks in the built-in exercises', () => {
    for (const example of EXAMPLES) {
      for (const item of arrangeAutomaticWires(example.wires)) {
        const points = full(item);
        for (const part of placements) {
          expect(
            hitsRectangle(points, {
              left: part.x,
              right: part.x + part.size,
              top: part.y,
              bottom: part.y + part.size,
            }),
            `${item.id} crossing ${part.id}`,
          ).toBe(false);
        }
        for (const strip of strips) {
          if (
            [item.from, item.to].some((id) =>
              strip.labels.some((label) => id === `${strip.deviceId}:${label}`),
            )
          )
            continue;
          expect(
            hitsRectangle(points, {
              left: strip.x,
              right: strip.x + strip.labels.length * strip.step,
              top: strip.y,
              bottom: strip.y + 62,
            }),
            `${item.id} crossing ${strip.deviceId} strip`,
          ).toBe(false);
        }
      }
    }
  });

  it('preserves every explicit route, including direct lines and later entries, without mutation', () => {
    const manual = wire('manual', 'SB1:NC1', 'SB3:NO4', [
      { x: 676, y: 620 },
      { x: 1116, y: 620 },
    ]);
    const direct = wire('direct', 'HL1:1', 'HL1:2', []);
    const automatic = wire('auto', 'SB1:NC2', 'SB3:NO3');
    Object.freeze(manual.points);
    Object.freeze(manual);
    Object.freeze(direct);
    Object.freeze(automatic);
    const input = Object.freeze([automatic, manual, direct]);
    const saved = JSON.stringify(input);
    const arranged = arrangeAutomaticWires(input);
    expect(arranged[1]).toBe(manual);
    expect(arranged[2]).toBe(direct);
    expect(JSON.stringify(input)).toBe(saved);
    expect(sharedLength(arranged)).toBe(0);
    expect(arrangeAutomaticWires(arranged).every((item, index) => item === arranged[index])).toBe(
      true,
    );
  });

  it('leaves existing wires stationary when adding a wire and deterministically separates it', () => {
    const existing = arrangeAutomaticWires([wire('one', 'SB1:NC1', 'SB3:NO4')]);
    const before = JSON.stringify(existing);
    const added = routeNewWire('SB1:NC2', 'SB3:NO3', existing);
    expect(added).toEqual(routeNewWire('SB1:NC2', 'SB3:NO3', existing));
    expect(JSON.stringify(existing)).toBe(before);
    expect(sharedLength([...existing, wire('two', 'SB1:NC2', 'SB3:NO3', added.slice(1, -1))])).toBe(
      0,
    );
  });

  it('fans connections from a common socket without moving the common electrical endpoint', () => {
    const input = ['KM1:A1', 'KM2:A1', 'KM3:A1', 'FR1:L1'].map((to, index) =>
      wire(`fan-${index}`, 'POWER:L', to),
    );
    const arranged = arrangeAutomaticWires(input);
    for (const item of arranged)
      expect(full(item)[0]).toMatchObject({
        x: SOCKET_MAP['POWER:L'].x,
        y: SOCKET_MAP['POWER:L'].y,
      });
    // The shared socket exit is unavoidable; long horizontal runs must split.
    const longRuns = arranged.map((item) =>
      full(item)
        .slice(1)
        .flatMap((point, index) => {
          const previous = full(item)[index];
          return point.y === previous.y && Math.abs(point.x - previous.x) > 80 ? [point.y] : [];
        }),
    );
    expect(new Set(longRuns.flat()).size).toBeGreaterThan(1);
    expect(sharedLength(arranged)).toBeLessThan(300);
  });

  it('returns bounded, saveable geometry with unchanged topology and deterministic arrangement', () => {
    const input = EXAMPLES.flatMap((example) =>
      example.wires.map((item) => ({ ...item, id: `${example.id}-${item.id}` })),
    );
    // Each actual example is independently valid; repeated topology across examples is not a project.
    expect(arrangeAutomaticWires(input)).toEqual(arrangeAutomaticWires(input));
    for (const example of EXAMPLES) {
      const arranged = arrangeAutomaticWires(example.wires);
      expect(parseProject(encodeProject(example.name, arranged)).wires).toEqual(arranged);
      for (const [index, item] of arranged.entries()) {
        expect({ ...item, points: undefined }).toEqual({
          ...example.wires[index],
          points: undefined,
        });
        expect(item.points!.length).toBeLessThanOrEqual(PROJECT_LIMITS.maxPoints);
        for (const point of full(item)) {
          expect(Number.isFinite(point.x + point.y)).toBe(true);
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(BOARD.width);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(BOARD.height);
        }
      }
    }
  });

  it('does not invent routes for missing or identical endpoints', () => {
    expect(routeNewWire('missing', 'POWER:L', [])).toEqual([]);
    expect(routeNewWire('POWER:L', 'missing', [])).toEqual([]);
    expect(routeNewWire('POWER:L', 'POWER:L', [])).toEqual([]);
    expect(arrangeAutomaticWires([])).toEqual([]);
  });
});
