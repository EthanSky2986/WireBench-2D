import type { Point } from '../layout';

export interface WireCrossingRoute {
  id: string;
  points: readonly Point[];
}

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Segment extends Bounds {
  index: number;
  wireIndex: number;
  start: Point;
  dx: number;
  dy: number;
  length: number;
}

interface SegmentTree extends Bounds {
  firstIndex: number;
  segments?: Segment[];
  children?: [SegmentTree, SegmentTree];
}

const EPSILON = 0.000001;
// Keep a small mask clear of terminal sockets and the rounded part of a bend.
const VERTEX_CLEARANCE = 14;

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function makeTree(segments: Segment[]): SegmentTree {
  const node: SegmentTree = {
    left: Infinity,
    right: -Infinity,
    top: Infinity,
    bottom: -Infinity,
    firstIndex: Infinity,
  };
  for (const segment of segments) {
    node.left = Math.min(node.left, segment.left);
    node.right = Math.max(node.right, segment.right);
    node.top = Math.min(node.top, segment.top);
    node.bottom = Math.max(node.bottom, segment.bottom);
    node.firstIndex = Math.min(node.firstIndex, segment.index);
  }
  if (segments.length <= 8) {
    node.segments = segments;
    return node;
  }
  const horizontal = node.right - node.left >= node.bottom - node.top;
  segments.sort((a, b) =>
    horizontal ? a.left + a.right - b.left - b.right : a.top + a.bottom - b.top - b.bottom,
  );
  const middle = Math.floor(segments.length / 2);
  node.children = [makeTree(segments.slice(0, middle)), makeTree(segments.slice(middle))];
  return node;
}

function intersection(a: Segment, b: Segment): Point | null {
  const determinant = a.dx * b.dy - a.dy * b.dx;
  // Collinear overlaps need lane separation, never a row of artificial gaps.
  if (Math.abs(determinant) <= EPSILON * a.length * b.length) return null;
  const offsetX = b.start.x - a.start.x;
  const offsetY = b.start.y - a.start.y;
  const alongA = (offsetX * b.dy - offsetY * b.dx) / determinant;
  const alongB = (offsetX * a.dy - offsetY * a.dx) / determinant;
  if (
    alongA * a.length <= VERTEX_CLEARANCE ||
    (1 - alongA) * a.length <= VERTEX_CLEARANCE ||
    alongB * b.length <= VERTEX_CLEARANCE ||
    (1 - alongB) * b.length <= VERTEX_CLEARANCE
  )
    return null;
  return {
    x: Math.round((a.start.x + alongA * a.dx) / EPSILON) * EPSILON,
    y: Math.round((a.start.y + alongA * a.dy) / EPSILON) * EPSILON,
  };
}

/**
 * Find visual gaps on lower wires; intersections never change electrical links.
 * Input order is drawing order, with topmostId optionally raised above the rest.
 * Only wires with gaps occur in the result. Memoize against route/selection changes,
 * not pointer movement: the bounding-box tree is built once per invocation.
 */
export function findWireCrossings(
  wires: readonly WireCrossingRoute[],
  topmostId?: string | null,
): Map<string, Point[]> {
  const segments: Segment[] = [];
  wires.forEach((wire, wireIndex) => {
    if (wire.points.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) return;
    for (let index = 1; index < wire.points.length; index++) {
      const start = wire.points[index - 1];
      const end = wire.points[index];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length <= 2 * VERTEX_CLEARANCE) continue;
      segments.push({
        index: segments.length,
        wireIndex,
        start,
        dx,
        dy,
        length,
        left: Math.min(start.x, end.x),
        right: Math.max(start.x, end.x),
        top: Math.min(start.y, end.y),
        bottom: Math.max(start.y, end.y),
      });
    }
  });
  const gaps = new Map<string, Map<string, Point>>();
  if (segments.length < 2) return new Map();
  const tree = makeTree([...segments]);

  function visit(node: SegmentTree, segment: Segment): void {
    // Each pair is visited once, regardless of its visual stacking order.
    if (node.firstIndex >= segment.index || !overlaps(node, segment)) return;
    if (node.children) {
      visit(node.children[0], segment);
      visit(node.children[1], segment);
      return;
    }
    for (const other of node.segments ?? []) {
      if (
        other.index >= segment.index ||
        other.wireIndex === segment.wireIndex ||
        !overlaps(other, segment)
      )
        continue;
      const point = intersection(other, segment);
      if (!point) continue;
      const lowerIndex =
        wires[other.wireIndex].id === topmostId ? segment.wireIndex : other.wireIndex;
      const lowerId = wires[lowerIndex].id;
      const wireGaps = gaps.get(lowerId) ?? new Map<string, Point>();
      wireGaps.set(`${point.x},${point.y}`, point);
      gaps.set(lowerId, wireGaps);
    }
  }
  for (const segment of segments) visit(tree, segment);
  return new Map(
    wires.flatMap(({ id }) => {
      const points = gaps.get(id);
      return points
        ? [[id, [...points.values()].sort((a, b) => a.x - b.x || a.y - b.y)] as const]
        : [];
    }),
  );
}
