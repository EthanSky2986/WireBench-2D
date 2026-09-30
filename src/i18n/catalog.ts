import { zhCN, type TranslationCatalog, type TranslationKey } from './zh-CN';
import { en } from './en';

export type Locale = 'zh-CN' | 'en';
export type TranslationValues = Readonly<Record<string, string | number>>;
export type Translate = (key: TranslationKey, values?: TranslationValues) => string;
export type { TranslationKey } from './zh-CN';

export const DEFAULT_LOCALE: Locale = 'zh-CN';
export const SUPPORTED_LOCALES: readonly Locale[] = ['zh-CN', 'en'];
const catalogs: Record<Locale, TranslationCatalog> = { 'zh-CN': zhCN, en };

export function isLocale(value: unknown): value is Locale {
  return value === 'zh-CN' || value === 'en';
}

/** Pure text formatting: safe for non-React view adapters and test code. */
export function translate(
  locale: Locale,
  key: TranslationKey,
  values: TranslationValues = {},
): string {
  return catalogs[locale][key].replace(/\{([^{}]+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder,
  );
}
