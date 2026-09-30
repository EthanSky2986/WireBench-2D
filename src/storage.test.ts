import { describe, expect, it } from 'vitest';
import { encodeProject } from './project';
import {
  PROJECT_STORAGE_KEY,
  readStoredProject,
  saveStoredProject,
  type ProjectStorage,
} from './storage';

class MemoryStorage implements ProjectStorage {
  values = new Map<string, string>();
  writes = 0;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.writes++;
    this.values.set(key, value);
  }
}

describe('本地存档读写策略', () => {
  it('空存储无报错，保存后可以读取有效方案', () => {
    const storage = new MemoryStorage();
    expect(readStoredProject(storage)).toEqual({ project: null, error: '', problem: null });
    expect(saveStoredProject('测试方案', [], storage).ok).toBe(true);
    expect(readStoredProject(storage).project?.name).toBe('测试方案');
    expect(storage.writes).toBe(1);
  });

  it.each(['{invalid', '', '{"format":"wirebench-2d","version":2,"name":"未来版本","wires":[]}'])(
    '保护无法载入的原文，不被初始化或后续自动/手动保存覆盖：%s',
    (raw) => {
      const storage = new MemoryStorage();
      storage.values.set(PROJECT_STORAGE_KEY, raw);
      const boot = readStoredProject(storage);
      expect(readStoredProject(storage)).toEqual(boot);
      expect(boot.project).toBeNull();
      expect(boot.problem).toBe('protected');
      expect(boot.error).toContain('原始存档已保留');
      for (const name of ['初始化的空方案', '编辑后的方案', '点击保存后的方案']) {
        const result = saveStoredProject(name, [], storage);
        expect(result.ok).toBe(false);
        expect(result.problem).toBe('protected');
      }
      expect(storage.getItem(PROJECT_STORAGE_KEY)).toBe(raw);
      expect(storage.writes).toBe(0);
    },
  );

  it('已有有效存档正常载入和更新，读取本身不写入', () => {
    const storage = new MemoryStorage();
    storage.values.set(PROJECT_STORAGE_KEY, encodeProject('旧方案', []));
    expect(readStoredProject(storage).project?.name).toBe('旧方案');
    expect(storage.writes).toBe(0);
    expect(saveStoredProject('更新方案', [], storage).ok).toBe(true);
    expect(readStoredProject(storage).project?.name).toBe('更新方案');
  });

  it('每次写入前重新检查，保护启动后由另一页面替换的未知版本', () => {
    const storage = new MemoryStorage();
    storage.values.set(PROJECT_STORAGE_KEY, encodeProject('原方案', []));
    expect(readStoredProject(storage).problem).toBeNull();
    const newer = '{"format":"wirebench-2d","version":9,"name":"新格式","wires":[]}';
    storage.values.set(PROJECT_STORAGE_KEY, newer);
    expect(saveStoredProject('当前方案', [], storage).problem).toBe('protected');
    expect(storage.getItem(PROJECT_STORAGE_KEY)).toBe(newer);
    expect(storage.writes).toBe(0);
  });

  it('localStorage 属性访问被禁止时不崩溃，并显示原因', () => {
    const access = () => {
      throw new DOMException('Access denied', 'SecurityError');
    };
    expect(readStoredProject(access).error).toContain('浏览器禁止访问本地存储');
    const result = saveStoredProject('方案', [], access);
    expect(result.ok).toBe(false);
    expect(result.problem).toBe('unavailable');
    expect(result.error).toContain('浏览器禁止访问本地存储');
  });

  it('读取失败时停止写入，不以空白方案覆盖无法读取的数据', () => {
    const storage: ProjectStorage = {
      getItem() {
        throw new Error('磁盘读取失败');
      },
      setItem() {
        throw new Error('不得进入写入');
      },
    };
    const result = saveStoredProject('方案', [], storage);
    expect(result.problem).toBe('unavailable');
    expect(result.error).toContain('磁盘读取失败');
  });

  it('写入空间不足时保留旧内容，返回真实错误，不报告已保存', () => {
    const old = encodeProject('原方案', []);
    const storage: ProjectStorage = {
      getItem() {
        return old;
      },
      setItem() {
        throw new DOMException('Quota exhausted', 'QuotaExceededError');
      },
    };
    const result = saveStoredProject('新方案', [], storage);
    expect(result.ok).toBe(false);
    expect(result.problem).toBe('write-failed');
    expect(result.error).toContain('存储空间不足');
    expect(storage.getItem(PROJECT_STORAGE_KEY)).toBe(old);
  });

  it('当前数据无效时不改动已经保存的内容', () => {
    const storage = new MemoryStorage();
    const old = encodeProject('原方案', []);
    storage.values.set(PROJECT_STORAGE_KEY, old);
    const result = saveStoredProject('', [], storage);
    expect(result.problem).toBe('invalid');
    expect(result.error).toContain('方案名称');
    expect(storage.getItem(PROJECT_STORAGE_KEY)).toBe(old);
    expect(storage.writes).toBe(0);
  });
});
