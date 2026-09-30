import { Moon, Sun } from 'lucide-react';
import { useI18n } from '../i18n';
import { useTheme } from '../theme/provider';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const target = theme === 'dark' ? 'light' : 'dark';
  const label = t(target === 'light' ? 'theme.switchToLight' : 'theme.switchToDark');

  return (
    <button
      type="button"
      className="language-trigger"
      title={label}
      aria-label={label}
      onClick={() => setTheme(target)}
    >
      {target === 'light' ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </button>
  );
}
