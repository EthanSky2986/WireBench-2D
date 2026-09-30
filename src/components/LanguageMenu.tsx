import { Languages } from 'lucide-react';
import { useI18n, type Locale } from '../i18n';
import IconChoiceMenu from './IconChoiceMenu';

export default function LanguageMenu() {
  const { locale, setLocale, t } = useI18n();
  return (
    <IconChoiceMenu<Locale>
      label={t('language.label')}
      icon={<Languages size={18} aria-hidden="true" />}
      value={locale}
      onChange={setLocale}
      options={[
        { value: 'zh-CN', label: t('language.zh-CN'), lang: 'zh-CN' },
        { value: 'en', label: t('language.en'), lang: 'en' },
      ]}
    />
  );
}
