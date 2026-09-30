import { describe, expect, it } from 'vitest';
import { parseProject, ProjectValidationError } from '../project';
import { simulate } from '../sim/engine';
import type { Wire } from '../sim/model';
import { readStoredProject, saveStoredProject, type ProjectStorage } from '../storage';
import { en } from './messages.en';
import { zh } from './messages.zh';
import { localizeFault, localizeProjectError, localizeStorageError } from './messages';

const wires = (...pairs: [string, string][]): Wire[] =>
  pairs.map(([from, to], index) => ({ id: `w${index}`, from, to, color: '#fff' }));

function validationError(value: unknown): ProjectValidationError {
  try {
    parseProject(JSON.stringify(value));
  } catch (error) {
    if (error instanceof ProjectValidationError) return error;
    throw error;
  }
  throw new Error('The fixture must fail validation.');
}

describe('localized domain messages', () => {
  it('keeps translated parameter placeholders aligned in every message', () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const code of Object.keys(zh) as (keyof typeof zh)[]) {
      expect(placeholders(en[code]), code).toEqual(placeholders(zh[code]));
      expect(en[code], code).not.toMatch(/[\u3400-\u9fff]/);
    }
  });

  it.each([
    ['message.fault.short', wires(['POWER:L', 'POWER:N'])],
    ['message.fault.series', wires(['POWER:L', 'HL1:1'], ['HL1:2', 'HL2:1'], ['HL2:2', 'POWER:N'])],
    [
      'message.fault.unstable',
      wires(['POWER:L', 'KM1:61'], ['KM1:62', 'KM1:A1'], ['KM1:A2', 'POWER:N']),
    ],
    ['message.fault.reserved', wires(['POWER:U2', 'KM1:L1'])],
    ['message.fault.unknown-terminal', wires(['POWER:L', 'MISSING:1'])],
  ])('formats %s in either language without changing the electrical result', (code, circuit) => {
    const result = simulate(circuit, {}, true);
    const fault = result.fault!;
    const original = JSON.stringify(result);
    expect(fault.descriptor.code).toBe(code);
    expect(localizeFault(fault, 'zh-CN')).toBe(fault.message);
    expect(localizeFault(fault, 'en')).not.toMatch(/[\u3400-\u9fff]|\{\w+\}/);
    expect(JSON.stringify(result)).toBe(original);
  });

  it('translates nested validation subjects and retains wire indexes', () => {
    const error = validationError({
      format: 'wirebench-2d',
      version: 1,
      name: '示例',
      wires: [{ ...wires(['POWER:L', 'HL1:1'])[0], points: [{ x: 1, y: 2, extra: true }] }],
    });
    expect(error.message).toBe('第 1 根导线的拐点包含不支持的字段。');
    expect(localizeProjectError(error, 'en')).toBe(
      'A bend point of Wire 1 contains unsupported fields.',
    );
    expect(localizeProjectError(error, 'zh-CN')).toBe(error.message);
  });

  it('keeps interpolation limits and invalid field names understandable in English', () => {
    const error = validationError({ format: 'wirebench-2d', version: 1, name: '', wires: [] });
    expect(localizeProjectError(error, 'en')).toBe(
      'The project name must contain between 1 and 100 valid text characters.',
    );
  });

  it('translates a protected stored project including its nested version error', () => {
    const storage: ProjectStorage = {
      getItem: () => '{"format":"wirebench-2d","version":2,"name":"示例","wires":[]}',
      setItem: () => {
        throw new Error('Must not overwrite the protected project.');
      },
    };
    const result = readStoredProject(storage);
    expect(result.error).toContain('原始存档已保留');
    const english = localizeStorageError(result, 'en');
    expect(english).toContain('version is not supported');
    expect(english).toContain('original data has been preserved');
    expect(english).not.toMatch(/[\u3400-\u9fff]/);
    expect(localizeStorageError(saveStoredProject('Current', [], storage), 'en')).toBe(english);
  });

  it.each([
    ['SecurityError', 'blocked access'],
    ['QuotaExceededError', 'insufficient local storage'],
  ])('translates known browser error %s', (name, expected) => {
    const unavailable = () => {
      throw new DOMException('Browser detail', name);
    };
    const result = saveStoredProject('Current', [], unavailable);
    expect(localizeStorageError(result, 'en')).toContain(expected);
    expect(localizeStorageError(result, 'en')).not.toMatch(/[\u3400-\u9fff]/);
    expect(localizeStorageError(result, 'zh-CN')).toBe(result.error);
  });

  it('retains external diagnostic text and provides a translated unknown-error fallback', () => {
    expect(localizeProjectError(new Error('External diagnostic'), 'en')).toBe(
      'External diagnostic',
    );
    expect(localizeProjectError(null, 'en')).toBe(
      'The operation failed without a specific error reason.',
    );
    expect(localizeStorageError({ error: '' }, 'en')).toBe('');
  });
});
