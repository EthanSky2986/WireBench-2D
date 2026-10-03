import { describe, expect, it } from 'vitest';
import { findWireCrossings, type WireCrossingRoute } from './wireCrossings';

const horizontal: WireCrossingRoute = {
  id: 'horizontal',
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
};
const vertical: WireCrossingRoute = {
  id: 'vertical',
  points: [
    { x: 50, y: -50 },
    { x: 50, y: 50 },
  ],
};

describe('wire crossing gaps', () => {
  it('breaks only the lower wire at a proper crossing', () => {
    expect(findWireCrossings([horizontal, vertical])).toEqual(
      new Map([['horizontal', [{ x: 50, y: 0 }]]]),
    );
    expect(findWireCrossings([vertical, horizontal])).toEqual(
      new Map([['vertical', [{ x: 50, y: 0 }]]]),
    );
  });

  it('keeps a selected wire continuous even when its original order is lower', () => {
    expect(findWireCrossings([horizontal, vertical], 'horizontal')).toEqual(
      new Map([['vertical', [{ x: 50, y: 0 }]]]),
    );
    expect(findWireCrossings([horizontal, vertical], 'vertical')).toEqual(
      findWireCrossings([horizontal, vertical]),
    );
    expect(findWireCrossings([horizontal, vertical], 'missing')).toEqual(
      findWireCrossings([horizontal, vertical]),
    );
  });

  it('does not turn shared sockets, T-shaped touches, or nearby bends into breaks', () => {
    for (const points of [
      [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
      ],
      [
        { x: 50, y: 0 },
        { x: 50, y: 50 },
      ],
      [
        { x: 10, y: -50 },
        { x: 10, y: 50 },
      ],
      [
        { x: 50, y: -50 },
        { x: 50, y: 8 },
        { x: 100, y: 8 },
      ],
    ]) {
      expect(findWireCrossings([horizontal, { id: 'touching', points }])).toEqual(new Map());
    }
  });

  it('recognizes diagonal crossings regardless of segment direction', () => {
    const descending: WireCrossingRoute = {
      id: 'diagonal',
      points: [
        { x: 0, y: -50 },
        { x: 100, y: 50 },
      ],
    };
    expect(findWireCrossings([descending, horizontal])).toEqual(
      new Map([['diagonal', [{ x: 50, y: 0 }]]]),
    );
    expect(
      findWireCrossings([{ ...descending, points: [...descending.points].reverse() }, horizontal]),
    ).toEqual(findWireCrossings([descending, horizontal]));
  });

  it('ignores parallel overlaps, disjoint segments, and intersections on extensions', () => {
    for (const points of [
      [
        { x: 80, y: 0 },
        { x: 20, y: 0 },
      ],
      [
        { x: 120, y: -50 },
        { x: 120, y: 50 },
      ],
      [
        { x: 50, y: 20 },
        { x: 50, y: 60 },
      ],
    ])
      expect(findWireCrossings([horizontal, { id: 'other', points }])).toEqual(new Map());
  });

  it('de-duplicates coincident crossings and does not break a wire against itself', () => {
    expect(findWireCrossings([horizontal, vertical, { ...vertical, id: 'overlapping' }])).toEqual(
      new Map([['horizontal', [{ x: 50, y: 0 }]]]),
    );
    expect(
      findWireCrossings([
        {
          id: 'self-crossing',
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 50, y: -50 },
            { x: 50, y: 50 },
          ],
        },
      ]),
    ).toEqual(new Map());
  });

  it('finds crossings beyond tree leaves and keeps deterministic source ordering', () => {
    const verticals = Array.from({ length: 30 }, (_, index) => ({
      id: `v${index}`,
      points: [
        { x: (index + 1) * 20, y: -100 },
        { x: (index + 1) * 20, y: 100 },
      ],
    }));
    const longHorizontal = {
      ...horizontal,
      points: [
        { x: 0, y: 0 },
        { x: 640, y: 0 },
      ],
    };
    const gaps = findWireCrossings([longHorizontal, ...verticals], 'v15');
    expect(gaps.size).toBe(1);
    expect(gaps.get('horizontal')).toEqual(
      verticals.map(({ points }) => ({ x: points[0].x, y: 0 })),
    );
    expect(findWireCrossings([...verticals, longHorizontal], 'v15').get('horizontal')).toEqual([
      { x: 320, y: 0 },
    ]);
  });

  it('preserves saved points and safely excludes empty or non-finite routes', () => {
    const input = Object.freeze([
      Object.freeze({
        ...horizontal,
        points: Object.freeze(horizontal.points.map((point) => Object.freeze(point))),
      }),
      Object.freeze({
        ...vertical,
        points: Object.freeze(vertical.points.map((point) => Object.freeze(point))),
      }),
      { id: 'empty', points: [] },
      {
        id: 'invalid',
        points: [
          { x: NaN, y: 0 },
          { x: 60, y: 0 },
        ],
      },
      {
        id: 'collapsed',
        points: [
          { x: 50, y: 0 },
          { x: 50, y: 0 },
        ],
      },
    ]);
    const before = JSON.stringify(input);
    expect(findWireCrossings(input)).toEqual(new Map([['horizontal', [{ x: 50, y: 0 }]]]));
    expect(JSON.stringify(input)).toBe(before);
    expect(findWireCrossings([])).toEqual(new Map());
  });
});
