import {
  ALL_LOADS,
  CONTACTS,
  DEVICE_MAP,
  DEVICES,
  LOADS,
  MOTOR_IDS,
  MOTOR_WINDINGS,
  RAIL_IDS,
  SUPPLY_RAILS,
  TERMINAL_IDS,
  isPhase,
} from './model';
import type { Contact, Load, Rail, Wire } from './model';
import { messageDetails, type MessageDescriptor } from '../i18n/messages';

/** A terminal is either tied to one supply rail or unconnected; it is not a measured voltage. */
export type Potential = Rail | 'floating';
export interface SimulationFault {
  kind: 'short' | 'unsupported' | 'unstable';
  message: string;
  descriptor: MessageDescriptor;
  terminals: string[];
  wireIds: string[];
}

export interface SimulationResult {
  coils: Record<string, boolean>;
  lamps: Record<string, boolean>;
  /** A motor runs only while every winding carries a phase-to-phase voltage. */
  motors: Record<string, boolean>;
  /** Per-winding result for the motor; a stopped motor names which windings are dead. */
  windings: Record<string, boolean>;
  closedContacts: string[];
  /** Connection to a rail through wires/closed contacts, not a voltage measurement. */
  potential: Record<string, Potential>;
  fault: SimulationFault | null;
}

const COIL_IDS = DEVICES.filter((device) => device.kind === 'contactor').map((device) => device.id);
const LAMP_IDS = DEVICES.filter((device) => device.kind === 'lamp').map((device) => device.id);
const VALID_TERMINALS = new Set(TERMINAL_IDS);

interface Edge {
  to: string;
  wireId?: string;
}
interface Network {
  graph: Map<string, Edge[]>;
  component: Map<string, number>;
  members: Map<number, string[]>;
  /** Component index of every supply rail. */
  rails: Record<Rail, number>;
  /** Reverse lookup; the first rail in RAIL_IDS order owns a merged component. */
  railOf: Map<number, Rail>;
}

const allFalse = (ids: string[]): Record<string, boolean> =>
  Object.fromEntries(ids.map((id) => [id, false]));

function getClosedContacts(
  coils: Record<string, boolean>,
  inputs: Record<string, boolean>,
): Contact[] {
  return CONTACTS.filter((contact) => {
    if (contact.behavior === 'through') return true;
    const actuated =
      DEVICE_MAP[contact.deviceId].kind === 'contactor'
        ? !!coils[contact.deviceId]
        : !!inputs[contact.deviceId];
    return contact.behavior === 'NO' ? actuated : !actuated;
  });
}

function buildNetwork(wires: Wire[], contacts: Contact[]): Network {
  const graph = new Map(TERMINAL_IDS.map((terminal) => [terminal, [] as Edge[]]));
  const connect = (from: string, to: string, wireId?: string) => {
    graph.get(from)!.push({ to, wireId });
    graph.get(to)!.push({ to: from, wireId });
  };
  wires.forEach((wire) => connect(wire.from, wire.to, wire.id));
  contacts.forEach((contact) => connect(contact.from, contact.to));

  const component = new Map<string, number>();
  const members = new Map<number, string[]>();
  for (const terminal of TERMINAL_IDS) {
    if (component.has(terminal)) continue;
    const id = members.size;
    const queue = [terminal];
    component.set(terminal, id);
    for (let head = 0; head < queue.length; head++) {
      for (const edge of graph.get(queue[head])!) {
        if (!component.has(edge.to)) {
          component.set(edge.to, id);
          queue.push(edge.to);
        }
      }
    }
    members.set(id, queue);
  }
  const rails = Object.fromEntries(
    RAIL_IDS.map((rail) => [rail, component.get(SUPPLY_RAILS[rail])!]),
  ) as Record<Rail, number>;
  const railOf = new Map<number, Rail>();
  for (const rail of RAIL_IDS) {
    // A user wire may join two rails. The first rail keeps the identity and the
    // pair is reported as a short, so a merged component is never taken for a
    // legitimate supply of the later rail.
    if (!railOf.has(rails[rail])) railOf.set(rails[rail], rail);
  }
  return { graph, component, members, rails, railOf };
}

/** A shortest conductor-only path keeps short-circuit feedback actionable. */
function conductorPath(
  network: Network,
  from: string,
  to: string,
): { terminals: string[]; wireIds: string[] } | null {
  const queue = [from];
  const previous = new Map<string, { terminal: string; wireId?: string }>();
  const visited = new Set([from]);
  for (let head = 0; head < queue.length && !visited.has(to); head++) {
    for (const edge of network.graph.get(queue[head])!) {
      if (visited.has(edge.to)) continue;
      previous.set(edge.to, { terminal: queue[head], wireId: edge.wireId });
      visited.add(edge.to);
      queue.push(edge.to);
    }
  }
  if (!visited.has(to)) return null;
  const terminals = [to];
  const wireIds: string[] = [];
  for (let cursor = to; cursor !== from;) {
    const edge = previous.get(cursor)!;
    if (edge.wireId) wireIds.push(edge.wireId);
    terminals.push(edge.terminal);
    cursor = edge.terminal;
  }
  return { terminals: terminals.reverse(), wireIds: [...new Set(wireIds.reverse())] };
}

interface ShortPair {
  from: Rail;
  to: Rail;
  descriptor: MessageDescriptor;
}

/**
 * Rails that must never be tied together by ideal conductors. L–N keeps its
 * original single-phase report; the three-phase main supply adds phase-to-phase
 * and phase-to-neutral checks, and mixing the two supplies is reported instead
 * of silently treating the mixed rails as one legitimate source.
 */
const SHORT_PAIRS: ShortPair[] = [
  { from: 'L', to: 'N', descriptor: { code: 'message.fault.short' } },
  {
    from: 'U',
    to: 'V',
    descriptor: { code: 'message.fault.phase-short', params: { phases: ['U', 'V'] } },
  },
  {
    from: 'V',
    to: 'W',
    descriptor: { code: 'message.fault.phase-short', params: { phases: ['V', 'W'] } },
  },
  {
    from: 'U',
    to: 'W',
    descriptor: { code: 'message.fault.phase-short', params: { phases: ['U', 'W'] } },
  },
  {
    from: 'U',
    to: 'N',
    descriptor: { code: 'message.fault.phase-neutral', params: { phase: 'U' } },
  },
  {
    from: 'V',
    to: 'N',
    descriptor: { code: 'message.fault.phase-neutral', params: { phase: 'V' } },
  },
  {
    from: 'W',
    to: 'N',
    descriptor: { code: 'message.fault.phase-neutral', params: { phase: 'W' } },
  },
  { from: 'L', to: 'U', descriptor: { code: 'message.fault.supply-mix', params: { phase: 'U' } } },
  { from: 'L', to: 'V', descriptor: { code: 'message.fault.supply-mix', params: { phase: 'V' } } },
  { from: 'L', to: 'W', descriptor: { code: 'message.fault.supply-mix', params: { phase: 'W' } } },
];

function shortCircuit(network: Network): SimulationFault | null {
  for (const pair of SHORT_PAIRS) {
    if (network.rails[pair.from] !== network.rails[pair.to]) continue;
    const path = conductorPath(network, SUPPLY_RAILS[pair.from], SUPPLY_RAILS[pair.to]);
    if (!path) continue;
    return { kind: 'short', ...messageDetails(pair.descriptor), ...path };
  }
  return null;
}

/**
 * Contract only ideal conductors. A cluster of unreferenced nodes linked by
 * loads is unsupported only if loads connect that cluster to BOTH control
 * rails. This admits independent parallel loads and disconnected/dangling
 * circuits. Motor windings are loads here too: they never become conductors.
 */
function unsupportedLoadNetwork(network: Network, wires: Wire[]): SimulationFault | null {
  const loadGraph = new Map<number, { to: number; load: Load }[]>();
  for (const load of ALL_LOADS) {
    const from = network.component.get(load.from)!;
    const to = network.component.get(load.to)!;
    if (from === to) continue;
    if (!loadGraph.has(from)) loadGraph.set(from, []);
    if (!loadGraph.has(to)) loadGraph.set(to, []);
    loadGraph.get(from)!.push({ to, load });
    loadGraph.get(to)!.push({ to: from, load });
  }
  const isRail = (id: number) => id === network.rails.L || id === network.rails.N;
  const visited = new Set<number>();
  for (const start of loadGraph.keys()) {
    if (isRail(start) || visited.has(start)) continue;
    const cluster = [start];
    const loads = new Set<Load>();
    const rails = new Set<number>();
    visited.add(start);
    for (let head = 0; head < cluster.length; head++) {
      for (const edge of loadGraph.get(cluster[head]) ?? []) {
        loads.add(edge.load);
        if (isRail(edge.to)) rails.add(edge.to);
        else if (!visited.has(edge.to)) {
          visited.add(edge.to);
          cluster.push(edge.to);
        }
      }
    }
    if (rails.size === 2) {
      const terminals = [...new Set([...loads].flatMap((load) => [load.from, load.to]))];
      const implicated = new Set([...cluster, ...rails]);
      return {
        kind: 'unsupported',
        ...messageDetails({
          code: 'message.fault.series',
          params: { devices: [...loads].map((load) => load.deviceId) },
        }),
        terminals,
        wireIds: wires
          .filter((wire) => implicated.has(network.component.get(wire.from)!))
          .map((wire) => wire.id),
      };
    }
  }
  return null;
}

function poweredLoad(load: Load, network: Network): boolean {
  const from = network.component.get(load.from)!;
  const to = network.component.get(load.to)!;
  return (
    (from === network.rails.L && to === network.rails.N) ||
    (from === network.rails.N && to === network.rails.L)
  );
}

/**
 * A star point is a node shared by at least two different windings that is tied
 * to no supply rail. Wiring U2/V2/W2 together (Y) creates it: a winding is a
 * load and not a conductor, so the node stays floating in the terminal map
 * while the winding between it and a phase still spans two phases.
 */
function starComponents(network: Network): Set<number> {
  const windingsByComponent = new Map<number, Set<number>>();
  MOTOR_WINDINGS.forEach((winding, index) => {
    for (const terminal of [winding.from, winding.to]) {
      const component = network.component.get(terminal)!;
      const windings = windingsByComponent.get(component) ?? new Set<number>();
      windings.add(index);
      windingsByComponent.set(component, windings);
    }
  });
  const star = new Set<number>();
  for (const [component, windings] of windingsByComponent) {
    if (windings.size >= 2 && !network.railOf.has(component)) star.add(component);
  }
  return star;
}

/** One winding: two different phases at its ends, or one phase and the motor star point. */
function windingEnergized(winding: Load, network: Network, star: Set<number>): boolean {
  const from = network.component.get(winding.from)!;
  const to = network.component.get(winding.to)!;
  if (from === to) return false;
  const fromRail = network.railOf.get(from);
  const toRail = network.railOf.get(to);
  const fromPhase = fromRail && isPhase(fromRail) ? fromRail : null;
  const toPhase = toRail && isPhase(toRail) ? toRail : null;
  if (fromPhase && toPhase) return fromPhase !== toPhase;
  if (fromPhase && star.has(to)) return true;
  if (toPhase && star.has(from)) return true;
  // A single-phase L/N feed, an open winding and two ends on one node all stop.
  return false;
}

/** The phase rail feeding one winding end, when that end is tied to a phase. */
function phaseOf(network: Network, terminal: string): Rail | null {
  const rail = network.railOf.get(network.component.get(terminal)!);
  return rail && isPhase(rail) ? rail : null;
}

function motorStates(network: Network): {
  motors: Record<string, boolean>;
  windings: Record<string, boolean>;
} {
  const star = starComponents(network);
  const energized = MOTOR_WINDINGS.map((winding) => windingEnergized(winding, network, star));
  // A rotating field needs all three windings and three distinct phases feeding
  // them. Wiring L1/L2/L3 to the same phase leaves every winding "energized"
  // between that phase and the star point, yet nothing turns.
  const supplied = MOTOR_WINDINGS.map((winding) => phaseOf(network, winding.from));
  const rotating = new Set(supplied.filter((rail): rail is Rail => rail !== null));
  const running = energized.every(Boolean) && rotating.size === MOTOR_WINDINGS.length;
  return {
    motors: Object.fromEntries(MOTOR_IDS.map((id) => [id, running])),
    windings: Object.fromEntries(
      MOTOR_WINDINGS.map((winding, index) => [winding.from, energized[index]]),
    ),
  };
}

function stopped(
  inputs: Record<string, boolean>,
  fault: SimulationFault | null = null,
): SimulationResult {
  const coils = allFalse(COIL_IDS);
  return {
    coils,
    lamps: allFalse(LAMP_IDS),
    motors: allFalse(MOTOR_IDS),
    windings: Object.fromEntries(MOTOR_WINDINGS.map((winding) => [winding.from, false])),
    closedContacts: getClosedContacts(coils, inputs).map((contact) => contact.id),
    potential: Object.fromEntries(
      TERMINAL_IDS.map((terminal) => [terminal, 'floating' as Potential]),
    ),
    fault,
  };
}

/**
 * Resolve one user action to a stable relay state. Carry the previous coils
 * into the next call to retain electrical self-holding; power-off always resets.
 * Input true means pressed, limit actuated, emergency stop latched, or FR tripped.
 */
export function simulate(
  wires: Wire[],
  inputs: Record<string, boolean>,
  powered: boolean,
  previousCoils: Record<string, boolean> = {},
): SimulationResult {
  if (!powered) return stopped(inputs);

  const invalid = wires.filter(
    (wire) => !VALID_TERMINALS.has(wire.from) || !VALID_TERMINALS.has(wire.to),
  );
  if (invalid.length)
    return stopped(inputs, {
      kind: 'unsupported',
      ...messageDetails({ code: 'message.fault.unknown-terminal' }),
      terminals: [
        ...new Set(
          invalid
            .flatMap((wire) => [wire.from, wire.to])
            .filter((terminal) => !VALID_TERMINALS.has(terminal)),
        ),
      ],
      wireIds: invalid.map((wire) => wire.id),
    });

  let coils = Object.fromEntries(COIL_IDS.map((id) => [id, !!previousCoils[id]]));
  const seen = new Set<string>();
  const changedCoils = new Set<string>();
  // There are only 2^3 coil states. A repeat before a fixed point is a cycle.
  for (;;) {
    const key = COIL_IDS.map((id) => (coils[id] ? '1' : '0')).join('');
    if (seen.has(key)) {
      const devices = [...changedCoils];
      const terminals = devices.flatMap((id) => [`${id}:A1`, `${id}:A2`]);
      return stopped(inputs, {
        kind: 'unstable',
        ...messageDetails({ code: 'message.fault.unstable', params: { devices } }),
        terminals,
        wireIds: wires
          .filter((wire) =>
            [wire.from, wire.to].some((terminal) => devices.includes(terminal.split(':')[0])),
          )
          .map((wire) => wire.id),
      });
    }
    seen.add(key);
    const contacts = getClosedContacts(coils, inputs);
    const network = buildNetwork(wires, contacts);
    const fault = shortCircuit(network) ?? unsupportedLoadNetwork(network, wires);
    if (fault) return stopped(inputs, fault);

    const next = allFalse(COIL_IDS);
    const lamps = allFalse(LAMP_IDS);
    for (const load of LOADS) {
      if (load.kind === 'coil') next[load.deviceId] = poweredLoad(load, network);
      else if (load.kind === 'lamp') lamps[load.deviceId] = poweredLoad(load, network);
    }
    if (COIL_IDS.every((id) => next[id] === coils[id])) {
      const potential = Object.fromEntries(
        TERMINAL_IDS.map((terminal): [string, Potential] => [
          terminal,
          network.railOf.get(network.component.get(terminal)!) ?? 'floating',
        ]),
      );
      const motor = motorStates(network);
      return {
        coils: next,
        lamps,
        motors: motor.motors,
        windings: motor.windings,
        closedContacts: contacts.map((contact) => contact.id),
        potential,
        fault: null,
      };
    }
    for (const id of COIL_IDS) if (next[id] !== coils[id]) changedCoils.add(id);
    coils = next;
  }
}
