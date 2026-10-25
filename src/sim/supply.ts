import type { Rail } from './model';

export interface SupplySource {
  id: 'control' | 'three-phase';
  rails: readonly Rail[];
  reference: Rail | null;
  definedPairs: readonly (readonly [Rail, Rail])[];
}

export const SUPPLY_SOURCES: readonly SupplySource[] = [
  {
    id: 'control',
    rails: ['L', 'N'],
    reference: 'N',
    definedPairs: [['L', 'N']],
  },
  {
    id: 'three-phase',
    rails: ['U', 'V', 'W'],
    reference: null,
    definedPairs: [
      ['U', 'V'],
      ['V', 'W'],
      ['U', 'W'],
    ],
  },
];

export type RailRelation =
  | { kind: 'same-rail'; pair: [Rail, Rail] }
  | { kind: 'defined'; source: SupplySource['id']; pair: [Rail, Rail] }
  | { kind: 'undefined'; pair: [Rail, Rail] };

export function sourceOf(rail: Rail): SupplySource | undefined {
  return SUPPLY_SOURCES.find((source) => source.rails.includes(rail));
}

/** Classify whether this model defines a load connected between two rails. */
export function relateRails(a: Rail, b: Rail): RailRelation {
  const pair: [Rail, Rail] = [a, b];
  if (a === b) return { kind: 'same-rail', pair };
  const source = sourceOf(a);
  if (source && source === sourceOf(b)) {
    const defined = source.definedPairs.some(
      ([from, to]) => (from === a && to === b) || (from === b && to === a),
    );
    if (defined) return { kind: 'defined', source: source.id, pair };
  }
  return { kind: 'undefined', pair };
}
