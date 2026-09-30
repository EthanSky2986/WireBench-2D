import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProjectAutosave } from './autosave';
import { PROJECT_STORAGE_KEY, readStoredProject, saveStoredProject } from './storage';
import type { ProjectSaveResult, ProjectStorage } from './storage';

function setup() {
  const values = new Map<string, string>();
  const storage: ProjectStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
  const results: ProjectSaveResult[] = [];
  const autosave = createProjectAutosave(
    (result) => results.push(result),
    (name, wires) => saveStoredProject(name, wires, storage),
  );
  return { autosave, storage, values, results };
}

afterEach(() => vi.useRealTimers());

describe('pending autonomous project saves', () => {
  it('debounces consecutive edits and persists only the latest draft', () => {
    vi.useFakeTimers();
    const { autosave, storage, results } = setup();
    autosave.schedule({ name: 'Initial', wires: [] });
    vi.advanceTimersByTime(400);
    autosave.schedule({
      name: 'Latest',
      wires: [{ id: 'wire-1', from: 'POWER:L', to: 'HL1:1', color: '#ff0000' }],
    });
    vi.advanceTimersByTime(499);
    expect(readStoredProject(storage).project).toBeNull();
    vi.advanceTimersByTime(1);
    expect(readStoredProject(storage).project?.name).toBe('Latest');
    expect(readStoredProject(storage).project?.wires).toHaveLength(1);
    expect(results).toHaveLength(1);
  });

  it('flushes before refresh and avoids duplicate writes on subsequent hide events', () => {
    vi.useFakeTimers();
    const { autosave, storage, results } = setup();
    autosave.schedule({ name: 'Just edited', wires: [] });
    vi.advanceTimersByTime(50);
    autosave.flush();
    expect(readStoredProject(storage).project?.name).toBe('Just edited');
    autosave.flush();
    vi.runAllTimers();
    expect(results).toHaveLength(1);
  });

  it('cancels on cleanup without writes or callbacks after disposal', () => {
    vi.useFakeTimers();
    const { autosave, storage, results } = setup();
    autosave.schedule({ name: 'Unmounted', wires: [] });
    autosave.dispose();
    autosave.flush();
    autosave.schedule({ name: 'Too late', wires: [] });
    vi.runAllTimers();
    expect(readStoredProject(storage).project).toBeNull();
    expect(results).toHaveLength(0);
  });

  it('preserves protected stored content when a pending edit flushes', () => {
    vi.useFakeTimers();
    const { autosave, values, results } = setup();
    values.set(PROJECT_STORAGE_KEY, '{ damaged original');
    autosave.schedule({ name: 'Current draft', wires: [] });
    autosave.flush();
    expect(values.get(PROJECT_STORAGE_KEY)).toBe('{ damaged original');
    expect(results).toMatchObject([{ ok: false, problem: 'protected' }]);
  });
});
