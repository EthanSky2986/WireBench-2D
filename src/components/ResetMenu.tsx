import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { useI18n } from '../i18n';

export interface ResetMenuProps {
  onReset: () => void;
  onClear: () => void;
}

export default function ResetMenu({ onReset, onClear }: ResetMenuProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const choices = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<'first' | 'last'>('first');
  const menuId = useId();
  const label = t('ui.reset.label');
  const actions = [
    { key: 'state', label: t('ui.reset.state'), hint: t('ui.reset.stateHint'), run: onReset },
    { key: 'clear', label: t('ui.reset.clear'), hint: t('ui.reset.clearHint'), run: onClear },
  ];

  useEffect(() => {
    if (!open) return;
    const buttons = choices.current?.querySelectorAll<HTMLButtonElement>('button');
    if (buttons?.length) {
      buttons[initialFocus.current === 'last' ? buttons.length - 1 : 0]?.focus();
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const closeToTrigger = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div
      ref={root}
      className="bench-reset-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          closeToTrigger();
        } else if (event.key === 'Tab' && open) {
          // Let the native Tab action continue from the trigger to the adjacent control.
          closeToTrigger();
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          if (!open) {
            initialFocus.current =
              event.key === 'ArrowUp' || event.key === 'End' ? 'last' : 'first';
            setOpen(true);
            return;
          }
          const buttons = Array.from(
            choices.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
          );
          if (!buttons.length) return;
          const index = buttons.findIndex((button) => button === document.activeElement);
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
          buttons[next]?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="reset-trigger"
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          initialFocus.current = 'first';
          setOpen((previous) => !previous);
        }}
      >
        <RotateCcw size={16} aria-hidden="true" />
        <span>{label}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} ref={choices} className="reset-options" role="menu" aria-label={label}>
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              className="reset-choice"
              tabIndex={-1}
              aria-labelledby={`${menuId}-${action.key}-label`}
              aria-describedby={`${menuId}-${action.key}-hint`}
              onClick={() => {
                closeToTrigger();
                action.run();
              }}
            >
              <span id={`${menuId}-${action.key}-label`}>{action.label}</span>
              <small id={`${menuId}-${action.key}-hint`}>{action.hint}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
