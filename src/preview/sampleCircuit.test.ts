import { describe, expect, it } from 'vitest';
import { simulate } from '../sim/engine';
import { SAMPLE_WIRES } from './sampleCircuit';

describe('material sample circuit', () => {
  it('starts through SB2, holds on release, and releases on power off', () => {
    const ready = simulate(SAMPLE_WIRES, {}, true);
    expect(ready.coils.KM1).toBe(false);
    expect(ready.lamps.HL1).toBe(false);
    const started = simulate(SAMPLE_WIRES, { SB2: true }, true);
    const held = simulate(SAMPLE_WIRES, {}, true, started.coils);
    expect(held.fault).toBeNull();
    expect(held.coils.KM1).toBe(true);
    expect([held.lamps.HL1, held.lamps.HL2, held.lamps.HL3]).toEqual([true, true, true]);
    const off = simulate(SAMPLE_WIRES, {}, false, held.coils);
    expect(off.coils.KM1).toBe(false);
    expect([off.lamps.HL1, off.lamps.HL2, off.lamps.HL3]).toEqual([false, false, false]);
  });

  it('removing the lamp feed extinguishes the lamps without breaking the holding coil', () => {
    const changed = SAMPLE_WIRES.filter((wire) => wire.id !== 'lamp-feed');
    const started = simulate(changed, { SB2: true }, true);
    const held = simulate(changed, {}, true, started.coils);
    expect(held.fault).toBeNull();
    expect(held.coils.KM1).toBe(true);
    expect([held.lamps.HL1, held.lamps.HL2, held.lamps.HL3]).toEqual([false, false, false]);
  });
});
