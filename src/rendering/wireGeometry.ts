import type { Point } from '../layout';

const MIN_BEND = 0.000001;

/** Remove floating-point noise only from derived geometry, never saved endpoints. */
const derived = (value: number): string => String(Number(value.toFixed(6)));
const endpoint = (point: Point): string => `${point.x} ${point.y}`;

/**
 * Render a polyline as straight segments joined by circular fillets.
 *
 * The original points remain the editing handles and are never mutated. Each
 * bend consumes at most half of either adjacent segment, so neighboring bends
 * cannot overlap. Collinear reversals remain explicit turns: rounding a U-turn
 * would require inventing a side and could hide an intentionally doubled route.
 */
export function roundedWirePath(points: readonly Point[], radius = 10): string {
  if (
    !points.length ||
    points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))
  )
    return '';

  const route = points.filter(
    (point, index) =>
      index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y,
  );
  const bendRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  const commands = [`M ${endpoint(route[0])}`];

  for (let index = 1; index < route.length - 1; index++) {
    const previous = route[index - 1];
    const corner = route[index];
    const next = route[index + 1];
    const incomingX = corner.x - previous.x;
    const incomingY = corner.y - previous.y;
    const outgoingX = next.x - corner.x;
    const outgoingY = next.y - corner.y;
    const incomingLength = Math.hypot(incomingX, incomingY);
    const outgoingLength = Math.hypot(outgoingX, outgoingY);

    if (
      !bendRadius ||
      incomingLength <= MIN_BEND ||
      outgoingLength <= MIN_BEND ||
      !Number.isFinite(incomingLength + outgoingLength)
    ) {
      commands.push(`L ${endpoint(corner)}`);
      continue;
    }

    const ux = incomingX / incomingLength;
    const uy = incomingY / incomingLength;
    const vx = outgoingX / outgoingLength;
    const vy = outgoingY / outgoingLength;
    const cross = ux * vy - uy * vx;
    const dot = Math.max(-1, Math.min(1, ux * vx + uy * vy));
    // Straight segments and exact foldbacks have no unambiguous circular bend.
    if (Math.abs(cross) <= MIN_BEND) {
      commands.push(`L ${endpoint(corner)}`);
      continue;
    }

    const turn = Math.atan2(Math.abs(cross), dot);
    const tangentFactor = Math.tan(turn / 2);
    const cut = Math.min(bendRadius * tangentFactor, incomingLength / 2, outgoingLength / 2);
    const actualRadius = cut / tangentFactor;
    if (cut <= MIN_BEND || actualRadius <= MIN_BEND) {
      commands.push(`L ${endpoint(corner)}`);
      continue;
    }

    const startX = corner.x - ux * cut;
    const startY = corner.y - uy * cut;
    const endX = corner.x + vx * cut;
    const endY = corner.y + vy * cut;
    const arcRadius = derived(actualRadius);
    commands.push(`L ${derived(startX)} ${derived(startY)}`);
    commands.push(
      `A ${arcRadius} ${arcRadius} 0 0 ${cross > 0 ? 1 : 0} ${derived(endX)} ${derived(endY)}`,
    );
  }

  if (route.length > 1) commands.push(`L ${endpoint(route[route.length - 1])}`);
  return commands.join(' ');
}
