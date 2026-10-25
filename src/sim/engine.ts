import {
  CONTACTS,
  DEVICE_MAP,
  DEVICES,
  ALL_LOADS,
  LOADS,
  MOTOR_IDS,
  RAIL_IDS,
  SUPPLY_RAILS,
  TERMINAL_IDS,
} from './model';
import type { Contact, Load, Rail, Wire } from './model';
import { messageDetails, type MessageDescriptor } from '../i18n/messages';
import { evaluateMotor, type MotorEvaluation } from './motor';
import { relateRails } from './supply';

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
  /** True when the modeled three-phase winding-supply criteria are met. */
  motors: Record<string, boolean>;
  /** Per-winding result, keyed by stable IDs such as MOTOR:U. */
  windings: Record<string, boolean>;
  motorEvaluations: Record<string, MotorEvaluation>;
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

function directRailFault(network: Network): SimulationFault | null {
  for (let left = 0; left < RAIL_IDS.length; left++) {
    for (let right = left + 1; right < RAIL_IDS.length; right++) {
      const from = RAIL_IDS[left];
      const to = RAIL_IDS[right];
      if (network.rails[from] !== network.rails[to]) continue;
      const relation = relateRails(from, to);
      const path = conductorPath(network, SUPPLY_RAILS[from], SUPPLY_RAILS[to]);
      if (!path) continue;
      const descriptor: MessageDescriptor =
        relation.kind === 'defined' && relation.source === 'control'
          ? { code: 'message.fault.short' }
          : relation.kind === 'defined'
            ? { code: 'message.fault.phase-short', params: { phases: [from, to] } }
            : from === 'N' || to === 'N'
              ? { code: 'message.fault.phase-neutral', params: { phase: from === 'N' ? to : from } }
              : { code: 'message.fault.supply-mix', params: { phase: from === 'L' ? to : from } };
      return {
        kind: relation.kind === 'defined' ? 'short' : 'unsupported',
        ...messageDetails(descriptor),
        ...path,
      };
    }
  }
  return null;
}

function localizedLoadEvidence(network: Network, wires: Wire[], loads: Set<Load>) {
  const terminalsByComponent = new Map<number, Set<string>>();
  for (const load of loads) {
    for (const terminal of [load.from, load.to]) {
      const component = network.component.get(terminal)!;
      const terminals = terminalsByComponent.get(component) ?? new Set<string>();
      terminals.add(terminal);
      terminalsByComponent.set(component, terminals);
    }
  }
  const terminals = new Set<string>();
  const wireIds = new Set<string>();
  for (const [component, loadTerminals] of terminalsByComponent) {
    const rail = network.railOf.get(component);
    const root = rail ? SUPPLY_RAILS[rail] : loadTerminals.values().next().value;
    if (!root) continue;
    terminals.add(root);
    for (const terminal of loadTerminals) {
      const path = conductorPath(network, root, terminal);
      if (!path) continue;
      path.terminals.forEach((entry) => terminals.add(entry));
      path.wireIds.forEach((entry) => wireIds.add(entry));
    }
  }
  const implicatedWires = wires.filter((wire) => wireIds.has(wire.id));
  return { terminals: [...terminals], wireIds: implicatedWires.map((wire) => wire.id) };
}

/**
 * Validate all loads as one network. Recognized motor patterns are evaluated
 * by the motor matcher; unrecognized winding combinations remain observable
 * but participate in series-load checks with coils and lamps.
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
  const isRail = (id: number) => RAIL_IDS.some((rail) => network.rails[rail] === id);
  const loadFault = (loads: Set<Load>, rails: Set<Rail>) => {
    const evidence = localizedLoadEvidence(network, wires, loads);
    const devices = [...new Set([...loads].map((load) => load.deviceId))];
    const controlPair = rails.size === 2 && rails.has('L') && rails.has('N');
    return {
      kind: 'unsupported' as const,
      ...messageDetails(
        controlPair
          ? {
              code: 'message.fault.series',
              params: { devices },
            }
          : {
              code: 'message.fault.unsupported-supply',
              params: { devices, rails: [...rails] },
            },
      ),
      ...evidence,
    };
  };

  // Coils and lamps only have a defined supply relation across control L/N.
  for (const load of LOADS) {
    const fromRail = network.railOf.get(network.component.get(load.from)!);
    const toRail = network.railOf.get(network.component.get(load.to)!);
    if (!fromRail || !toRail) continue;
    const relation = relateRails(fromRail, toRail);
    if (
      relation.kind === 'undefined' ||
      (relation.kind === 'defined' && relation.source !== 'control')
    ) {
      return loadFault(new Set([load]), new Set([fromRail, toRail]));
    }
  }

  const visited = new Set<number>();
  for (const start of loadGraph.keys()) {
    if (isRail(start) || visited.has(start)) continue;
    const cluster = [start];
    const loads = new Set<Load>();
    const rails = new Set<Rail>();
    visited.add(start);
    for (let head = 0; head < cluster.length; head++) {
      for (const edge of loadGraph.get(cluster[head]) ?? []) {
        loads.add(edge.load);
        if (isRail(edge.to)) {
          const rail = network.railOf.get(edge.to);
          if (rail) rails.add(rail);
        } else if (!visited.has(edge.to)) {
          visited.add(edge.to);
          cluster.push(edge.to);
        }
      }
    }
    const onlyWindings = [...loads].every((load) => load.kind === 'winding');
    if (rails.size >= 2 && !onlyWindings) return loadFault(loads, rails);
  }
  return null;
}

function poweredLoad(load: Load, network: Network): boolean {
  const from = network.railOf.get(network.component.get(load.from)!);
  const to = network.railOf.get(network.component.get(load.to)!);
  if (!from || !to) return false;
  const relation = relateRails(from, to);
  return relation.kind === 'defined' && relation.source === 'control';
}

function evaluateMotorNetwork(network: Network): MotorEvaluation {
  return evaluateMotor({
    end: (terminal) => {
      const component = network.component.get(terminal)!;
      return { node: component, rail: network.railOf.get(component) ?? null };
    },
  });
}

function stopped(
  inputs: Record<string, boolean>,
  fault: SimulationFault | null = null,
  wires: Wire[] = [],
): SimulationResult {
  const coils = allFalse(COIL_IDS);
  const validWires = wires.every(
    (wire) => VALID_TERMINALS.has(wire.from) && VALID_TERMINALS.has(wire.to),
  );
  const structuralMotor = validWires
    ? evaluateMotorNetwork(buildNetwork(wires, []))
    : evaluateMotor({ end: (terminal) => ({ node: TERMINAL_IDS.indexOf(terminal), rail: null }) });
  const motor: MotorEvaluation = {
    ...structuralMotor,
    running: false,
    windings: allFalse(Object.keys(structuralMotor.windings)),
  };
  return {
    coils,
    lamps: allFalse(LAMP_IDS),
    motors: allFalse(MOTOR_IDS),
    windings: motor.windings,
    motorEvaluations: Object.fromEntries(MOTOR_IDS.map((id) => [id, motor])),
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
  if (!powered) return stopped(inputs, null, wires);

  const invalid = wires.filter(
    (wire) => !VALID_TERMINALS.has(wire.from) || !VALID_TERMINALS.has(wire.to),
  );
  if (invalid.length)
    return stopped(
      inputs,
      {
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
      },
      wires,
    );

  let coils = Object.fromEntries(COIL_IDS.map((id) => [id, !!previousCoils[id]]));
  const seen = new Set<string>();
  const changedCoils = new Set<string>();
  // There are only 2^3 coil states. A repeat before a fixed point is a cycle.
  for (;;) {
    const key = COIL_IDS.map((id) => (coils[id] ? '1' : '0')).join('');
    if (seen.has(key)) {
      const devices = [...changedCoils];
      const terminals = devices.flatMap((id) => [`${id}:A1`, `${id}:A2`]);
      return stopped(
        inputs,
        {
          kind: 'unstable',
          ...messageDetails({ code: 'message.fault.unstable', params: { devices } }),
          terminals,
          wireIds: wires
            .filter((wire) =>
              [wire.from, wire.to].some((terminal) => devices.includes(terminal.split(':')[0])),
            )
            .map((wire) => wire.id),
        },
        wires,
      );
    }
    seen.add(key);
    const contacts = getClosedContacts(coils, inputs);
    const network = buildNetwork(wires, contacts);
    const motor = evaluateMotorNetwork(network);
    const fault = directRailFault(network) ?? unsupportedLoadNetwork(network, wires);
    if (fault) return stopped(inputs, fault, wires);

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
      return {
        coils: next,
        lamps,
        motors: Object.fromEntries(MOTOR_IDS.map((id) => [id, motor.running])),
        windings: motor.windings,
        motorEvaluations: Object.fromEntries(MOTOR_IDS.map((id) => [id, motor])),
        closedContacts: contacts.map((contact) => contact.id),
        potential,
        fault: null,
      };
    }
    for (const id of COIL_IDS) if (next[id] !== coils[id]) changedCoils.add(id);
    coils = next;
  }
}
