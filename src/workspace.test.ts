import { describe, expect, it } from 'vitest';
import type { Wire } from './sim/model';
import { createWorkspaceState, currentWorkspace, workspaceReducer } from './workspace';

function wires(id: string): Wire[] {
  return [{ id, from: 'POWER:L', to: 'KM1:A1', color: '#e35a64', points: [{ x: 20, y: 40 }] }];
}

describe('自主接线与示例工作区', () => {
  it('编辑、改名、撤销、重做和切换示例后，退出完整恢复自主稿及其撤销重做栈', () => {
    let state = createWorkspaceState('我的自主接线', wires('initial'));
    state = workspaceReducer(state, { type: 'commit', wires: wires('first-edit') });
    state = workspaceReducer(state, { type: 'commit', wires: wires('second-edit') });
    state = workspaceReducer(state, { type: 'undo' });
    const workbench = state.workbench;
    const snapshot = JSON.parse(JSON.stringify(workbench));

    state = workspaceReducer(state, {
      type: 'enter-example',
      id: 'jog',
      name: '接触器点动',
      wires: wires('example'),
    });
    state = workspaceReducer(state, { type: 'set-name', name: '示例练习修改' });
    state = workspaceReducer(state, { type: 'commit', wires: wires('example-edit') });
    state = workspaceReducer(state, { type: 'undo' });
    expect(currentWorkspace(state).history.present[0].id).toBe('example');
    state = workspaceReducer(state, { type: 'redo' });
    expect(currentWorkspace(state).history.present[0].id).toBe('example-edit');
    expect(currentWorkspace(state).name).toBe('示例练习修改');
    expect(state.workbench).toBe(workbench);

    state = workspaceReducer(state, {
      type: 'enter-example',
      id: 'hold',
      name: '自锁',
      wires: wires('holding'),
    });
    expect(state.example?.id).toBe('hold');
    expect(currentWorkspace(state)).toEqual({
      name: '自锁',
      history: { past: [], present: wires('holding'), future: [] },
    });
    expect(state.workbench).toBe(workbench);

    state = workspaceReducer(state, { type: 'exit-example' });
    expect(currentWorkspace(state)).toBe(workbench);
    expect(state.workbench).toEqual(snapshot);
    expect(state.example).toBeNull();
    state = workspaceReducer(state, { type: 'redo' });
    expect(currentWorkspace(state).history.present[0].id).toBe('second-edit');
    expect(currentWorkspace(state).name).toBe('我的自主接线');
  });

  it('创建、载入示例和提交时复制端点路径，不与调用方或示例源共享可变对象', () => {
    const original = wires('original');
    let state = createWorkspaceState('原稿', original);
    original[0].points![0].x = 999;
    original[0].color = '#000';
    expect(state.workbench.history.present).toEqual(wires('original'));
    const workbench = state.workbench;

    const example = wires('example');
    state = workspaceReducer(state, {
      type: 'enter-example',
      id: 'one',
      name: '示例',
      wires: example,
    });
    const edit = wires('edited');
    state = workspaceReducer(state, { type: 'commit', wires: edit });
    edit[0].points![0].y = 999;
    example[0].points![0].x = -999;
    expect(currentWorkspace(state).history.present).toEqual(wires('edited'));
    expect(currentWorkspace(state).history.past[0]).toEqual(wires('example'));
    expect(state.workbench).toBe(workbench);
  });

  it('示例模式下导入项目会退出示例，并保留自主稿而非示例作为可撤销的前一版', () => {
    let state = createWorkspaceState('自主稿', wires('draft'));
    state = workspaceReducer(state, {
      type: 'enter-example',
      id: 'one',
      name: '示例',
      wires: wires('sample'),
    });
    const imported = wires('imported');
    state = workspaceReducer(state, {
      type: 'replace-project',
      name: '导入的方案',
      wires: imported,
    });
    imported[0].points![0].x = 999;
    expect(state.example).toBeNull();
    expect(state.workbench.name).toBe('导入的方案');
    expect(state.workbench.history.present).toEqual(wires('imported'));
    expect(state.workbench.history.past).toEqual([wires('draft')]);
    state = workspaceReducer(state, { type: 'undo' });
    expect(state.workbench.history.present).toEqual(wires('draft'));
  });

  it('新建空白项目替换自主稿并清除示例，能够撤销恢复原自主线路', () => {
    let state = createWorkspaceState('自主稿', wires('draft'));
    state = workspaceReducer(state, {
      type: 'enter-example',
      id: 'one',
      name: '示例',
      wires: wires('sample'),
    });
    state = workspaceReducer(state, { type: 'replace-project', name: '未命名实验', wires: [] });
    expect(state.example).toBeNull();
    expect(state.workbench.name).toBe('未命名实验');
    expect(state.workbench.history.present).toEqual([]);
    state = workspaceReducer(state, { type: 'undo' });
    expect(state.workbench.history.present).toEqual(wires('draft'));
  });

  it('撤销后提交仅截断当前工作区的重做栈，不修改旧状态', () => {
    let state = createWorkspaceState('原稿', wires('initial'));
    state = workspaceReducer(state, { type: 'commit', wires: wires('first') });
    state = workspaceReducer(state, { type: 'undo' });
    const previous = state;
    state = workspaceReducer(state, { type: 'commit', wires: wires('branch') });
    expect(state.workbench.history.future).toEqual([]);
    expect(previous.workbench.history.future).toEqual([wires('first')]);
    expect(previous.workbench.history.present).toEqual(wires('initial'));
    expect(workspaceReducer(state, { type: 'redo' })).toBe(state);
  });

  it('自主稿和示例独立保留最多 60 步撤销，替换项目也遵守上限', () => {
    let state = createWorkspaceState('原稿', wires('0'));
    for (let i = 1; i <= 70; i++)
      state = workspaceReducer(state, { type: 'commit', wires: wires(String(i)) });
    expect(state.workbench.history.past).toHaveLength(60);
    expect(state.workbench.history.past[0][0].id).toBe('10');
    const workbench = state.workbench;
    state = workspaceReducer(state, {
      type: 'enter-example',
      id: 'one',
      name: '示例',
      wires: wires('example'),
    });
    for (let i = 0; i < 65; i++)
      state = workspaceReducer(state, { type: 'commit', wires: wires(`example-${i}`) });
    expect(currentWorkspace(state).history.past).toHaveLength(60);
    expect(state.workbench).toBe(workbench);
    state = workspaceReducer(state, { type: 'replace-project', name: '新方案', wires: [] });
    expect(state.workbench.history.past).toHaveLength(60);
    expect(state.workbench.history.past.at(-1)).toEqual(wires('70'));
  });

  it('无可撤销操作或不在示例时退出，保持原状态引用', () => {
    const state = createWorkspaceState('原稿', []);
    expect(workspaceReducer(state, { type: 'undo' })).toBe(state);
    expect(workspaceReducer(state, { type: 'redo' })).toBe(state);
    expect(workspaceReducer(state, { type: 'exit-example' })).toBe(state);
    expect(workspaceReducer(state, { type: 'set-name', name: '原稿' })).toBe(state);
  });
});
