import { describe, expect, it } from 'vitest';
import { zh as uiZh } from './ui.zh';
import { en as uiEn } from './ui.en';
import { zh as benchZh } from './bench.zh';
import { en as benchEn } from './bench.en';
import { zh as messagesZh } from './messages.zh';
import { en as messagesEn } from './messages.en';
import { zh as learningZh } from './learning.zh';
import { en as learningEn } from './learning.en';
import { zhCN } from './zh-CN';
import { en } from './en';

const groups = [
  { name: 'ui', zh: uiZh, en: uiEn },
  { name: 'bench', zh: benchZh, en: benchEn },
  { name: 'messages', zh: messagesZh, en: messagesEn },
  { name: 'learning', zh: learningZh, en: learningEn },
];
const catalogs = [...groups, { name: 'combined', zh: zhCN, en }];

function placeholders(value: string): string[] {
  return [...new Set([...value.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]))].sort();
}

describe('翻译词表契约', () => {
  it('各子词表及最终词表的中英文键完整一致', () => {
    for (const catalog of catalogs) {
      expect(Object.keys(catalog.en).sort(), catalog.name).toEqual(Object.keys(catalog.zh).sort());
    }
  });

  it('每个条目都有可显示的文字，不用空白掩盖漏译', () => {
    for (const catalog of catalogs) {
      for (const [locale, entries] of [
        ['zh-CN', catalog.zh],
        ['en', catalog.en],
      ] as const) {
        for (const [key, text] of Object.entries(entries)) {
          expect(text.trim().length, `${catalog.name}/${locale}/${key}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('翻译保留动态参数名，允许调整占位符顺序', () => {
    for (const catalog of catalogs) {
      const english: Record<string, string> = catalog.en;
      for (const [key, text] of Object.entries(catalog.zh)) {
        expect(placeholders(english[key] ?? ''), `${catalog.name}/${key}`).toEqual(
          placeholders(text),
        );
      }
    }
  });

  it('子词表不使用重复键，避免展开合并时静默覆盖', () => {
    const keys = groups.flatMap((group) => Object.keys(group.zh));
    const languageKeys = Object.keys(zhCN).filter((key) => key.startsWith('language.'));
    const all = [...keys, ...languageKeys];
    expect(new Set(all).size).toBe(all.length);
    expect(Object.keys(zhCN).length).toBe(all.length);
  });
});
