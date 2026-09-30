import { zh as ui } from './ui.zh';
import { zh as bench } from './bench.zh';
import { zh as messages } from './messages.zh';

export const zhCN = {
  'language.label': '界面语言',
  'language.zh-CN': '简体中文',
  'language.en': 'English',
  ...ui,
  ...bench,
  ...messages,
} as const;

export type TranslationKey = keyof typeof zhCN;
export type TranslationCatalog = Record<TranslationKey, string>;
