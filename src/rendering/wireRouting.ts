import {
  BOARD,
  LAMP_PANEL,
  placements,
  SOCKET_MAP,
  strips,
  wirePoints,
  type Point,
  type Socket,
} from '../layout';
import { PROJECT_LIMITS } from '../limits';
import { DEVICE_MAP, type Wire } from '../sim/model';

interface Obstacle {
  left: number;
  right: number;
  top: number;
  bottom: number;
  strip?: number;
}

interface Segment {
  a: Point;
  b: Point;
  terminal?: string;
}

interface Candidate {
  points: Point[];
  length: number;
}

// Keep candidates dense enough for narrow physical gaps, while preferring more
// breathing room between long parallel runs at the usual fitted canvas scale.
const PITCH = 10;
const WIRE_SPACING = 16;
const CLEARANCE = 6;
const EXIT = 20;
const MAX_EXIT = 100;
const EDGE = 20;
const EPSILON = 0.000001;

// These are routing keep-outs, derived from the same layout that draws the bench.
// Fixed leads may be crossed; device faces and unrelated terminal banks may not.
const obstacles: Obstacle[] = [
  ...strips.map((strip, index) => ({
    left: strip.x - CLEARANCE,
    right: strip.x + strip.step * strip.labels.length + CLEARANCE,
    top: strip.y - CLEARANCE,
    bottom: strip.y + 62 + CLEARANCE,
    strip: index,
  })),
  ...placements
    .filter((placement) => DEVICE_MAP[placement.id].kind !== 'lamp')
    .map((placement) => ({
      left: placement.x - CLEARANCE,
      right: placement.x + placement.size + CLEARANCE,
      top: placement.y - CLEARANCE,
      bottom: placement.y + placement.size + CLEARANCE,
    })),
  {
    left: LAMP_PANEL.x - CLEARANCE,
    right: LAMP_PANEL.x + LAMP_PANEL.width + CLEARANCE,
    top: LAMP_PANEL.y - CLEARANCE,
    bottom: LAMP_PANEL.y + LAMP_PANEL.height + CLEARANCE,
  },
];

function owner(socket: Socket): number {
  return strips.findIndex(
    (strip) => strip.deviceId === socket.deviceId && strip.labels.includes(socket.label),
  );
}

function same(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function length(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function overlap(a: number, b: number, c: number, d: number): number {
  return Math.max(
    0,
    Math.min(Math.max(a, b), Math.max(c, d)) - Math.max(Math.min(a, b), Math.min(c, d)),
  );
}

function blocked(a: Point, b: Point, allowedStrip?: number): boolean {
  return obstacles.some((rectangle) => {
    if (allowedStrip !== undefined && rectangle.strip === allowedStrip) return false;
    return a.x === b.x
      ? a.x > rectangle.left &&
          a.x < rectangle.right &&
          overlap(a.y, b.y, rectangle.top, rectangle.bottom) > EPSILON
      : a.y > rectangle.top &&
          a.y < rectangle.bottom &&
          overlap(a.x, b.x, rectangle.left, rectangle.right) > EPSILON;
  });
}

function departureLanes(socket: Socket): number[] {
  const direction = socket.side === 'top' ? -1 : 1;
  const start =
    direction < 0
      ? Math.floor((socket.y - EXIT) / PITCH) * PITCH
      : Math.ceil((socket.y + EXIT) / PITCH) * PITCH;
  const result: number[] = [];
  for (let y = start; Math.abs(y - socket.y) <= MAX_EXIT; y += direction * PITCH) {
    if (y < EDGE || y > BOARD.height - EDGE) break;
    if (!blocked(socket, { x: socket.x, y }, owner(socket))) result.push(y);
  }
  return result;
}

/** Collapse unused handles, but never introduce diagonal segments or erase a reversal. */
function compact(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    if (result.length && same(result[result.length - 1], point)) continue;
    while (result.length >= 2) {
      const a = result[result.length - 2];
      const b = result[result.length - 1];
      if (
        ((a.x === b.x && b.x === point.x) || (a.y === b.y && b.y === point.y)) &&
        length(a, point) === length(a, b) + length(b, point)
      ) {
        result.pop();
      } else break;
    }
    result.push({ x: point.x, y: point.y });
  }
  return result;
}

/** Sample the free vertical corridors, rather than search an unbounded drawing grid. */
function columns(top: number, bottom: number, fromX: number, toX: number): number[] {
  const occupied = obstacles
    .filter((obstacle) => overlap(top, bottom, obstacle.top, obstacle.bottom) > EPSILON)
    .map((obstacle) => [obstacle.left, obstacle.right])
    .sort((a, b) => a[0] - b[0]);
  const gaps: [number, number][] = [];
  let left = EDGE;
  for (const [start, end] of occupied) {
    if (start > left) gaps.push([left, Math.min(start, BOARD.width - EDGE)]);
    left = Math.max(left, end);
  }
  if (left < BOARD.width - EDGE) gaps.push([left, BOARD.width - EDGE]);

  const result = new Set<number>();
  for (const [start, end] of gaps) {
    if (end < start) continue;
    if (end - start < PITCH) {
      result.add((start + end) / 2);
    } else if (end - start <= 8 * PITCH) {
      for (let x = Math.ceil(start / PITCH) * PITCH; x <= end; x += PITCH) result.add(x);
    } else {
      // A wide empty row needs only nearby candidates, not hundreds of columns.
      for (const reference of [start, fromX, (fromX + toX) / 2, toX, end]) {
        for (const offset of [-PITCH, 0, PITCH]) {
          const x = Math.round(reference / PITCH) * PITCH + offset;
          if (x >= start && x <= end) result.add(x);
        }
      }
    }
    for (const x of [fromX, toX]) if (x >= start && x <= end) result.add(x);
  }
  return [...result].sort((a, b) => a - b);
}

function segments(wire: Wire): Segment[] {
  const points = wirePoints(wire.from, wire.to, wire.points);
  return points.slice(1).flatMap((point, index) =>
    same(points[index], point)
      ? []
      : [
          {
            a: points[index],
            b: point,
            terminal: index === 0 ? wire.from : index === points.length - 2 ? wire.to : undefined,
          },
        ],
  );
}

function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const cdX = d.x - c.x;
  const cdY = d.y - c.y;
  const denominator = abX * cdY - abY * cdX;
  if (Math.abs(denominator) < EPSILON) return false;
  const acX = c.x - a.x;
  const acY = c.y - a.y;
  const t = (acX * cdY - acY * cdX) / denominator;
  const u = (acX * abY - acY * abX) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function congestion(a: Point, b: Point, occupied: readonly Segment[], terminal?: string): number {
  let score = 0;
  const horizontal = a.y === b.y;
  for (const other of occupied) {
    const parallel = horizontal ? other.a.y === other.b.y : other.a.x === other.b.x;
    if (parallel) {
      const distance = horizontal ? Math.abs(a.y - other.a.y) : Math.abs(a.x - other.a.x);
      if (distance >= WIRE_SPACING) continue;
      let shared = horizontal
        ? overlap(a.x, b.x, other.a.x, other.b.x)
        : overlap(a.y, b.y, other.a.y, other.b.y);
      if (terminal && terminal === other.terminal) {
        // Several leads from one socket necessarily share a short exit. Longer
        // shared runs still count, encouraging the leads to separate promptly.
        shared = Math.max(0, shared - EXIT - PITCH);
      }
      score += shared * 18 * (1 - distance / WIRE_SPACING) ** 2;
    } else if (crosses(a, b, other.a, other.b)) {
      if (terminal && terminal === other.terminal) continue;
      // Crossing is legal and less confusing than a coincident run. This small
      // cost avoids gratuitous crossings without forcing huge detours.
      score += 18;
    }
  }
  return score;
}

function route(from: string, to: string, occupied: readonly Segment[]): Point[] {
  const a = SOCKET_MAP[from];
  const b = SOCKET_MAP[to];
  if (!a || !b || from === to) return [];
  const lanesA = departureLanes(a);
  const lanesB = departureLanes(b);
  const fromOwner = owner(a);
  const toOwner = owner(b);
  const candidates: Candidate[] = [];
  const validSegments = new Map<string, boolean>();
  const segmentKey = (start: Point, end: Point, terminal?: string) =>
    `${start.x},${start.y}:${end.x},${end.y}:${terminal ?? ''}`;

  const add = (points: Point[]) => {
    for (let index = 1; index < points.length; index++) {
      const start = points[index - 1];
      const end = points[index];
      const terminal = index === 1 ? from : index === points.length - 1 ? to : undefined;
      const key = segmentKey(start, end, terminal);
      let valid = validSegments.get(key);
      if (valid === undefined) {
        valid = !blocked(
          start,
          end,
          terminal === from ? fromOwner : terminal === to ? toOwner : undefined,
        );
        validSegments.set(key, valid);
      }
      if (!valid) return;
    }
    const simplified = compact(points);
    candidates.push({
      points: simplified,
      length: simplified
        .slice(1)
        .reduce((sum, point, index) => sum + length(simplified[index], point), 0),
    });
  };

  for (const y of lanesA) {
    if (lanesB.includes(y)) add([a, { x: a.x, y }, { x: b.x, y }, b]);
  }
  for (const yA of lanesA) {
    for (const yB of lanesB) {
      if (yA === yB) continue;
      for (const x of columns(Math.min(yA, yB), Math.max(yA, yB), a.x, b.x)) {
        add([a, { x: a.x, y: yA }, { x, y: yA }, { x, y: yB }, { x: b.x, y: yB }, b]);
      }
    }
  }

  // Current board sockets all have clear candidate corridors. Keep a bounded
  // fallback for a future layout with no route, rather than lose the connection.
  if (!candidates.length) return wirePoints(from, to).map(({ x, y }) => ({ x, y }));
  const shortest = Math.min(...candidates.map((candidate) => candidate.length));
  const costs = new Map<string, number>();
  let best = candidates[0].points;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    // Avoid routing around the whole board just to dodge a short overlap in a
    // crowded corridor; no local router can guarantee separation of 500 wires.
    if (candidate.length > shortest * 1.55 + 80) continue;
    let score = candidate.length + Math.max(0, candidate.points.length - 2) * 12;
    for (let index = 1; index < candidate.points.length; index++) {
      const start = candidate.points[index - 1];
      const end = candidate.points[index];
      const terminal = index === 1 ? from : index === candidate.points.length - 1 ? to : undefined;
      const key = segmentKey(start, end, terminal);
      let cost = costs.get(key);
      if (cost === undefined) {
        cost = congestion(start, end, occupied, terminal);
        costs.set(key, cost);
      }
      score += cost;
      if (score >= bestScore) break;
    }
    if (score < bestScore) {
      bestScore = score;
      best = candidate.points;
    }
  }
  return best;
}

/** Returns the full polyline; callers persist only slice(1, -1) in Wire.points. */
export function routeNewWire(from: string, to: string, existingWires: readonly Wire[]): Point[] {
  return route(from, to, existingWires.flatMap(segments));
}

/**
 * Arrange only wires with no saved path. Explicit paths (including []) are
 * immutable obstacles, regardless of array position. Persist the returned
 * wires as one normal edit so arranging can be undone and survives reloads.
 */
export function arrangeAutomaticWires(wires: readonly Wire[]): Wire[] {
  const occupied = wires.filter((wire) => wire.points !== undefined).flatMap(segments);
  return wires.map((wire) => {
    if (wire.points !== undefined) return wire;
    const points = route(wire.from, wire.to, occupied).slice(1, -1);
    if (!points.length || points.length > PROJECT_LIMITS.maxPoints) return wire;
    const arranged = { ...wire, points };
    occupied.push(...segments(arranged));
    return arranged;
  });
}
