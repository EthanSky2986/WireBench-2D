import { describe, expect, it } from 'vitest';
import { relateRails, SUPPLY_SOURCES } from './supply';

describe('supply rail relationships', () => {
  it.each([
    ['L', 'N', 'control'],
    ['U', 'V', 'three-phase'],
    ['V', 'W', 'three-phase'],
    ['U', 'W', 'three-phase'],
  ] as const)('defines %s-%s within its source', (from, to, source) => {
    expect(relateRails(from, to)).toMatchObject({ kind: 'defined', source });
    expect(relateRails(to, from)).toMatchObject({ kind: 'defined', source });
  });

  it.each([
    ['U', 'N'],
    ['V', 'N'],
    ['W', 'N'],
    ['L', 'U'],
    ['L', 'V'],
    ['L', 'W'],
  ] as const)('keeps the undefined %s-%s relationship explicit and symmetric', (from, to) => {
    expect(relateRails(from, to)).toMatchObject({ kind: 'undefined' });
    expect(relateRails(to, from)).toMatchObject({ kind: 'undefined' });
  });

  it('does not assume the three-phase teaching supply has a neutral reference', () => {
    expect(SUPPLY_SOURCES.find((source) => source.id === 'three-phase')?.reference).toBeNull();
  });
});
