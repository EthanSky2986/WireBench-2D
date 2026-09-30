import { describe, expect, it } from 'vitest';
import { BOARD, type Point } from '../layout';
import { fitView, resizeView, zoomView, type BenchView, type ViewportSize } from './benchViewport';

function boardAt(view: BenchView, point: Point): Point {
  return { x: (point.x - view.x) / view.z, y: (point.y - view.y) / view.z };
}

function centerOf(size: ViewportSize): Point {
  return { x: size.w / 2, y: size.h / 2 };
}

describe('bench viewport', () => {
  it('fits and centers the complete board in narrow and wide viewports', () => {
    for (const size of [
      { w: 390, h: 500 },
      { w: 1400, h: 380 },
      { w: 1800, h: 1200 },
    ]) {
      const view = fitView(size);
      expect(view.x).toBeGreaterThanOrEqual(19.999);
      expect(view.y).toBeGreaterThanOrEqual(19.999);
      expect(BOARD.width * view.z + 2 * view.x).toBeCloseTo(size.w);
      expect(BOARD.height * view.z + 2 * view.y).toBeCloseTo(size.h);
    }
  });

  it('zoom-out from a fitted 25% view decreases scale instead of jumping to 35%', () => {
    const size = { w: 390, h: 500 };
    const view = fitView(size);
    expect(view.z).toBe(0.25);
    const next = zoomView(view, size, 1 / 1.2);
    expect(next.z).toBeLessThan(view.z);
    expect(boardAt(next, centerOf(size))).toEqual(boardAt(view, centerOf(size)));
  });

  it('keeps repeated zoom-out monotonic down to a positive usable minimum', () => {
    const size = { w: 390, h: 500 };
    let view = fitView(size);
    for (let index = 0; index < 40; index++) {
      const next = zoomView(view, size, 1 / 1.2);
      expect(next.z).toBeLessThanOrEqual(view.z);
      view = next;
    }
    expect(view.z).toBe(0.125);
  });

  it('keeps the pointer anchor stationary when zooming and when reaching maximum scale', () => {
    const view = { x: -730, y: -200, z: 1.8 };
    const size = { w: 1100, h: 750 };
    const anchor = { x: 173, y: 441 };
    const next = zoomView(view, size, 2, anchor);
    expect(next.z).toBe(2.8);
    expect(boardAt(next, anchor).x).toBeCloseTo(boardAt(view, anchor).x);
    expect(boardAt(next, anchor).y).toBeCloseTo(boardAt(view, anchor).y);
  });

  it('preserves manually chosen scale and center across sidebars and fullscreen resize', () => {
    const view = { x: -800, y: -250, z: 1.7 };
    const previous = { w: 660, h: 550 };
    const fullscreen = { w: 1728, h: 1000 };
    const next = resizeView(view, previous, fullscreen, false);
    expect(next.z).toBe(view.z);
    expect(boardAt(next, centerOf(fullscreen))).toEqual(boardAt(view, centerOf(previous)));
    expect(resizeView(next, fullscreen, previous, false)).toEqual(view);
  });

  it('refits on resize only while the view remains in automatic fit mode', () => {
    const previous = { w: 600, h: 500 };
    const next = { w: 1728, h: 1000 };
    expect(resizeView(fitView(previous), previous, next, true)).toEqual(fitView(next));
  });

  it('does not reverse zoom-out when a preserved small manual view enters a larger viewport', () => {
    const previous = { w: 390, h: 500 };
    const next = { w: 1728, h: 1000 };
    const view = resizeView(fitView(previous), previous, next, false);
    expect(zoomView(view, next, 1 / 1.2).z).toBeLessThanOrEqual(view.z);
    expect(zoomView(view, next, 1.2).z).toBeGreaterThan(view.z);
  });

  it('keeps hidden or invalid viewport measurements finite and ignores invalid zoom factors', () => {
    for (const size of [
      { w: 0, h: 0 },
      { w: -10, h: Number.NaN },
    ]) {
      const view = fitView(size);
      expect(view.z).toBe(0.05);
      expect(Number.isFinite(view.x)).toBe(true);
      expect(Number.isFinite(view.y)).toBe(true);
      for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(zoomView(view, size, factor)).toEqual(view);
      }
    }
  });
});
