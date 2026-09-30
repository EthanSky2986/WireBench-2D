import { CONTACTS, DEVICE_MAP, DEVICES, LOADS, TERMINAL_IDS, UNSUPPORTED_TERMINALS } from './model';
import type { Contact, Load, Wire } from './model';
import { messageDetails, type MessageDescriptor } from '../i18n/messages';

export type Potential = 'L' | 'N' | 'floating';
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
  closedContacts: string[];
  /** Connection to a rail through wires/closed contacts, not a voltage measurement. */
  potential: Record<string, Potential>;
  fault: SimulationFault | null;
}

const COIL_IDS = DEVICES.filter((device) => device.kind === 'contactor').map((device) => device.id);
const LAMP_IDS = DEVICES.filter((device) => device.kind === 'lamp').map((device) => device.id);
const VALID_TERMINALS = new Set(TERMINAL_IDS);
const L = 'POWER:L';
const N = 'POWER:N';

interface Edge {
  to: string;
  wireId?: string;
}
interface Network {
  graph: Map<string, Edge[]>;
  component: Map<string, number>;
  members: Map<number, string[]>;
  lComponent: number;
  nComponent: number;
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
  return {
    graph,
    component,
    members,
    lComponent: component.get(L)!,
    nComponent: component.get(N)!,
  };
}

/** A shortest conductor-only path makes short-circuit feedback actionable. */
function shortCircuit(network: Network): SimulationFault | null {
  if (network.lComponent !== network.nComponent) return null;
  const queue = [L];
  const previous = new Map<string, { terminal: string; wireId?: string }>();
  const visited = new Set([L]);
  for (let head = 0; head < queue.length && !visited.has(N); head++) {
    for (const edge of network.graph.get(queue[head])!) {
      if (visited.has(edge.to)) continue;
      previous.set(edge.to, { terminal: queue[head], wireId: edge.wireId });
      visited.add(edge.to);
      queue.push(edge.to);
    }
  }
  const terminals = [N];
  const wireIds: string[] = [];
  for (let cursor = N; cursor !== L;) {
    const edge = previous.get(cursor)!;
    if (edge.wireId) wireIds.push(edge.wireId);
    terminals.push(edge.terminal);
    cursor = edge.terminal;
  }
  return {
    kind: 'short',
    ...messageDetails({ code: 'message.fault.short' }),
    terminals: terminals.reverse(),
    wireIds: [...new Set(wireIds.reverse())],
  };
}

/**
 * Contract only ideal conductors. A cluster of unreferenced nodes linked by
 * loads is unsupported only if loads connect that cluster to BOTH rails.
 * This admits independent parallel loads and disconnected/dangling circuits.
 */
function unsupportedLoadNetwork(network: Network, wires: Wire[]): SimulationFault | null {
  const loadGraph = new Map<number, { to: number; load: Load }[]>();
  for (const load of LOADS) {
    const from = network.component.get(load.from)!;
    const to = network.component.get(load.to)!;
    if (from === to) continue;
    if (!loadGraph.has(from)) loadGraph.set(from, []);
    if (!loadGraph.has(to)) loadGraph.set(to, []);
    loadGraph.get(from)!.push({ to, load });
    loadGraph.get(to)!.push({ to: from, load });
  }
  const isRail = (id: number) => id === network.lComponent || id === network.nComponent;
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
    (from === network.lComponent && to === network.nComponent) ||
    (from === network.nComponent && to === network.lComponent)
  );
}

function stopped(
  inputs: Record<string, boolean>,
  fault: SimulationFault | null = null,
): SimulationResult {
  const coils = allFalse(COIL_IDS);
  return {
    coils,
    lamps: allFalse(LAMP_IDS),
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

  const unsupported = wires.filter(
    (wire) => UNSUPPORTED_TERMINALS.has(wire.from) || UNSUPPORTED_TERMINALS.has(wire.to),
  );
  if (unsupported.length)
    return stopped(inputs, {
      kind: 'unsupported',
      ...messageDetails({ code: 'message.fault.reserved' }),
      terminals: [
        ...new Set(
          unsupported
            .flatMap((wire) => [wire.from, wire.to])
            .filter((terminal) => UNSUPPORTED_TERMINALS.has(terminal)),
        ),
      ],
      wireIds: unsupported.map((wire) => wire.id),
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
      else lamps[load.deviceId] = poweredLoad(load, network);
    }
    if (COIL_IDS.every((id) => next[id] === coils[id])) {
      const potential = Object.fromEntries(
        TERMINAL_IDS.map((terminal): [string, Potential] => {
          const component = network.component.get(terminal);
          return [
            terminal,
            component === network.lComponent
              ? 'L'
              : component === network.nComponent
                ? 'N'
                : 'floating',
          ];
        }),
      );
      return {
        coils: next,
        lamps,
        closedContacts: contacts.map((contact) => contact.id),
        potential,
        fault: null,
      };
    }
    for (const id of COIL_IDS) if (next[id] !== coils[id]) changedCoils.add(id);
    coils = next;
  }
}
