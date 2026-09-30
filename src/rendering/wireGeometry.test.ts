import { describe, expect, it } from 'vitest';
import { roundedWirePath } from './wireGeometry';

/** Read the generated arc commands to check geometric bounds, not just snapshots. */
function arcs(path: string): number[][] {
  return [...path.matchAll(/A ([^AML]+)/g)].map((match) =>
    match[1].trim().split(/\s+/).map(Number),
  );
}

describe('rounded wire rendering geometry', () => {
  it('keeps both endpoints exact and joins a right-angle route tangentially', () => {
    const path = roundedWirePath([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
    ]);
    expect(path).toBe('M 0 0 L 30 0 A 10 10 0 0 1 40 10 L 40 40');
    expect(
      roundedWirePath([
        { x: 0.123456789, y: -2 },
        { x: 2, y: 4.987654321 },
      ]),
    ).toBe('M 0.123456789 -2 L 2 4.987654321');
  });

  it('limits a bend to half of the shorter adjacent segment', () => {
    const path = roundedWirePath(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
      ],
      100,
    );
    const [arc] = arcs(path);
    expect(arc[0]).toBe(1.5);
    expect(arc.slice(-2)).toEqual([4, 1.5]);
    expect(path).toContain('L 2.5 0');
    expect(path.endsWith('L 4 3')).toBe(true);
  });

  it('does not make neighboring bends overlap on a short shared segment', () => {
    const path = roundedWirePath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 20, y: 4 },
    ]);
    expect(arcs(path).map((arc) => arc[0])).toEqual([2, 2]);
    expect(path).toContain('A 2 2 0 0 1 10 2 L 10 2 A 2 2 0 0 0 12 4');
  });

  it('handles duplicate points and zero-length routes without invalid SVG numbers', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
    ];
    expect(roundedWirePath([route[0], route[0], route[1], route[1], route[2], route[2]])).toBe(
      roundedWirePath(route),
    );
    expect(roundedWirePath([])).toBe('');
    expect(
      roundedWirePath([
        { x: 2, y: 3 },
        { x: 2, y: 3 },
      ]),
    ).toBe('M 2 3');
  });

  it('preserves straight paths and explicit foldbacks without invented loops', () => {
    expect(
      roundedWirePath([
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 40, y: 0 },
      ]),
    ).toBe('M 0 0 L 20 0 L 40 0');
    expect(
      roundedWirePath([
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 0, y: 0 },
      ]),
    ).toBe('M 0 0 L 20 0 L 0 0');
  });

  it('uses the correct sweep for mirrored bends and supports non-right-angle turns', () => {
    const down = arcs(
      roundedWirePath([
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 60, y: 20 },
      ]),
    )[0];
    const up = arcs(
      roundedWirePath([
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 60, y: -20 },
      ]),
    )[0];
    expect(down[0]).toBe(10);
    expect(down[4]).toBe(1);
    expect(up[4]).toBe(0);
    expect(down[5]).toBeCloseTo(42.928932, 5);
    expect(down[6]).toBeCloseTo(2.928932, 5);
    expect(up[5]).toBe(down[5]);
    expect(up[6]).toBe(-down[6]);
  });

  it('keeps sharp almost-reversals and tiny segments finite', () => {
    for (const path of [
      roundedWirePath([
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 0, y: 0.00000001 },
      ]),
      roundedWirePath([
        { x: 0, y: 0 },
        { x: 0.00000001, y: 0 },
        { x: 0.00000001, y: 20 },
      ]),
    ]) {
      expect(path).not.toMatch(/NaN|Infinity|A 0 /);
      expect(path.startsWith('M 0 0')).toBe(true);
    }
  });

  it('does not mutate frozen original control points or change them into arc handles', () => {
    const points = Object.freeze([
      Object.freeze({ x: 1, y: 2 }),
      Object.freeze({ x: 30, y: 2 }),
      Object.freeze({ x: 30, y: 40 }),
    ]);
    const saved = JSON.stringify(points);
    expect(roundedWirePath(points)).toContain(' A ');
    expect(JSON.stringify(points)).toBe(saved);
  });

  it('allows zero radius and safely avoids non-finite input geometry', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ];
    expect(roundedWirePath(points, 0)).toBe('M 0 0 L 20 0 L 20 20');
    expect(roundedWirePath(points, -10)).toBe(roundedWirePath(points, 0));
    expect(roundedWirePath(points, NaN)).toBe(roundedWirePath(points, 0));
    expect(
      roundedWirePath([
        { x: 0, y: 0 },
        { x: Infinity, y: 20 },
      ]),
    ).toBe('');
  });
});
