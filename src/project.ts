import { PROJECT_LIMITS } from './limits';
import { TERMINAL_IDS, type Wire } from './sim/model';
import { formatMessage, type MessageDescriptor } from './i18n/messages';

export class ProjectValidationError extends Error {
  readonly descriptor: MessageDescriptor;

  constructor(descriptor: MessageDescriptor) {
    // Preserve the legacy Chinese Error.message while allowing the UI to
    // format the same failure in its current language without reparsing data.
    super(formatMessage(descriptor, 'zh-CN'));
    this.name = 'ProjectValidationError';
    this.descriptor = descriptor;
  }
}

export interface ProjectFile {
  format: 'wirebench-2d';
  version: 1;
  name: string;
  wires: Wire[];
}

const MAX_FILE_BYTES = PROJECT_LIMITS.maxFileBytes;
const MAX_WIRES = PROJECT_LIMITS.maxWires;
const TERMINALS = new Set(TERMINAL_IDS);
const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function object(value: unknown, subject: MessageDescriptor): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new ProjectValidationError({
      code: 'message.project.invalid-object',
      params: { subject },
    });
  }
  return value as Record<string, unknown>;
}

function allowedKeys(value: Record<string, unknown>, keys: string[], subject: MessageDescriptor) {
  if (Object.keys(value).some((key) => !keys.includes(key))) {
    throw new ProjectValidationError({
      code: 'message.project.unsupported-field',
      params: { subject },
    });
  }
}

function boundedString(value: unknown, max: number, subject: MessageDescriptor): string {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > max ||
    CONTROL_CHARACTERS.test(value)
  ) {
    throw new ProjectValidationError({
      code: 'message.project.invalid-string',
      params: { subject, max },
    });
  }
  return value;
}

/** Rebuild a clean project rather than merging untrusted JSON into application state. */
function validateProject(input: unknown): ProjectFile {
  const fileSubject: MessageDescriptor = { code: 'message.subject.file' };
  const data = object(input, fileSubject);
  allowedKeys(data, ['format', 'version', 'name', 'wires'], fileSubject);
  if (data.format !== 'wirebench-2d')
    throw new ProjectValidationError({ code: 'message.project.format' });
  if (data.version !== 1) throw new ProjectValidationError({ code: 'message.project.version' });
  const name = boundedString(data.name, 100, { code: 'message.subject.name' });
  if (!Array.isArray(data.wires))
    throw new ProjectValidationError({ code: 'message.project.wires' });
  if (data.wires.length > MAX_WIRES)
    throw new ProjectValidationError({
      code: 'message.project.wire-limit',
      params: { max: MAX_WIRES },
    });

  const ids = new Set<string>();
  const pairs = new Set<string>();
  const wires = data.wires.map((entry: unknown, index): Wire => {
    const subject: MessageDescriptor = {
      code: 'message.subject.wire',
      params: { index: index + 1 },
    };
    const wire = object(entry, subject);
    allowedKeys(wire, ['id', 'from', 'to', 'color', 'points'], subject);
    const id = boundedString(wire.id, 128, {
      code: 'message.subject.wire-id',
      params: { wire: subject },
    });
    if (ids.has(id))
      throw new ProjectValidationError({
        code: 'message.project.duplicate-id',
        params: { subject },
      });
    ids.add(id);
    if (
      typeof wire.from !== 'string' ||
      !TERMINALS.has(wire.from) ||
      typeof wire.to !== 'string' ||
      !TERMINALS.has(wire.to)
    ) {
      throw new ProjectValidationError({
        code: 'message.project.unknown-terminal',
        params: { subject },
      });
    }
    const { from, to } = wire;
    if (from === to)
      throw new ProjectValidationError({
        code: 'message.project.same-terminal',
        params: { subject },
      });
    const pair = JSON.stringify([from, to].sort());
    if (pairs.has(pair))
      throw new ProjectValidationError({
        code: 'message.project.duplicate-wire',
        params: { subject },
      });
    pairs.add(pair);
    if (typeof wire.color !== 'string' || !COLOR.test(wire.color)) {
      throw new ProjectValidationError({ code: 'message.project.color', params: { subject } });
    }
    const result: Wire = { id, from, to, color: wire.color };
    if (Object.prototype.hasOwnProperty.call(wire, 'points')) {
      if (!Array.isArray(wire.points) || wire.points.length > PROJECT_LIMITS.maxPoints) {
        throw new ProjectValidationError({
          code: 'message.project.points',
          params: { subject, max: PROJECT_LIMITS.maxPoints },
        });
      }
      result.points = wire.points.map((entry: unknown) => {
        const pointSubject: MessageDescriptor = {
          code: 'message.subject.point',
          params: { wire: subject },
        };
        const point = object(entry, pointSubject);
        allowedKeys(point, ['x', 'y'], pointSubject);
        if (
          typeof point.x !== 'number' ||
          typeof point.y !== 'number' ||
          !Number.isFinite(point.x) ||
          !Number.isFinite(point.y) ||
          point.x < PROJECT_LIMITS.minCoordinate ||
          point.x > PROJECT_LIMITS.maxCoordinate ||
          point.y < PROJECT_LIMITS.minCoordinate ||
          point.y > PROJECT_LIMITS.maxCoordinate
        ) {
          throw new ProjectValidationError({
            code: 'message.project.coordinates',
            params: {
              subject,
              min: PROJECT_LIMITS.minCoordinate,
              max: PROJECT_LIMITS.maxCoordinate,
            },
          });
        }
        return { x: point.x, y: point.y };
      });
    }
    return result;
  });
  return { format: 'wirebench-2d', version: 1, name, wires };
}

function fitsTextSize(text: string): boolean {
  return text.length <= MAX_FILE_BYTES && new TextEncoder().encode(text).length <= MAX_FILE_BYTES;
}

function checkTextSize(text: string) {
  if (!fitsTextSize(text)) {
    throw new ProjectValidationError({
      code: 'message.project.text-size',
      params: { max: MAX_FILE_BYTES / (1024 * 1024) },
    });
  }
}

export function parseProject(text: string): ProjectFile {
  if (typeof text !== 'string') throw new ProjectValidationError({ code: 'message.project.text' });
  checkTextSize(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ProjectValidationError({ code: 'message.project.json' });
  }
  return validateProject(parsed);
}

export function makeProject(name: string, wires: Wire[]): ProjectFile {
  return validateProject({ format: 'wirebench-2d', version: 1, name, wires });
}

export function encodeProject(name: string, wires: Wire[]): string {
  const project = makeProject(name, wires);
  const readable = JSON.stringify(project, null, 2);
  if (fitsTextSize(readable)) return readable;

  // Formatting must not prevent a valid full-size editor document from saving.
  const compact = JSON.stringify(project);
  checkTextSize(compact);
  return compact;
}
