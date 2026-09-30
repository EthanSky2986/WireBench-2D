import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_LOCALE, isLocale, translate, type Locale, type Translate } from './catalog';

export const LOCALE_STORAGE_KEY = 'wirebench-2d.locale';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readPreferredLocale(): Locale {
  try {
    const value = globalThis.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readPreferredLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, 'ui.document.title');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', translate(locale, 'ui.document.description'));
    try {
      globalThis.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Language still changes in memory when browser persistence is unavailable.
    }
  }, [locale]);

  const t = useCallback<Translate>((key, values) => translate(locale, key, values), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider.');
  return value;
}
