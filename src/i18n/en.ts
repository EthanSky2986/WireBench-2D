import { en as ui } from './ui.en';
import { en as bench } from './bench.en';
import { en as messages } from './messages.en';
import { en as learning } from './learning.en';
import type { TranslationCatalog } from './zh-CN';

export const en = {
  ...ui,
  ...bench,
  ...messages,
  ...learning,
} satisfies TranslationCatalog;
