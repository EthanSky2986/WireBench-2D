import { BOARD, type Point } from '../layout';

export interface ViewportSize {
  w: number;
  h: number;
}

export interface BenchView extends Point {
  z: number;
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 2.8;
const FIT_MARGIN = 40;

function usableSize(size: ViewportSize): ViewportSize {
  return {
    w: Number.isFinite(size.w) ? Math.max(0, size.w) : 0,
    h: Number.isFinite(size.h) ? Math.max(0, size.h) : 0,
  };
}

export function fitView(size: ViewportSize): BenchView {
  const { w, h } = usableSize(size);
  const z = Math.max(
    MIN_SCALE,
    Math.min((w - FIT_MARGIN) / BOARD.width, (h - FIT_MARGIN) / BOARD.height, 1.2),
  );
  return { z, x: (w - BOARD.width * z) / 2, y: (h - BOARD.height * z) / 2 };
}

/** Keep the board coordinate beneath the screen-space anchor fixed while zooming. */
export function zoomView(
  view: BenchView,
  size: ViewportSize,
  factor: number,
  anchor?: Point,
): BenchView {
  if (!Number.isFinite(factor) || factor <= 0) return view;
  const { w, h } = usableSize(size);
  const center = anchor ?? { x: w / 2, y: h / 2 };
  const sizeMinimum = Math.max(MIN_SCALE, Math.min(0.35, fitView(size).z / 2));
  // A manual view can remain smaller after resize. Never make zoom-out increase its scale.
  const minimum = Math.min(view.z, sizeMinimum);
  const z = Math.max(minimum, Math.min(MAX_SCALE, view.z * factor));
  return {
    z,
    x: center.x - ((center.x - view.x) * z) / view.z,
    y: center.y - ((center.y - view.y) * z) / view.z,
  };
}

/** Resize preserves the inspected board location until the user explicitly chooses fit. */
export function resizeView(
  view: BenchView,
  previousSize: ViewportSize,
  nextSize: ViewportSize,
  autoFit: boolean,
): BenchView {
  if (autoFit) return fitView(nextSize);
  const previous = usableSize(previousSize);
  const next = usableSize(nextSize);
  return {
    ...view,
    x: view.x + (next.w - previous.w) / 2,
    y: view.y + (next.h - previous.h) / 2,
  };
}
