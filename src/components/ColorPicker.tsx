import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { useI18n } from '../i18n';

export const WIRE_COLORS = [
  { value: '#c65545', labelKey: 'color.red' },
  { value: '#d09b31', labelKey: 'color.yellow' },
  { value: '#32866d', labelKey: 'color.green' },
  { value: '#527da3', labelKey: 'color.blue' },
  { value: '#535c60', labelKey: 'color.gray' },
] as const;

interface ColorPickerProps {
  value: string;
  disabled?: boolean;
  context?: 'new-wire' | 'selected-wire';
  onChange: (color: string) => void;
}

/** Shared wire palette, with labels describing the specific edit action. */
export default function ColorPicker({
  value,
  disabled = false,
  context = 'new-wire',
  onChange,
}: ColorPickerProps) {
  const { t } = useI18n();
  const selectedWire = context === 'selected-wire';
  return (
    <div
      className={`color-picker${selectedWire ? ' large' : ''}`}
      aria-label={selectedWire ? undefined : t('color.newLabel')}
    >
      {WIRE_COLORS.map((color) => (
        <button
          key={color.value}
          disabled={disabled}
          aria-label={t(selectedWire ? 'color.changeSelected' : 'color.selectNew', {
            color: t(color.labelKey),
          })}
          aria-pressed={value === color.value}
          style={{ '--wire-color': color.value } as CSSProperties}
          className={value === color.value ? 'selected' : ''}
          onClick={() => onChange(color.value)}
        >
          {value === color.value && <Check size={selectedWire ? 12 : 10} />}
        </button>
      ))}
    </div>
  );
}
