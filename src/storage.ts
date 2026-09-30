import { encodeProject, parseProject, type ProjectFile } from './project';
import type { Wire } from './sim/model';
import { formatMessage, getMessageDescriptor, type MessageDescriptor } from './i18n/messages';

export const PROJECT_STORAGE_KEY = 'wirebench-2d.project.v1';

/** A small adapter also supports tests without a browser or global storage. */
export interface ProjectStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type StorageAccess = ProjectStorage | (() => ProjectStorage);
export type StorageProblem = 'protected' | 'unavailable' | 'invalid' | 'write-failed';

export interface StoredProject {
  project: ProjectFile | null;
  error: string;
  problem: StorageProblem | null;
  descriptor?: MessageDescriptor;
}

export type ProjectSaveResult =
  | { ok: true; error: ''; problem: null; descriptor?: undefined }
  | { ok: false; error: string; problem: StorageProblem; descriptor?: MessageDescriptor };

// Access itself may throw when the browser disallows localStorage.
const browserStorage = () => globalThis.localStorage;
const resolveStorage = (access: StorageAccess) =>
  typeof access === 'function' ? access() : access;

function reason(error: unknown): MessageDescriptor {
  const described = getMessageDescriptor(error);
  if (described) return described;
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError') return { code: 'message.storage.quota' };
    if (error.name === 'SecurityError') return { code: 'message.storage.security' };
    return { code: 'message.storage.raw-reason', params: { text: error.message || error.name } };
  }
  return typeof error === 'string'
    ? { code: 'message.storage.raw-reason', params: { text: error } }
    : { code: 'message.storage.unknown-reason' };
}

function errorDetails(descriptor: MessageDescriptor): {
  error: string;
  descriptor: MessageDescriptor;
} {
  return { error: formatMessage(descriptor, 'zh-CN'), descriptor };
}

/** Read-only: invalid or newer files remain verbatim under the original key. */
export function readStoredProject(access: StorageAccess = browserStorage): StoredProject {
  let text: string | null;
  try {
    text = resolveStorage(access).getItem(PROJECT_STORAGE_KEY);
  } catch (error) {
    return {
      project: null,
      problem: 'unavailable',
      ...errorDetails({ code: 'message.storage.read-failed', params: { reason: reason(error) } }),
    };
  }
  if (text === null) return { project: null, error: '', problem: null };
  try {
    return { project: parseProject(text), error: '', problem: null };
  } catch (error) {
    return {
      project: null,
      problem: 'protected',
      ...errorDetails({ code: 'message.storage.protected', params: { reason: reason(error) } }),
    };
  }
}

/**
 * Both manual and automatic saves use the same guard. Re-read before writing
 * so a file replaced by another tab after startup is protected as well.
 */
export function saveStoredProject(
  name: string,
  wires: Wire[],
  access: StorageAccess = browserStorage,
): ProjectSaveResult {
  let encoded: string;
  try {
    encoded = encodeProject(name, wires);
  } catch (error) {
    return {
      ok: false,
      problem: 'invalid',
      ...errorDetails({ code: 'message.storage.invalid', params: { reason: reason(error) } }),
    };
  }

  let storage: ProjectStorage;
  try {
    storage = resolveStorage(access);
  } catch (error) {
    return {
      ok: false,
      problem: 'unavailable',
      ...errorDetails({ code: 'message.storage.unavailable', params: { reason: reason(error) } }),
    };
  }
  const current = readStoredProject(storage);
  if (current.problem)
    return {
      ok: false,
      problem: current.problem,
      error: current.error,
      descriptor: current.descriptor,
    };
  try {
    storage.setItem(PROJECT_STORAGE_KEY, encoded);
    return { ok: true, error: '', problem: null };
  } catch (error) {
    return {
      ok: false,
      problem: 'write-failed',
      ...errorDetails({ code: 'message.storage.write-failed', params: { reason: reason(error) } }),
    };
  }
}
