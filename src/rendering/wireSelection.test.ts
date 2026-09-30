import { describe, expect, it } from 'vitest';
import {
  findWireCandidates,
  nextWireCandidate,
  type WireSelectionCandidate,
} from './wireSelection';

const horizontal: WireSelectionCandidate = {
  id: 'horizontal',
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
};

describe('wire selection hit testing', () => {
  it('finds both wires at a crossing but only the nearby segment away from it', () => {
    const vertical: WireSelectionCandidate = {
      id: 'vertical',
      points: [
        { x: 50, y: -50 },
        { x: 50, y: 50 },
      ],
    };
    expect(findWireCandidates([horizontal, vertical], { x: 50, y: 0 })).toEqual([
      'horizontal',
      'vertical',
    ]);
    expect(findWireCandidates([horizontal, vertical], { x: 70, y: 3 })).toEqual(['horizontal']);
    expect(findWireCandidates([horizontal, vertical], { x: 53, y: 25 })).toEqual(['vertical']);
  });

  it('finds partial collinear overlaps in source order, including reversed routes', () => {
    const reversed: WireSelectionCandidate = {
      id: 'reversed',
      points: [
        { x: 140, y: 0 },
        { x: 60, y: 0 },
      ],
    };
    const wires = [reversed, horizontal];
    expect(findWireCandidates(wires, { x: 80, y: 0 })).toEqual(['reversed', 'horizontal']);
    expect(findWireCandidates(wires, { x: 40, y: 0 })).toEqual(['horizontal']);
    expect(findWireCandidates(wires, { x: 120, y: 0 })).toEqual(['reversed']);
  });

  it('clamps projection to endpoints instead of selecting infinite line extensions', () => {
    expect(findWireCandidates([horizontal], { x: 106, y: 6 }, 8)).toEqual([]);
    expect(findWireCandidates([horizontal], { x: 106, y: 0 }, 8)).toEqual(['horizontal']);
    expect(findWireCandidates([horizontal], { x: -20, y: 0 }, 8)).toEqual([]);
  });

  it('uses diagonal segment distance and visits every segment in a bent route', () => {
    const bent: WireSelectionCandidate = {
      id: 'bent',
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 20 },
        { x: 100, y: 20 },
      ],
    };
    expect(findWireCandidates([bent], { x: 10, y: 14 }, 3)).toEqual(['bent']);
    expect(findWireCandidates([bent], { x: 10, y: 15 }, 3)).toEqual([]);
    expect(findWireCandidates([bent], { x: 80, y: 22 }, 3)).toEqual(['bent']);
    expect(findWireCandidates([bent], { x: 18, y: 20 }, 3)).toEqual(['bent']);
  });

  it('keeps the hit tolerance constant in screen pixels at different zoom levels', () => {
    for (const scale of [0.4, 1, 2.5]) {
      expect(findWireCandidates([horizontal], { x: 50, y: 7 / scale }, 8, scale)).toEqual([
        'horizontal',
      ]);
      expect(findWireCandidates([horizontal], { x: 50, y: 9 / scale }, 8, scale)).toEqual([]);
    }
  });

  it('handles empty, collapsed, and duplicate-point routes without skipping later segments', () => {
    const candidates: WireSelectionCandidate[] = [
      { id: 'empty', points: [] },
      { id: 'point', points: [{ x: 10, y: 10 }] },
      {
        id: 'collapsed',
        points: [
          { x: 10, y: 10 },
          { x: 10, y: 10 },
        ],
      },
      {
        id: 'duplicates',
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      },
    ];
    expect(findWireCandidates(candidates, { x: 10, y: 10 }, 2)).toEqual(['point', 'collapsed']);
    expect(findWireCandidates(candidates, { x: 80, y: 0 }, 2)).toEqual(['duplicates']);
  });

  it('does not mutate frozen input routes or reorder candidates', () => {
    const points = Object.freeze([Object.freeze({ x: 0, y: 0 }), Object.freeze({ x: 100, y: 0 })]);
    const candidates = Object.freeze([
      Object.freeze({ id: 'a', points }),
      Object.freeze({ id: 'b', points }),
    ]);
    expect(findWireCandidates(candidates, { x: 50, y: 0 })).toEqual(['a', 'b']);
    expect(candidates.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(points).toEqual(horizontal.points);
  });

  it('rejects invalid query geometry and excludes non-finite candidate routes', () => {
    expect(findWireCandidates([horizontal], { x: NaN, y: 0 })).toEqual([]);
    for (const scale of [0, -1, Infinity, NaN])
      expect(findWireCandidates([horizontal], { x: 50, y: 0 }, 8, scale)).toEqual([]);
    for (const tolerance of [-1, Infinity, NaN])
      expect(findWireCandidates([horizontal], { x: 50, y: 0 }, tolerance)).toEqual([]);
    expect(
      findWireCandidates(
        [horizontal, { id: 'invalid', points: [{ x: Infinity, y: 0 }] }],
        { x: 50, y: 0 },
        0,
      ),
    ).toEqual(['horizontal']);
  });
});

describe('overlapping wire selection cycle', () => {
  const ids = Object.freeze(['lower', 'middle', 'upper']);

  it('honors the clicked wire initially and defaults to the last/topmost candidate', () => {
    expect(nextWireCandidate(ids, null, 'middle')).toBe('middle');
    expect(nextWireCandidate(ids, null)).toBe('upper');
    expect(nextWireCandidate(ids, 'unrelated', 'missing')).toBe('upper');
  });

  it('cycles through all candidates even when the selected wire is rendered on top', () => {
    let selected: string | null = nextWireCandidate(ids, null, 'upper');
    const sequence: (string | null)[] = [selected];
    for (let index = 0; index < 3; index++) {
      selected = nextWireCandidate(ids, selected, selected ?? undefined);
      sequence.push(selected);
    }
    expect(sequence).toEqual(['upper', 'lower', 'middle', 'upper']);
    expect(ids).toEqual(['lower', 'middle', 'upper']);
  });

  it('uses the new clicked candidate when previous selection is outside the hit group', () => {
    expect(nextWireCandidate(['a', 'b'], 'previous', 'a')).toBe('a');
    expect(nextWireCandidate(['only'], 'only', 'only')).toBe('only');
    expect(nextWireCandidate([], 'previous', 'previous')).toBeNull();
  });
});
