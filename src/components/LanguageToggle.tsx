import { useI18n } from '../i18n';

export default function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  const target = locale === 'zh-CN' ? 'en' : 'zh-CN';
  const label = t(target === 'en' ? 'ui.language.switchToEnglish' : 'ui.language.switchToChinese');

  return (
    <button
      type="button"
      className="language-trigger"
      title={label}
      aria-label={label}
      onClick={() => setLocale(target)}
    >
      <strong lang={target} aria-hidden="true">
        {t(target === 'en' ? 'ui.language.englishShort' : 'ui.language.chineseShort')}
      </strong>
    </button>
  );
}
