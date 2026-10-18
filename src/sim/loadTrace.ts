import type { Potential, SimulationResult } from './engine';
import {
  CONTACTS,
  MOTOR_WINDINGS,
  OBSERVABLE_LOADS,
  SUPPLY_RAILS,
  TERMINAL_IDS,
  type Rail,
  type Wire,
} from './model';

export interface LoadTrace {
  /** The selected load's device ID, as defined by OBSERVABLE_LOADS. */
  loadId: string;
  status: 'energized' | 'unpowered' | 'fault' | 'unconnected' | 'same-rail' | 'partial';
  /** True when this entry is one device with several windings, i.e. the motor. */
  multiWinding: boolean;
  ends: { terminalId: string; potential: Potential }[];
  wireIds: string[];
  contactIds: string[];
  terminalIds: string[];
}

interface Conductor {
  from: number;
  to: number;
  wireId?: string;
  contactId?: string;
}

interface ConductorBlocks {
  edges: Conductor[];
  blocks: number[][];
  tree: number[][];
}

const TERMINAL_INDEX = new Map(TERMINAL_IDS.map((id, index) => [id, index]));

function isRail(potential: Potential): potential is Rail {
  return potential !== 'floating';
}

/**
 * Split the undirected conductor graph into biconnected edge blocks. In the
 * resulting block-cut tree, only blocks on the terminal-to-rail path can
 * support this load. Every edge inside such a block belongs to at least one
 * simple path between its entry and exit vertices. This includes parallel
 * branches, but excludes a dangling branch or loop attached at one vertex.
 *
 * Work is linear in vertices + conductors; we never enumerate simple paths.
 * Loads are deliberately absent: they are not ideal conductors.
 */
function conductorBlocks(wires: Wire[], result: SimulationResult): ConductorBlocks {
  const edges: Conductor[] = [];
  const adjacent: number[][] = TERMINAL_IDS.map(() => []);
  const add = (fromId: string, toId: string, identity: { wireId?: string; contactId?: string }) => {
    const from = TERMINAL_INDEX.get(fromId);
    const to = TERMINAL_INDEX.get(toId);
    // A self-loop cannot participate in a simple path between distinct ends.
    if (from === undefined || to === undefined || from === to) return;
    const edgeId = edges.length;
    edges.push({ from, to, ...identity });
    adjacent[from].push(edgeId);
    adjacent[to].push(edgeId);
  };
  for (const wire of wires) add(wire.from, wire.to, { wireId: wire.id });
  const closed = new Set(result.closedContacts);
  for (const contact of CONTACTS) {
    if (closed.has(contact.id)) add(contact.from, contact.to, { contactId: contact.id });
  }

  const discovered = TERMINAL_IDS.map(() => -1);
  const low = TERMINAL_IDS.map(() => -1);
  const stack: number[] = [];
  const blocks: number[][] = [];
  let order = 0;
  const visit = (vertex: number, parentEdge: number) => {
    discovered[vertex] = low[vertex] = order++;
    for (const edgeId of adjacent[vertex]) {
      // Skip the exact incoming edge, not every edge to the parent. A wire
      // may bridge a closed contact, making a legitimate two-edge block.
      if (edgeId === parentEdge) continue;
      const edge = edges[edgeId];
      const next = edge.from === vertex ? edge.to : edge.from;
      if (discovered[next] === -1) {
        stack.push(edgeId);
        visit(next, edgeId);
        low[vertex] = Math.min(low[vertex], low[next]);
        if (low[next] >= discovered[vertex]) {
          const block: number[] = [];
          let popped: number;
          do {
            popped = stack.pop()!;
            block.push(popped);
          } while (popped !== edgeId);
          blocks.push(block);
        }
      } else if (discovered[next] < discovered[vertex]) {
        stack.push(edgeId);
        low[vertex] = Math.min(low[vertex], discovered[next]);
      }
    }
  };
  for (let vertex = 0; vertex < TERMINAL_IDS.length; vertex++) {
    if (discovered[vertex] === -1) visit(vertex, -1);
  }

  const tree: number[][] = Array.from({ length: TERMINAL_IDS.length + blocks.length }, () => []);
  blocks.forEach((block, index) => {
    const blockVertex = TERMINAL_IDS.length + index;
    const terminals = new Set(block.flatMap((edgeId) => [edges[edgeId].from, edges[edgeId].to]));
    for (const terminal of terminals) {
      tree[terminal].push(blockVertex);
      tree[blockVertex].push(terminal);
    }
  });
  return { edges, blocks, tree };
}

function supportEdges(network: ConductorBlocks, from: string, rail: Rail): number[] | null {
  const start = TERMINAL_INDEX.get(from)!;
  const target = TERMINAL_INDEX.get(SUPPLY_RAILS[rail])!;
  const previous = new Map<number, number>([[start, -1]]);
  const queue = [start];
  for (let head = 0; head < queue.length && !previous.has(target); head++) {
    const vertex = queue[head];
    for (const next of network.tree[vertex]) {
      if (previous.has(next)) continue;
      previous.set(next, vertex);
      queue.push(next);
    }
  }
  if (!previous.has(target)) return null;
  const support: number[] = [];
  for (let cursor = target; cursor !== start; cursor = previous.get(cursor)!) {
    if (cursor >= TERMINAL_IDS.length) {
      support.push(...network.blocks[cursor - TERMINAL_IDS.length]);
    }
  }
  return support;
}

/**
 * Explain a stable engine result using the same revision of wiring. Evidence
 * means possible closed supply and return paths, not measured current flow or
 * a claim that any one parallel branch caused the preceding state transition.
 */
export function traceLoad(
  wires: Wire[],
  result: SimulationResult,
  powered: boolean,
  loadId: string,
): LoadTrace {
  const entry = OBSERVABLE_LOADS.find((candidate) => candidate.deviceId === loadId);
  // A motor is one device with three windings; explain all of them together.
  const windings =
    entry?.kind === 'winding' ? MOTOR_WINDINGS : entry ? [entry] : ([] as typeof MOTOR_WINDINGS);
  const multiWinding = windings.length > 1;
  const ends: LoadTrace['ends'] = windings.flatMap((winding) =>
    [winding.from, winding.to].map((terminalId) => ({
      terminalId,
      potential: result.potential[terminalId] ?? 'floating',
    })),
  );
  const empty: LoadTrace = {
    loadId,
    multiWinding,
    status: 'unconnected',
    ends,
    wireIds: [],
    contactIds: [],
    terminalIds: [],
  };
  // Fault results contain the engine's stopped state, not the fault-time
  // contact graph. Never reconstruct a successful trace from that state.
  if (result.fault) return { ...empty, status: 'fault' };
  if (!powered) return { ...empty, status: 'unpowered' };
  if (!windings.length) return empty;

  const energized = (load: (typeof MOTOR_WINDINGS)[number]): boolean =>
    load.kind === 'winding'
      ? !!result.windings[load.from]
      : load.kind === 'coil'
        ? !!result.coils[loadId]
        : !!result.lamps[loadId];
  const active = windings.filter(energized);
  if (!active.length) {
    // Naming why a single-winding load is dead keeps the existing hints valid.
    const [from, to] = ends;
    if (windings.length === 1 && isRail(from.potential) && from.potential === to.potential)
      return { ...empty, status: 'same-rail' };
    return empty;
  }
  // Some but not all windings carry current: explain the live ones, but the
  // caller must still be able to say the motor as a whole is not running.
  const partial = multiWinding && active.length < windings.length;

  const network = conductorBlocks(wires, result);
  const wiresInTrace = new Set<string>();
  const contactsInTrace = new Set<string>();
  const terminalsInTrace = new Set<string>();
  for (const winding of active) {
    const fromRail = result.potential[winding.from] ?? 'floating';
    const toRail = result.potential[winding.to] ?? 'floating';
    const fromEdges = isRail(fromRail) ? supportEdges(network, winding.from, fromRail) : null;
    const toEdges = isRail(toRail) ? supportEdges(network, winding.to, toRail) : null;
    // A star point is floating, so one side of a Y winding may legitimately
    // have no rail path; the winding still counts as energized by the engine.
    if (fromEdges === null && toEdges === null) continue;
    terminalsInTrace.add(winding.from);
    terminalsInTrace.add(winding.to);
    for (const edgeId of new Set([...(fromEdges ?? []), ...(toEdges ?? [])])) {
      const edge = network.edges[edgeId];
      if (edge.wireId !== undefined) wiresInTrace.add(edge.wireId);
      if (edge.contactId !== undefined) contactsInTrace.add(edge.contactId);
      terminalsInTrace.add(TERMINAL_IDS[edge.from]);
      terminalsInTrace.add(TERMINAL_IDS[edge.to]);
    }
  }
  // No conductor evidence at all means this trace cannot explain the result;
  // reporting "energized" with an empty path would present a claim, not a path.
  if (!terminalsInTrace.size) return empty;
  return {
    ...empty,
    status: partial ? 'partial' : 'energized',
    wireIds: [...wiresInTrace].sort(),
    contactIds: [...contactsInTrace].sort(),
    terminalIds: [...terminalsInTrace].sort(),
  };
}
