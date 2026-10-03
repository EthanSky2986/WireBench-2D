import { zh as ui } from './ui.zh';
import { zh as bench } from './bench.zh';
import { zh as messages } from './messages.zh';
import { zh as learning } from './learning.zh';

export const zhCN = {
  ...ui,
  ...bench,
  ...messages,
  ...learning,
} as const;

export type TranslationKey = keyof typeof zhCN;
export type TranslationCatalog = Record<TranslationKey, string>;
