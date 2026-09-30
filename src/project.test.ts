import { describe, expect, it } from 'vitest';
import { encodeProject, makeProject, parseProject } from './project';
import { PROJECT_LIMITS } from './limits';
import { TERMINAL_IDS } from './sim/model';
import type { Wire } from './sim/model';

const initialWire: Wire = {
  id: 'wire-1',
  from: 'POWER:L',
  to: 'SB1:NO3',
  color: '#e8a420',
  points: [
    { x: 80, y: 100 },
    { x: 80, y: 300 },
  ],
};

function fixture() {
  return { format: 'wirebench-2d', version: 1, name: '启停与自锁', wires: [{ ...initialWire }] };
}

function parseChangedWire(changes: Record<string, unknown>) {
  return parseProject(JSON.stringify({ ...fixture(), wires: [{ ...initialWire, ...changes }] }));
}

describe('接线文件', () => {
  it('保留中文名称、颜色与路径，支持完整往返和空白方案', () => {
    const project = makeProject('启停与自锁', [initialWire]);
    expect(parseProject(encodeProject(project.name, project.wires))).toEqual(project);
    expect(parseProject(encodeProject('新方案', [])).wires).toEqual([]);
    expect(parseChangedWire({ color: '#AbC', points: [] }).wires[0].color).toBe('#AbC');
    expect(encodeProject(project.name, project.wires)).toBe(JSON.stringify(project, null, 2));
  });

  it('最大编辑规模超出漂亮 JSON 上限时仍能紧凑保存并完整往返', () => {
    const pairs = TERMINAL_IDS.flatMap((from, index) =>
      TERMINAL_IDS.slice(index + 1).map((to) => ({ from, to })),
    ).slice(0, PROJECT_LIMITS.maxWires);
    const wires: Wire[] = pairs.map((pair, index) => ({
      ...pair,
      id: `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
      color: '#c65545',
      points: Array.from({ length: PROJECT_LIMITS.maxPoints }, (_, point) => ({
        x: PROJECT_LIMITS.minCoordinate + ((index + point * 5) % 995),
        y: PROJECT_LIMITS.minCoordinate + ((index + point * 10) % 995),
      })),
    }));
    const project = makeProject('最大规模接线实验', wires);
    const readable = JSON.stringify(project, null, 2);
    expect(wires).toHaveLength(500);
    expect(new TextEncoder().encode(readable).length).toBeGreaterThan(PROJECT_LIMITS.maxFileBytes);

    const encoded = encodeProject(project.name, project.wires);
    expect(new TextEncoder().encode(encoded).length).toBeLessThanOrEqual(
      PROJECT_LIMITS.maxFileBytes,
    );
    expect(parseProject(encoded)).toEqual(project);
  });

  it('复制导线与拐点，避免存档随编辑发生变动', () => {
    const source = [{ ...initialWire, points: [{ x: 2, y: 3 }] }];
    const project = makeProject('独立副本', source);
    source[0].points[0].x = 999;
    source[0].to = 'KM1:A1';
    expect(project.wires[0].points).toEqual([{ x: 2, y: 3 }]);
    expect(project.wires[0].to).toBe('SB1:NO3');
  });

  it('拒绝未知端子及自行闭合到同一端子的导线', () => {
    expect(() => parseChangedWire({ to: 'KM99:A1' })).toThrow(/未知端子/);
    expect(() => parseChangedWire({ to: initialWire.from })).toThrow(/同一个端子/);
  });

  it('区分重复编号和方向相反的重复连线', () => {
    expect(() =>
      parseProject(
        JSON.stringify({ ...fixture(), wires: [initialWire, { ...initialWire, to: 'KM1:A1' }] }),
      ),
    ).toThrow(/编号重复/);
    expect(() =>
      parseProject(
        JSON.stringify({
          ...fixture(),
          wires: [
            initialWire,
            { ...initialWire, id: 'wire-2', from: initialWire.to, to: initialWire.from },
          ],
        }),
      ),
    ).toThrow(/同一对端子/);
  });

  it.each(['red', '#12', '#abcd', '#ff0000;url(test)', 'url(javascript:test)', ' #fff'])(
    '拒绝非法颜色 %s',
    (color) => {
      expect(() => parseChangedWire({ color })).toThrow(/颜色/);
    },
  );

  it('拒绝不支持的格式和版本、缺失名称以及不正确的列表', () => {
    for (const version of [0, 2, '1', null]) {
      expect(() => parseProject(JSON.stringify({ ...fixture(), version }))).toThrow(/版本/);
    }
    expect(() => parseProject(JSON.stringify({ ...fixture(), format: 'other' }))).toThrow(
      /不是 WireBench/,
    );
    expect(() => parseProject(JSON.stringify({ ...fixture(), name: '  ' }))).toThrow(/方案名称/);
    expect(() => parseProject(JSON.stringify({ ...fixture(), name: '甲'.repeat(101) }))).toThrow(
      /方案名称/,
    );
    expect(() => parseProject(JSON.stringify({ ...fixture(), wires: {} }))).toThrow(/导线列表/);
    expect(() => parseProject('null')).toThrow(/格式/);
    expect(() => parseProject('{')).toThrow(/JSON/);
  });

  it('拒绝原型污染字段与未约定字段，不将外部对象合并进状态', () => {
    const json = JSON.stringify(fixture());
    expect(() => parseProject(json.replace('{', '{"__proto__":{"polluted":true},'))).toThrow(
      /不支持的字段/,
    );
    expect(() => parseChangedWire({ constructor: { prototype: { polluted: true } } })).toThrow(
      /不支持的字段/,
    );
    expect(() => parseChangedWire({ points: [{ x: 1, y: 2, prototype: {} }] })).toThrow(
      /不支持的字段/,
    );
    expect(() =>
      makeProject('测试', [Object.assign(Object.create({ polluted: true }), initialWire)]),
    ).toThrow(/格式/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('按 UTF-8 字节限制 2 MB，限制最多 500 根导线', () => {
    expect(() => parseProject(' '.repeat(2 * 1024 * 1024 + 1))).toThrow(/2 MB/);
    expect(() => parseProject('中'.repeat(800000))).toThrow(/2 MB/);
    expect(() =>
      parseProject(JSON.stringify({ ...fixture(), wires: Array(501).fill(initialWire) })),
    ).toThrow(/500 根/);
  });

  it('接收边界坐标，拒绝越界或过多的路径拐点', () => {
    expect(parseChangedWire({ points: [{ x: -3000, y: 6000 }] }).wires[0].points).toEqual([
      { x: -3000, y: 6000 },
    ]);
    expect(() => parseChangedWire({ points: [{ x: 6001, y: 10 }] })).toThrow(/坐标/);
    expect(() => parseChangedWire({ points: [{ x: 10, y: -3001 }] })).toThrow(/坐标/);
    expect(() => parseChangedWire({ points: [{ x: '10', y: 10 }] })).toThrow(/坐标/);
    expect(() => parseChangedWire({ points: null })).toThrow(/拐点/);
    expect(() => parseChangedWire({ points: Array(65).fill({ x: 0, y: 0 }) })).toThrow(/64 个/);
  });

  it('在 JSON 数字溢出以及直接存档中拒绝无穷大和 NaN', () => {
    const overflow = JSON.stringify(fixture()).replace('"x":80', '"x":1e400');
    expect(() => parseProject(overflow)).toThrow(/有限数值/);
    for (const x of [NaN, Infinity, -Infinity]) {
      expect(() => makeProject('测试', [{ ...initialWire, points: [{ x, y: 0 }] }])).toThrow(
        /有限数值/,
      );
    }
  });
});
