import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Minus, Plus, Maximize, Move, MousePointer2, Cable } from 'lucide-react';
import {
  BOARD,
  CONTROL_RAIL_Y,
  BUTTON_STRIPS,
  SOCKETS,
  SOCKET_MAP,
  placements,
  strips,
  wirePoints,
  polyline,
  clampPoint,
  fixedLeadPath,
  localizeDevice,
} from '../layout';
import type { Point } from '../layout';
import { DEVICE_MAP, UNSUPPORTED_TERMINALS } from '../sim/model';
import type { Wire } from '../sim/model';
import type { SimulationResult } from '../sim/engine';
import { RefinedDeviceArt } from './RefinedDeviceArt';
import { TerminalStripArt } from './TerminalStripArt';
import { useI18n } from '../i18n';
import { findWireCandidates, nextWireCandidate } from '../rendering/wireSelection';
import { fitView, resizeView, zoomView } from '../rendering/benchViewport';

interface Props {
  wires: Wire[];
  inputs: Record<string, boolean>;
  result: SimulationResult;
  powered: boolean;
  selected: string | null;
  selectedWire: string | null;
  pending: string | null;
  route: Point[];
  color: string;
  fixed: boolean;
  mode: 'wire' | 'pan';
  onSelect: (id: string) => void;
  onClearSelection: () => void;
  onWireSelect: (id: string) => void;
  onSocket: (id: string) => void;
  onOperate: (id: string, active: boolean) => void;
  onRoute: (p: Point) => void;
  onMoveWire: (id: string, points: Point[]) => void;
  onCancel: () => void;
  onMode: (mode: 'wire' | 'pan') => void;
}

interface WireVisualProps {
  points: Point[];
  color: string;
  selected: boolean;
  fault: boolean;
  live: boolean;
}

function WireVisual({ points, color, selected, fault, live }: WireVisualProps) {
  const route = polyline(points);
  return (
    <g className="wire-visual" pointerEvents="none" aria-hidden="true">
      <polyline
        className="wire-emphasis"
        points={route}
        fill="none"
        stroke={fault ? 'var(--danger)' : 'var(--accent)'}
        strokeWidth="9"
      />
      <polyline points={route} fill="none" stroke="var(--wire-halo)" strokeWidth="5.6" />
      <polyline
        points={route}
        fill="none"
        stroke={fault ? 'var(--danger)' : color}
        strokeWidth={selected ? 3.8 : live ? 3.6 : 2.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {live && (
        <polyline
          points={route}
          fill="none"
          stroke="#fff"
          strokeWidth=".9"
          opacity=".65"
          strokeDasharray="3 8"
        />
      )}
    </g>
  );
}

export default function Bench(p: Props) {
  const { locale, t } = useI18n();
  const host = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 720 }),
    [view, setView] = useState(() => fitView({ w: 1000, h: 720 }));
  const viewSize = useRef(size);
  const autoFit = useRef(true);
  const [cursor, setCursor] = useState<Point | null>(null),
    [hover, setHover] = useState<string | null>(null),
    [space, setSpace] = useState(false);
  const drag = useRef<
    | { kind: 'pan'; x: number; y: number; vx: number; vy: number }
    | { kind: 'point'; wire: string; index: number; points: Point[] }
    | null
  >(null);
  const [draft, setDraft] = useState<{ wire: string; points: Point[] } | null>(null);
  const [overlap, setOverlap] = useState<{
    point: Point;
    ids: string[];
    selected: string;
  } | null>(null);
  const wireGeometry = useMemo(
    () =>
      p.wires.map((wire) => ({
        ...wire,
        points: wirePoints(
          wire.from,
          wire.to,
          draft?.wire === wire.id ? draft.points : wire.points,
        ),
      })),
    [p.wires, draft],
  );
  const selectedWire = wireGeometry.find((wire) => wire.id === p.selectedWire);
  const overlapPoint = overlap?.point;
  const overlapIds = useMemo(
    () => (overlapPoint ? findWireCandidates(wireGeometry, overlapPoint, 7.5, view.z) : []),
    [wireGeometry, overlapPoint, view.z],
  );
  const showOverlap =
    overlap &&
    overlap.selected === p.selectedWire &&
    overlapIds.length > 1 &&
    overlapIds.includes(overlap.selected) &&
    !p.pending &&
    !draft &&
    p.mode === 'wire' &&
    !space;
  const selectWireAt = (point: Point, clickedId: string) => {
    const ids = findWireCandidates(wireGeometry, point, 7.5, view.z);
    const continuing =
      overlap &&
      overlap.selected === p.selectedWire &&
      Math.hypot(point.x - overlap.point.x, point.y - overlap.point.y) * view.z <= 8 &&
      ids.length === overlap.ids.length &&
      ids.every((id, index) => id === overlap.ids[index]);
    // The visual overlay is on top, while DOM hit targets keep their keyboard order.
    const topmostId = p.selectedWire && ids.includes(p.selectedWire) ? p.selectedWire : clickedId;
    const selected =
      nextWireCandidate(ids, continuing ? p.selectedWire : null, topmostId) ?? clickedId;
    setOverlap({ point, ids, selected });
    p.onWireSelect(selected);
  };
  const fit = () => {
    autoFit.current = true;
    setView(fitView(size));
  };
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const nextSize = { w: entry.contentRect.width, h: entry.contentRect.height };
      const previousSize = viewSize.current;
      viewSize.current = nextSize;
      setSize(nextSize);
      setView((current) => resizeView(current, previousSize, nextSize, autoFit.current));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpace(false);
    };
    const blur = () => {
      setSpace(false);
      drag.current = null;
      setDraft(null);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect(),
        x = e.clientX - rect.left,
        y = e.clientY - rect.top;
      autoFit.current = false;
      setView((v) => zoomView(v, viewSize.current, Math.exp(-e.deltaY * 0.0015), { x, y }));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  const world = (e: { clientX: number; clientY: number }) => {
    const r = host.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.z, y: (e.clientY - r.top - view.y) / view.z };
  };
  const zoom = (factor: number) => {
    autoFit.current = false;
    setView((v) => zoomView(v, size, factor));
  };
  const pointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.button === 1 || space || p.mode === 'pan') {
      e.preventDefault();
      autoFit.current = false;
      drag.current = { kind: 'pan', x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (p.pending && !p.powered) {
      p.onRoute(clampPoint(world(e)));
    } else {
      setOverlap(null);
      p.onClearSelection();
    }
  };
  const pointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const point = world(e);
    setCursor(point);
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'pan')
      setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
    else {
      const points = d.points.map((old, i) =>
        i === d.index
          ? clampPoint({ x: Math.round(point.x / 5) * 5, y: Math.round(point.y / 5) * 5 })
          : old,
      );
      setDraft({ wire: d.wire, points });
    }
  };
  const finish = () => {
    const original = drag.current;
    if (
      original?.kind === 'point' &&
      draft &&
      draft.points.some(
        (point, index) =>
          point.x !== original.points[index].x || point.y !== original.points[index].y,
      )
    )
      p.onMoveWire(draft.wire, draft.points);
    drag.current = null;
    setDraft(null);
  };
  const counts: Record<string, number> = {};
  for (const w of p.wires) {
    counts[w.from] = (counts[w.from] || 0) + 1;
    counts[w.to] = (counts[w.to] || 0) + 1;
  }
  const highlighted = new Set(p.result.fault?.wireIds || []);
  return (
    <div className="bench-host" ref={host}>
      <div className="canvas-label">
        <span className="canvas-dot" /> {t('bench.frontView')} <span>WB—01</span>
      </div>
      <svg
        ref={svg}
        className={`bench-svg ${p.mode === 'pan' || space ? 'is-pan' : ''} ${p.pending ? 'is-wiring' : ''}`}
        aria-label={t('bench.canvasLabel')}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={finish}
        onPointerCancel={() => {
          drag.current = null;
          setDraft(null);
        }}
        onLostPointerCapture={() => {
          drag.current = null;
          setDraft(null);
        }}
        onPointerLeave={() => setCursor(null)}
      >
        <defs>
          <pattern id="slots" width="24" height="30" patternUnits="userSpaceOnUse">
            <rect
              x="8"
              y="4"
              width="5"
              height="20"
              rx="2.5"
              fill="var(--board-pattern)"
              opacity=".48"
            />
          </pattern>
          <pattern id="canvas-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r=".8" fill="var(--canvas-pattern)" opacity=".42" />
          </pattern>
          <linearGradient id="rail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--rail-top)" />
            <stop offset=".45" stopColor="var(--rail-mid)" />
            <stop offset=".55" stopColor="var(--rail-bottom)" />
            <stop offset="1" stopColor="var(--rail-top)" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#canvas-grid)" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
          <rect
            width={BOARD.width}
            height={BOARD.height}
            rx="10"
            fill="var(--board-bg)"
            stroke="var(--board-border)"
            strokeWidth="2"
          />
          <rect
            x="15"
            y="15"
            width={BOARD.width - 30}
            height={BOARD.height - 30}
            rx="5"
            fill="url(#slots)"
          />
          {[30, 1370].flatMap((x) =>
            [30, 900].map((y) => (
              <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
                <circle r="7" fill="#b4beb7" />
                <path d="M-4 0H4M0-4V4" stroke="#6e8073" strokeWidth="1.5" />
              </g>
            )),
          )}
          <text x="53" y="68" className="panel-brand">
            WIREBENCH
          </text>
          <text x="53" y="93" className="board-subtitle">
            {t('bench.subtitle')}
          </text>
          <g transform="translate(1100 54)">
            <rect
              width="236"
              height="70"
              rx="5"
              fill="var(--board-panel-bg)"
              stroke="var(--board-border)"
            />
            <circle
              cx="20"
              cy="22"
              r="4"
              fill={p.powered ? 'var(--accent)' : 'var(--board-text-muted)'}
            />
            <text x="34" y="27" className="board-label">
              {p.powered ? t('bench.powerOn') : t('bench.powerOff')}
            </text>
            <text x="18" y="51" className="board-subtitle">
              {t('bench.powerModel')}
            </text>
          </g>
          {[289, 568, CONTROL_RAIL_Y].map((y) => (
            <g key={y} pointerEvents="none">
              <rect
                x="25"
                y={y}
                width="1350"
                height="16"
                rx="2"
                fill="url(#rail)"
                stroke="var(--board-border)"
              />
              <path d={`M25 ${y + 4}H1375`} stroke="var(--rail-highlight)" />
            </g>
          ))}
          <path d="M29 161H1370M29 594H1370" stroke="var(--board-border)" strokeDasharray="3 6" />
          <text x="48" y="150" className="zone-label">
            {t('bench.zonePower')}
          </text>
          <text x="48" y="584" className="zone-label">
            {t('bench.zoneControl')}
          </text>
          <rect
            x="638"
            y="722"
            width="679"
            height="157"
            rx="9"
            fill="var(--board-panel-bg)"
            stroke="var(--board-border)"
          />
          {p.fixed &&
            strips.map((s, si) => {
              const part = placements.find((x) => x.id === s.deviceId)!;
              return (
                <g
                  key={`fixed-${si}`}
                  className="fixed-leads"
                  data-fixed-device={s.deviceId}
                  pointerEvents="none"
                >
                  {s.labels.map((label, i) => (
                    <path
                      key={label}
                      d={fixedLeadPath(s, part, i)}
                      fill="none"
                      stroke={
                        label.startsWith('L') || label.startsWith('T')
                          ? 'var(--fixed-wire-power)'
                          : 'var(--fixed-wire)'
                      }
                      strokeWidth="1.8"
                    />
                  ))}
                </g>
              );
            })}
          {placements.map((part) => {
            const d = DEVICE_MAP[part.id],
              active =
                d.kind === 'supply'
                  ? p.powered
                  : !!(p.result.coils[d.id] || p.result.lamps[d.id] || p.inputs[d.id]),
              operable = ['button', 'limit', 'estop', 'thermal'].includes(d.kind);
            return (
              <g key={d.id}>
                <text x={part.labelX} y={part.labelY} textAnchor="middle" className="device-label">
                  {d.id === 'POWER'
                    ? t('bench.supplyLabel')
                    : d.id === 'MOTOR'
                      ? t('bench.motorLabel')
                      : d.id === 'ESTOP'
                        ? 'OP / E-STOP'
                        : d.id}
                  <tspan className="device-type">
                    {d.kind === 'contactor'
                      ? t('bench.contactorSuffix')
                      : d.kind === 'thermal'
                        ? t('bench.thermalSuffix')
                        : ''}
                  </tspan>
                </text>
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={t(operable ? 'bench.operateDevice' : 'bench.inspectDevice', {
                    id: d.id,
                    name: localizeDevice(d, locale),
                  })}
                  aria-pressed={operable ? !!p.inputs[d.id] : undefined}
                  className={`device-target ${p.selected === d.id ? 'selected' : ''}`}
                  transform={`translate(${part.x} ${part.y}) scale(${part.size / 160})`}
                  onPointerDown={(e) => {
                    if (e.button !== 0 || p.mode === 'pan' || space || p.pending) return;
                    e.stopPropagation();
                    p.onSelect(d.id);
                    if (d.kind === 'button') {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      p.onOperate(d.id, true);
                    }
                  }}
                  onPointerUp={(e) => {
                    if (e.button !== 0 || p.mode === 'pan' || space || p.pending) return;
                    e.stopPropagation();
                    if (d.kind === 'button') p.onOperate(d.id, false);
                  }}
                  onPointerCancel={() => {
                    if (d.kind === 'button') p.onOperate(d.id, false);
                  }}
                  onLostPointerCapture={() => {
                    if (d.kind === 'button') p.onOperate(d.id, false);
                  }}
                  onClick={(e) => {
                    if (p.mode === 'pan' || space) return;
                    e.stopPropagation();
                    if (p.pending) return;
                    p.onSelect(d.id);
                    if (operable && d.kind !== 'button') p.onOperate(d.id, !p.inputs[d.id]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.repeat || p.pending) return;
                      p.onSelect(d.id);
                      if (operable) p.onOperate(d.id, d.kind === 'button' ? true : !p.inputs[d.id]);
                    }
                  }}
                  onKeyUp={(e) => {
                    if ((e.key === ' ' || e.key === 'Enter') && d.kind === 'button') {
                      e.preventDefault();
                      e.stopPropagation();
                      p.onOperate(d.id, false);
                    }
                  }}
                  onBlur={() => {
                    if (d.kind === 'button' && p.inputs[d.id]) p.onOperate(d.id, false);
                  }}
                >
                  <rect
                    className="selection-outline"
                    x="-6"
                    y="-5"
                    width="172"
                    height="171"
                    rx="10"
                  />
                  <RefinedDeviceArt
                    kind={d.kind}
                    id={d.id}
                    active={active}
                    tripped={!!p.inputs[d.id]}
                  />
                </g>
                {d.kind === 'contactor' && (
                  <g transform={`translate(${part.labelX - 40} ${part.y + part.size + 9})`}>
                    <circle
                      cx="0"
                      cy="0"
                      r="3.5"
                      fill={active ? 'var(--accent)' : 'var(--board-text-muted)'}
                    />
                    <text x="11" y="5" className={`state-label ${active ? 'on' : ''}`}>
                      {active ? t('bench.coilOn') : t('bench.coilOff')}
                    </text>
                  </g>
                )}
                {(d.kind === 'button' || d.kind === 'limit' || d.kind === 'estop') && (
                  <text
                    x={part.x + part.size / 2}
                    y={d.kind === 'limit' ? part.y + part.size + 65 : 867}
                    textAnchor="middle"
                    className="board-subtitle"
                  >
                    {d.kind === 'button'
                      ? t('bench.hold')
                      : p.inputs[d.id]
                        ? t('bench.reset')
                        : t('bench.trigger')}
                  </text>
                )}
              </g>
            );
          })}
          {strips
            .filter((s) => !BUTTON_STRIPS.includes(s))
            .map((s) => (
              <TerminalStripArt key={`${s.deviceId}-${s.side}`} strips={[s]} />
            ))}
          <TerminalStripArt strips={BUTTON_STRIPS} />
          {/* Keep interactive groups in document order so selecting never moves focus. */}
          {wireGeometry.map((w) => {
            const points = w.points,
              selected = p.selectedWire === w.id,
              fault = highlighted.has(w.id),
              live = p.powered && !p.result.fault && p.result.potential[w.from] === 'L';
            return (
              <g
                key={w.id}
                className={`user-wire ${selected ? 'is-selected' : selectedWire && !fault ? 'is-muted' : ''} ${fault ? 'is-fault' : ''}`}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={t('bench.wireLabel', { from: w.from, to: w.to })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.repeat) return;
                    setOverlap(null);
                    p.onWireSelect(w.id);
                  }
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0 || p.mode === 'pan' || space || p.pending) return;
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  if (p.mode === 'pan' || space) return;
                  e.stopPropagation();
                  if (p.pending) return;
                  if (e.detail === 0) {
                    setOverlap(null);
                    p.onWireSelect(w.id);
                  } else selectWireAt(world(e), w.id);
                }}
              >
                <polyline
                  points={polyline(points)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="15"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="wire-hit"
                />
                {!selected && (
                  <WireVisual
                    points={points}
                    color={w.color}
                    selected={false}
                    fault={fault}
                    live={live}
                  />
                )}
              </g>
            );
          })}
          {selectedWire && (
            <g
              className="selected-wire-overlay"
              data-selected-wire={selectedWire.id}
              pointerEvents="none"
            >
              <WireVisual
                points={selectedWire.points}
                color={selectedWire.color}
                selected
                fault={highlighted.has(selectedWire.id)}
                live={p.powered && !p.result.fault && p.result.potential[selectedWire.from] === 'L'}
              />
              {!p.powered &&
                selectedWire.points.slice(1, -1).map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r="6"
                    className="wire-handle"
                    pointerEvents="all"
                    aria-label={t('bench.waypoint', { index: i + 1 })}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => {
                      if (e.button !== 0 || p.mode === 'pan' || space || p.pending) return;
                      e.stopPropagation();
                      setOverlap(null);
                      const points = selectedWire.points.slice(1, -1);
                      drag.current = {
                        kind: 'point',
                        wire: selectedWire.id,
                        index: i,
                        points,
                      };
                      setDraft({ wire: selectedWire.id, points });
                      svg.current?.setPointerCapture(e.pointerId);
                    }}
                  />
                ))}
            </g>
          )}
          {p.pending && cursor && (
            <g pointerEvents="none" fill="none" strokeDasharray="7 5">
              <polyline
                points={polyline([SOCKET_MAP[p.pending], ...p.route, cursor])}
                stroke="var(--wire-halo)"
                strokeWidth="5"
              />
              <polyline
                points={polyline([SOCKET_MAP[p.pending], ...p.route, cursor])}
                stroke={p.color}
                strokeWidth="2.6"
              />
            </g>
          )}
          {SOCKETS.map((s) => {
            const potential = p.result.potential[s.id],
              connected = counts[s.id] > 0,
              selected = p.pending === s.id || hover === s.id,
              unsupported = UNSUPPORTED_TERMINALS.has(s.id);
            return (
              <g
                key={s.id}
                role="button"
                tabIndex={0}
                aria-label={t('bench.terminalLabel', { id: s.id })}
                className={`socket ${selected ? 'active' : ''}`}
                onPointerDown={(e) => {
                  if (e.button === 0 && p.mode === 'wire' && !space) e.stopPropagation();
                }}
                onClick={(e) => {
                  if (p.mode === 'pan' || space) return;
                  e.stopPropagation();
                  p.onSocket(s.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.repeat) return;
                    p.onSocket(s.id);
                  }
                }}
                onMouseEnter={() => setHover(s.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(s.id)}
                onBlur={() => setHover(null)}
              >
                <circle cx={s.x} cy={s.y} r="10.5" fill="transparent" />
                {(selectedWire?.from === s.id || selectedWire?.to === s.id) && (
                  <circle
                    className="wire-terminal-highlight"
                    cx={s.x}
                    cy={s.y}
                    r="9"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    pointerEvents="none"
                  />
                )}
                <circle
                  className="socket-ring"
                  cx={s.x}
                  cy={s.y}
                  r="6.2"
                  fill={selected ? '#d5f1e5' : '#697e70'}
                  stroke={selected ? '#127659' : '#a7b5ab'}
                  strokeWidth={selected ? 2.5 : 1}
                />
                <circle
                  cx={s.x}
                  cy={s.y}
                  r="3.7"
                  fill={
                    selected
                      ? '#16785c'
                      : p.powered && potential === 'L'
                        ? '#dea947'
                        : connected
                          ? '#cedccc'
                          : '#233c31'
                  }
                />
                {connected && <circle cx={s.x} cy={s.y} r="1.5" fill="#e6ede2" />}
                <title>
                  {s.id}
                  {unsupported ? t('bench.reservedSuffix') : ''}
                  {counts[s.id] ? t('bench.wireCountSuffix', { count: counts[s.id] }) : ''}
                </title>
              </g>
            );
          })}
          <text x="48" y="903" className="board-footnote">
            {t('bench.footnote')}
          </text>
          <text x="1350" y="903" textAnchor="end" className="board-footnote">
            CONTROL LAB / 2D
          </text>
        </g>
      </svg>
      {showOverlap && !hover && (
        <div className="wire-overlap-hint">
          <span role="status">{t('bench.overlapHint', { count: overlapIds.length })}</span>
          <button
            onClick={() => {
              const selected = nextWireCandidate(overlapIds, p.selectedWire);
              if (!selected) return;
              setOverlap({ ...overlap, ids: overlapIds, selected });
              p.onWireSelect(selected);
            }}
          >
            {t('bench.nextWire')}
          </button>
        </div>
      )}
      {hover && (
        <div className="terminal-tooltip">
          <Cable size={13} />
          <strong>{hover.replace(':', ' · ')}</strong>
          <span>
            {UNSUPPORTED_TERMINALS.has(hover)
              ? t('bench.reserved')
              : p.powered
                ? t('bench.potential', {
                    value:
                      p.result.potential[hover] === 'floating'
                        ? t('bench.floating')
                        : p.result.potential[hover],
                  })
                : p.pending
                  ? t('bench.connect')
                  : t('bench.startWire')}
          </span>
        </div>
      )}
      <div className="view-tools">
        <button aria-label={t('bench.zoomOut')} onClick={() => zoom(1 / 1.2)}>
          <Minus size={15} />
        </button>
        <span>{Math.round(view.z * 100)}%</span>
        <button aria-label={t('bench.zoomIn')} onClick={() => zoom(1.2)}>
          <Plus size={15} />
        </button>
        <i />
        <button aria-label={t('bench.fit')} onClick={() => fit()}>
          <Maximize size={15} />
        </button>
        <i />
        <button
          aria-label={t('bench.wireMode')}
          className={p.mode === 'wire' ? 'active' : ''}
          onClick={() => p.onMode('wire')}
        >
          <MousePointer2 size={15} />
        </button>
        <button
          aria-label={t('bench.panMode')}
          className={p.mode === 'pan' ? 'active' : ''}
          onClick={() => p.onMode('pan')}
        >
          <Move size={15} />
        </button>
      </div>
      {p.pending && (
        <div className="wiring-hint">
          <span className="status-dot" /> {t('bench.wiringFrom')}{' '}
          <b>{p.pending.replace(':', ' · ')}</b> {t('bench.wiringFinish')}{' '}
          <button onClick={p.onCancel}>{t('bench.cancel')}</button>
        </div>
      )}
    </div>
  );
}
