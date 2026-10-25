import { MOTOR_WINDINGS } from './model';
import type { MotorWinding, Phase, Rail } from './model';
import { relateRails } from './supply';

export type MotorMode = 'star' | 'delta' | 'four-wire-star';

export type MotorProblem =
  | 'ok'
  | 'missing-phase'
  | 'same-phase'
  | 'open-winding'
  | 'no-pattern'
  | 'undefined-supply'
  | 'undefined-star-rail';

export interface MotorEnd {
  node: number;
  rail: Rail | null;
}

export interface MotorEvaluation {
  mode: MotorMode | null;
  running: boolean;
  /** Keyed by stable winding IDs such as MOTOR:U, not terminal order. */
  windings: Record<string, boolean>;
  phases: Phase[];
  problem: MotorProblem;
  starRail: Rail | null;
  starTerminals: string[];
}

export interface MotorAccess {
  end: (terminal: string) => MotorEnd;
}

interface WindingEnds {
  winding: MotorWinding;
  a: MotorEnd;
  b: MotorEnd;
  phaseA: Phase | null;
  phaseB: Phase | null;
}

const phaseOf = (end: MotorEnd): Phase | null =>
  end.rail === 'U' || end.rail === 'V' || end.rail === 'W' ? end.rail : null;

function windingStates(
  windings: WindingEnds[],
  starNode: number | null,
  starRail: Rail | null,
): Record<string, boolean> {
  const phaseAtStar = new Set(
    windings.flatMap((entry) => {
      if (starNode === null) return [];
      if (entry.a.node === starNode && entry.phaseB) return [entry.phaseB];
      if (entry.b.node === starNode && entry.phaseA) return [entry.phaseA];
      return [];
    }),
  );
  return Object.fromEntries(
    windings.map(({ winding, a, b, phaseA, phaseB }) => {
      let supplied = false;
      if (phaseA && phaseB) supplied = phaseA !== phaseB;
      else if (starNode !== null && (a.node === starNode || b.node === starNode)) {
        const other = a.node === starNode ? b : a;
        if (starRail !== null) {
          supplied = !!other.rail && relateRails(starRail, other.rail).kind === 'defined';
        } else {
          const ownPhase = phaseA ?? phaseB;
          supplied = !!ownPhase && [...phaseAtStar].some((phase) => phase !== ownPhase);
        }
      }
      return [winding.id, supplied];
    }),
  );
}

function finish(
  windings: WindingEnds[],
  phases: Phase[],
  mode: MotorMode | null,
  problem: MotorProblem,
  starNode: number | null = null,
  starRail: Rail | null = null,
  starTerminals: string[] = [],
): MotorEvaluation {
  const suppliedWindings = windingStates(windings, starNode, starRail);
  return {
    mode,
    running:
      mode !== null &&
      problem === 'ok' &&
      phases.length === 3 &&
      Object.values(suppliedWindings).every(Boolean),
    windings: suppliedWindings,
    phases,
    problem,
    starRail,
    starTerminals,
  };
}

/** Match a motor's unordered winding ends against Y and delta terminal patterns. */
export function evaluateMotor(access: MotorAccess): MotorEvaluation {
  const windings = MOTOR_WINDINGS.map((winding): WindingEnds => {
    const a = access.end(winding.from);
    const b = access.end(winding.to);
    return { winding, a, b, phaseA: phaseOf(a), phaseB: phaseOf(b) };
  });
  const phases = [
    ...new Set(
      windings
        .flatMap(({ phaseA, phaseB }) => [phaseA, phaseB])
        .filter((phase): phase is Phase => phase !== null),
    ),
  ];

  // A Y point is the one conductor node shared by all three winding ends; in
  // delta, each phase node is shared by only two windings.
  const windingAtNode = new Map<number, Set<string>>();
  for (const { winding, a, b } of windings) {
    for (const node of new Set([a.node, b.node])) {
      const owners = windingAtNode.get(node) ?? new Set<string>();
      owners.add(winding.id);
      windingAtNode.set(node, owners);
    }
  }
  const commonNodes = [...windingAtNode].filter(([, owners]) => owners.size === windings.length);
  // Prefer an unreferenced common node. A same-phase fan-in can also put all
  // outer winding ends on one rail node; that rail is not the motor's star.
  const starNode =
    commonNodes.find(([node]) =>
      windings.some(({ a, b }) => (a.node === node ? a : b).rail === null),
    )?.[0] ??
    commonNodes.find(([node]) => {
      const outerPhases = windings.flatMap(({ a, b }) => {
        const other = a.node === node ? b : a;
        const phase = phaseOf(other);
        return phase ? [phase] : [];
      });
      return new Set(outerPhases).size >= 2;
    })?.[0];
  const starEnds =
    starNode === undefined
      ? []
      : windings.map((entry) => {
          const aIsStar = entry.a.node === starNode;
          return {
            entry,
            starEnd: aIsStar ? entry.a : entry.b,
            other: aIsStar ? entry.b : entry.a,
          };
        });
  const validStarNode =
    starNode !== undefined && starEnds.every(({ entry }) => entry.a.node !== entry.b.node);

  if (validStarNode && starNode !== undefined) {
    const starRail = starEnds[0].starEnd.rail;
    const starTerminals = starEnds.flatMap(({ entry }) => [
      ...(entry.a.node === starNode ? [entry.winding.from] : []),
      ...(entry.b.node === starNode ? [entry.winding.to] : []),
    ]);
    if (starRail !== null) {
      const hasUndefinedSupply = starEnds.some(
        ({ other }) =>
          other.rail !== null && relateRails(starRail, other.rail).kind === 'undefined',
      );
      if (hasUndefinedSupply) {
        return finish(
          windings,
          phases,
          'four-wire-star',
          'undefined-star-rail',
          starNode,
          starRail,
          starTerminals,
        );
      }
      const outerPhases = starEnds.map(({ other }) => phaseOf(other));
      const distinctOuterPhases = new Set(
        outerPhases.filter((phase): phase is Phase => phase !== null),
      );
      const hasThreeDefinedLegs =
        outerPhases.every((phase) => phase !== null) &&
        distinctOuterPhases.size === 3 &&
        starEnds.every(
          ({ other }) =>
            other.rail !== null && relateRails(starRail, other.rail).kind === 'defined',
        );
      const problem: MotorProblem = hasThreeDefinedLegs ? 'ok' : 'no-pattern';
      return finish(windings, phases, 'four-wire-star', problem, starNode, starRail, starTerminals);
    }

    const outerPhases = starEnds.map(({ other }) => phaseOf(other));
    const distinctOuterPhases = new Set(
      outerPhases.filter((phase): phase is Phase => phase !== null),
    );
    const problem: MotorProblem = outerPhases.some((phase) => phase === null)
      ? 'missing-phase'
      : distinctOuterPhases.size === 1
        ? 'same-phase'
        : distinctOuterPhases.size < 3
          ? 'missing-phase'
          : 'ok';
    return finish(windings, phases, 'star', problem, starNode, null, starTerminals);
  }

  const hasUndefinedSupply = windings.some(
    ({ a, b }) =>
      a.rail !== null && b.rail !== null && relateRails(a.rail, b.rail).kind === 'undefined',
  );
  if (hasUndefinedSupply) return finish(windings, phases, null, 'undefined-supply');

  const pairs = windings.map(({ phaseA, phaseB }) => ({ phaseA, phaseB }));
  const deltaWinding = pairs.filter(({ phaseA, phaseB }) => phaseA !== null && phaseB !== null);
  if (deltaWinding.length === 3) {
    const keys = deltaWinding.map(({ phaseA, phaseB }) => [phaseA, phaseB].sort().join('-'));
    const deltaLoop =
      new Set(keys).size === 3 &&
      phases.length === 3 &&
      phases.every((phase) => keys.filter((pair) => pair.includes(phase)).length === 2);
    const problem: MotorProblem = deltaLoop
      ? 'ok'
      : phases.length === 1
        ? 'same-phase'
        : 'no-pattern';
    return finish(windings, phases, 'delta', problem);
  }

  const openWinding = windings.some(
    ({ phaseA, phaseB, a, b }) => phaseA === null && phaseB === null && !a.rail && !b.rail,
  );
  return finish(
    windings,
    phases,
    null,
    phases.length === 1 ? 'same-phase' : openWinding ? 'open-winding' : 'no-pattern',
  );
}
