import { PROJECT_LIMITS } from './limits';
import { DEVICES, DEVICE_MAP } from './sim/model';
import type { Device } from './sim/model';
import { translate, type Locale } from './i18n/catalog';
export interface Point {
  x: number;
  y: number;
}
export interface Strip {
  deviceId: string;
  labels: string[];
  x: number;
  y: number;
  step: number;
  side: 'top' | 'bottom';
}
export interface Placement {
  id: string;
  x: number;
  y: number;
  size: number;
  labelX: number;
  labelY: number;
}
export interface Socket extends Point {
  id: string;
  deviceId: string;
  label: string;
  side: 'top' | 'bottom';
}
export const BOARD = { width: 1400, height: 930 };
export const CONTROL_RAIL_Y = 714;
export const LAMP_PANEL = { x: 1170, y: 215, width: 170, height: 252 };
export const strips: Strip[] = [];
export const placements: Placement[] = [];
function strip(
  deviceId: string,
  labels: string[],
  x: number,
  y: number,
  side: 'top' | 'bottom' = 'top',
  step = 23,
) {
  strips.push({ deviceId, labels, x, y, side, step });
}
for (let n = 1; n <= 3; n++) {
  const id = `KM${n}`,
    x = 40 + (n - 1) * 235;
  strip(id, ['A1', 'L1', 'L2', 'L3', '13', '53', '61', '71', '83', 'A2'], x, 220, 'top', 21);
  strip(id, ['T1', 'T2', 'T3', '14', '54', '62', '72', '84'], x + 21, 489, 'bottom', 21);
  placements.push({ id, x: x + 28, y: 313, size: 155, labelX: x + 105, labelY: 197 });
}
for (let n = 1; n <= 2; n++) {
  const id = `FR${n}`,
    x = 752 + (n - 1) * 201;
  strip(id, ['L1', 'L2', 'L3'], x + 46, 220, 'top', 26);
  strip(id, ['T1', 'T2', 'T3', '97', '98', '95', '96'], x + 1, 489, 'bottom', 24);
  placements.push({ id, x: x + 9, y: 313, size: 155, labelX: x + 85, labelY: 197 });
}
for (let n = 1; n <= 3; n++) {
  const id = `HL${n}`,
    y = 228 + (n - 1) * 79;
  strip(id, [...DEVICE_MAP[id].terminals], 1176 + (n - 1) * 52, 489, 'bottom', 26);
  placements.push({ id, x: 1235, y, size: 90, labelX: 1212, labelY: y + 44 });
}
strip('POWER', ['U2', 'V2', 'W2', 'L', 'N'], 583, 70, 'bottom', 42);
placements.push({ id: 'POWER', x: 455, y: 34, size: 111, labelX: 688, labelY: 45 });
strip('MOTOR', ['U1', 'V1', 'W1', 'U2', 'V2', 'W2'], 40, 644, 'top', 26);
placements.push({ id: 'MOTOR', x: 51, y: 733, size: 128, labelX: 118, labelY: 622 });
for (let n = 1; n <= 2; n++) {
  const id = `SQ${n}`,
    stripX = 220 + (n - 1) * 120;
  strip(id, [...DEVICE_MAP[id].terminals], stripX, 644, 'top', 25);
  // The sketch places both terminal groups before both switch bodies; labels identify the strips.
  placements.push({
    id,
    x: 460 + (n - 1) * 95,
    y: 634,
    size: 86,
    labelX: stripX + 50,
    labelY: 622,
  });
}
let buttonStripX = 656;
// A shared pitch leaves room for the narrower two-terminal emergency-stop group.
// Derive device centers from their terminal groups so future label changes cannot offset them.
const BUTTON_TERMINAL_PITCH = 40;
for (let n = 1; n <= 3; n++) {
  const id = `SB${n}`,
    labels = DEVICE_MAP[id].terminals,
    width = labels.length * BUTTON_TERMINAL_PITCH,
    centerX = buttonStripX + width / 2;
  strip(id, [...labels], buttonStripX, 644, 'top', BUTTON_TERMINAL_PITCH);
  placements.push({
    id,
    x: centerX - 103 / 2,
    y: 736,
    size: 103,
    labelX: centerX,
    labelY: 622,
  });
  buttonStripX += width;
}
const emergencyCenterX =
  buttonStripX + (DEVICE_MAP.ESTOP.terminals.length * BUTTON_TERMINAL_PITCH) / 2;
strip('ESTOP', [...DEVICE_MAP.ESTOP.terminals], buttonStripX, 644, 'top', BUTTON_TERMINAL_PITCH);
placements.push({
  id: 'ESTOP',
  x: emergencyCenterX - 111 / 2,
  y: 734,
  size: 111,
  labelX: emergencyCenterX,
  labelY: 622,
});
/** One physical terminal bank, with electrically independent SB and emergency-stop groups. */
export const BUTTON_STRIPS = strips.filter((s) =>
  ['button', 'estop'].includes(DEVICE_MAP[s.deviceId].kind),
);
/** Three independent lamps share one enclosure and one six-position terminal bank. */
export const LAMP_STRIPS = strips.filter((s) => DEVICE_MAP[s.deviceId].kind === 'lamp');
export const SOCKETS: Socket[] = strips.flatMap((s) =>
  s.labels.map((label, i) => ({
    id: `${s.deviceId}:${label}`,
    deviceId: s.deviceId,
    label,
    x: s.x + i * s.step + s.step / 2,
    y: s.y + (s.side === 'top' ? 10 : 52),
    side: s.side,
  })),
);
export const SOCKET_MAP: Record<string, Socket> = Object.fromEntries(SOCKETS.map((s) => [s.id, s]));
export const PLACEMENT_MAP = Object.fromEntries(placements.map((p) => [p.id, p]));

/** Fixed-lead geometry is visual only; terminal identities still define the one-to-one mapping. */
export function fixedLeadPath(s: Strip, part: Placement, index: number): string {
  const sx = s.x + index * s.step + s.step / 2,
    sy = s.y + (s.side === 'top' ? 52 : 10),
    fraction = index / (s.labels.length - 1 || 1);
  if (DEVICE_MAP[s.deviceId].kind === 'limit') {
    // Only the short entry into the lower duct is exposed; the route to the SQ body stays concealed.
    return `M${sx} ${sy} V${CONTROL_RAIL_Y + 1}`;
  }
  if (DEVICE_MAP[s.deviceId].kind === 'lamp') {
    // Leads emerge below the shared enclosure; lamp connections inside it are concealed.
    return `M${sx} ${sy} V${LAMP_PANEL.y + LAMP_PANEL.height}`;
  }
  let tx = part.x + 18 + fraction * (part.size - 36),
    ty = part.y + (s.side === 'top' ? 13 : part.size - 9);
  if (s.deviceId === 'POWER') {
    tx = part.x + 100;
    ty = part.y + 70;
  }
  return `M${sx} ${sy} C${sx} ${(sy + ty) / 2} ${tx} ${(sy + ty) / 2} ${tx} ${ty}`;
}

export const friendlyTerminal = (id: string) => id.replace(':', ' · ');
/** Localized UI names never replace stable device or terminal identifiers. */
export function localizeDevice(device: Device, locale: Locale): string {
  const index = device.id.match(/\d+$/)?.[0] ?? '';
  if (device.kind === 'lamp') {
    const key =
      device.id === 'HL1'
        ? 'device.name.lampAmber'
        : device.id === 'HL2'
          ? 'device.name.lampGreen'
          : 'device.name.lampRed';
    return translate(locale, key);
  }
  const keys = {
    contactor: 'device.name.contactor',
    thermal: 'device.name.thermal',
    button: 'device.name.button',
    limit: 'device.name.limit',
    estop: 'device.name.estop',
    motor: 'device.name.motor',
    supply: 'device.name.supply',
  } as const;
  return translate(locale, keys[device.kind], { index });
}

export function wirePoints(from: string, to: string, points?: Point[]): Point[] {
  const a = SOCKET_MAP[from],
    b = SOCKET_MAP[to];
  if (!a || !b) return [];
  if (points) return [a, ...points, b];
  const offsetA = a.side === 'top' ? -28 : 28,
    offsetB = b.side === 'top' ? -28 : 28;
  // Small stable offsets spread wires while keeping routes easy to edit.
  const lane = ((from + to).split('').reduce((n, c) => n + c.charCodeAt(0), 0) % 5) * 7;
  if (Math.abs(a.y - b.y) < 20) {
    const routeY = a.y + offsetA + (offsetA < 0 ? -lane : lane);
    return [a, { x: a.x, y: routeY }, { x: b.x, y: routeY }, b];
  }
  const middleX = (a.x + b.x) / 2 + lane;
  return [
    a,
    { x: a.x, y: a.y + offsetA },
    { x: middleX, y: a.y + offsetA },
    { x: middleX, y: b.y + offsetB },
    { x: b.x, y: b.y + offsetB },
    b,
  ];
}
export function polyline(points: Point[]) {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}
export function assertLayout() {
  for (const d of DEVICES)
    for (const t of d.terminals)
      if (!SOCKET_MAP[`${d.id}:${t}`]) throw new Error(`Missing layout ${d.id}:${t}`);
}
assertLayout();

export function clampPoint(point: Point): Point {
  const bound = (n: number) =>
    Math.max(PROJECT_LIMITS.minCoordinate, Math.min(PROJECT_LIMITS.maxCoordinate, n));
  return { x: bound(point.x), y: bound(point.y) };
}
