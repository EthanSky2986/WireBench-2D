import type { Point } from '../layout';

export interface WireSelectionCandidate {
  id: string;
  points: readonly Point[];
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);

  // Clamp to the segment: a click beyond an endpoint must not hit its extension.
  const fraction = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - start.x - fraction * dx, point.y - start.y - fraction * dy);
}

/**
 * Hit-test displayed straight polylines without changing their saved routes.
 * The tolerance is in screen pixels, while points are in board coordinates.
 * Supply candidates in document order, independent of visual selection layering.
 */
export function findWireCandidates(
  candidates: readonly WireSelectionCandidate[],
  point: Point,
  screenTolerance = 8,
  viewScale = 1,
): string[] {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !Number.isFinite(screenTolerance) ||
    screenTolerance < 0 ||
    !Number.isFinite(viewScale) ||
    viewScale <= 0
  )
    return [];

  const tolerance = screenTolerance / viewScale;
  return candidates
    .filter(({ points }) => {
      if (points.some((vertex) => !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)))
        return false;
      if (points.length === 1)
        return Math.hypot(point.x - points[0].x, point.y - points[0].y) <= tolerance;
      for (let index = 1; index < points.length; index++) {
        if (distanceToSegment(point, points[index - 1], points[index]) <= tolerance) return true;
      }
      return false;
    })
    .map(({ id }) => id);
}

/** First choose the clicked/topmost wire, then cycle in stable document order. */
export function nextWireCandidate(
  candidateIds: readonly string[],
  selectedId: string | null,
  clickedId?: string,
): string | null {
  if (!candidateIds.length) return null;
  const selectedIndex = selectedId === null ? -1 : candidateIds.indexOf(selectedId);
  if (selectedIndex !== -1) return candidateIds[(selectedIndex + 1) % candidateIds.length];
  if (clickedId !== undefined && candidateIds.includes(clickedId)) return clickedId;
  return candidateIds[candidateIds.length - 1];
}
