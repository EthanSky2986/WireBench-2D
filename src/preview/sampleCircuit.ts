import type { Wire } from '../sim/model';
import type { Point } from '../layout';

/** Sample-only layout. Electrical IDs always refer to the existing device model. */
export const SAMPLE_TERMINALS: Record<string, Point> = {
  'POWER:L': { x: 38, y: 73 },
  'POWER:N': { x: 68, y: 73 },
  'KM1:A1': { x: 127, y: 160 },
  'KM1:A2': { x: 153, y: 160 },
  'KM1:13': { x: 179, y: 160 },
  'KM1:14': { x: 205, y: 160 },
  'KM1:53': { x: 231, y: 160 },
  'KM1:54': { x: 257, y: 160 },
  'SB2:NO3': { x: 337, y: 160 },
  'SB2:NO4': { x: 363, y: 160 },
  'HL1:1': { x: 471, y: 160 },
  'HL1:2': { x: 497, y: 160 },
  'HL2:1': { x: 595, y: 160 },
  'HL2:2': { x: 621, y: 160 },
  'HL3:1': { x: 719, y: 160 },
  'HL3:2': { x: 745, y: 160 },
};

function route(id: string, from: string, to: string, color: string, lane: number): Wire {
  const a = SAMPLE_TERMINALS[from],
    b = SAMPLE_TERMINALS[to];
  return {
    id,
    from,
    to,
    color,
    points: [
      { x: a.x, y: lane },
      { x: b.x, y: lane },
    ],
  };
}

/** A normal self-holding circuit, shared by both visual treatments. No forced lamp state. */
export const SAMPLE_WIRES: Wire[] = [
  route('start-feed', 'POWER:L', 'SB2:NO3', '#b84c44', 94),
  route('start-coil', 'SB2:NO4', 'KM1:A1', '#c39431', 112),
  route('coil-return', 'KM1:A2', 'POWER:N', '#4e79a9', 42),
  route('hold-feed', 'POWER:L', 'KM1:13', '#b84c44', 103),
  route('hold-coil', 'KM1:14', 'KM1:A1', '#c39431', 133),
  route('lamp-feed', 'POWER:L', 'KM1:53', '#b84c44', 121),
  route('lamp-amber', 'KM1:54', 'HL1:1', '#c39431', 65),
  route('lamp-green', 'HL1:1', 'HL2:1', '#c39431', 65),
  route('lamp-red', 'HL2:1', 'HL3:1', '#c39431', 65),
  route('return-amber', 'HL1:2', 'POWER:N', '#4e79a9', 30),
  route('return-green', 'HL2:2', 'HL1:2', '#4e79a9', 30),
  route('return-red', 'HL3:2', 'HL2:2', '#4e79a9', 30),
];

export function sampleWirePoints(wire: Wire): Point[] {
  return [SAMPLE_TERMINALS[wire.from], ...(wire.points ?? []), SAMPLE_TERMINALS[wire.to]];
}
