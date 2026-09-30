import { en as ui } from './ui.en';
import { en as bench } from './bench.en';
import { en as messages } from './messages.en';
import type { TranslationCatalog } from './zh-CN';

export const en = {
  'language.label': 'Language',
  'language.zh-CN': '简体中文',
  'language.en': 'English',
  ...ui,
  ...bench,
  ...messages,
} satisfies TranslationCatalog;
