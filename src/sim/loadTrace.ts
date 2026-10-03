import type { Potential, SimulationResult } from './engine';
import { CONTACTS, LOADS, TERMINAL_IDS, type Wire } from './model';

export interface LoadTrace {
  /** The selected load's device ID, as defined by LOADS. */
  loadId: string;
  status: 'energized' | 'unpowered' | 'fault' | 'unconnected' | 'same-rail';
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

function supportEdges(network: ConductorBlocks, from: string, rail: 'L' | 'N'): number[] | null {
  const start = TERMINAL_INDEX.get(from)!;
  const target = TERMINAL_INDEX.get(`POWER:${rail}`)!;
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
  const load = LOADS.find((candidate) => candidate.deviceId === loadId);
  const ends: LoadTrace['ends'] = load
    ? [load.from, load.to].map((terminalId) => ({
        terminalId,
        potential: result.potential[terminalId] ?? 'floating',
      }))
    : [];
  const empty: LoadTrace = {
    loadId,
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
  if (!load) return empty;
  const [from, to] = ends;
  if (from.potential !== 'floating' && from.potential === to.potential) {
    return { ...empty, status: 'same-rail' };
  }
  const active = load.kind === 'coil' ? result.coils[loadId] : result.lamps[loadId];
  if (!active || from.potential === 'floating' || to.potential === 'floating') return empty;

  const network = conductorBlocks(wires, result);
  const fromEdges = supportEdges(network, load.from, from.potential);
  const toEdges = supportEdges(network, load.to, to.potential);
  // A mismatched result/wiring pair must not display a successful explanation.
  if (fromEdges === null || toEdges === null) return empty;
  const wiresInTrace = new Set<string>();
  const contactsInTrace = new Set<string>();
  const terminalsInTrace = new Set<string>([load.from, load.to]);
  for (const edgeId of new Set([...fromEdges, ...toEdges])) {
    const edge = network.edges[edgeId];
    if (edge.wireId !== undefined) wiresInTrace.add(edge.wireId);
    if (edge.contactId !== undefined) contactsInTrace.add(edge.contactId);
    terminalsInTrace.add(TERMINAL_IDS[edge.from]);
    terminalsInTrace.add(TERMINAL_IDS[edge.to]);
  }
  return {
    ...empty,
    status: 'energized',
    wireIds: [...wiresInTrace].sort(),
    contactIds: [...contactsInTrace].sort(),
    terminalIds: [...terminalsInTrace].sort(),
  };
}
