import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface IconChoice<Value extends string> {
  value: Value;
  label: string;
  lang?: string;
}

export interface IconChoiceMenuProps<Value extends string> {
  label: string;
  icon: ReactNode;
  value: Value;
  options: readonly IconChoice<Value>[];
  onChange: (value: Value) => void;
}

/** Shared single-choice popup behavior; labels and preference state stay outside. */
export default function IconChoiceMenu<Value extends string>({
  label,
  icon,
  value,
  options,
  onChange,
}: IconChoiceMenuProps<Value>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const choices = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<'current' | 'first' | 'last'>('current');
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const buttons = choices.current?.querySelectorAll<HTMLButtonElement>('button');
    if (buttons?.length) {
      const selected = choices.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
      const target =
        initialFocus.current === 'first'
          ? buttons[0]
          : initialFocus.current === 'last'
            ? buttons[buttons.length - 1]
            : (selected ?? buttons[0]);
      target.focus();
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
      className="language-menu"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          closeToTrigger();
        } else if (event.key === 'Tab' && open) {
          // Restore the trigger before the browser moves to its next/previous tab stop.
          closeToTrigger();
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          if (!open) {
            initialFocus.current =
              event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : 'current';
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
        className="language-trigger"
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          initialFocus.current = 'current';
          setOpen((previous) => !previous);
        }}
      >
        {icon}
      </button>
      {open && (
        <div id={menuId} ref={choices} className="language-options" role="menu" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={value === option.value}
              tabIndex={-1}
              lang={option.lang}
              onClick={() => {
                onChange(option.value);
                closeToTrigger();
              }}
            >
              <span>{option.label}</span>
              {value === option.value && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
