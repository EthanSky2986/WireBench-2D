import { useI18n } from '../i18n';

interface ThermalControlsProps {
  id: string;
  tripped: boolean;
  onOperate: (id: string, active: boolean) => void;
  surface: 'canvas' | 'inspector';
  blocked?: boolean;
  onSelect?: () => void;
}

/** Explicit, idempotent commands: inspecting the relay never trips or resets it. */
export default function ThermalControls({
  id,
  tripped,
  onOperate,
  surface,
  blocked = false,
  onSelect,
}: ThermalControlsProps) {
  const { t } = useI18n();
  const actions = [
    { active: true, x: 75, label: t('inspector.testThermal'), aria: t('thermal.test', { id }) },
    { active: false, x: 102, label: t('inspector.resetThermal'), aria: t('thermal.reset', { id }) },
  ];
  const operate = (active: boolean) => {
    if (blocked) return;
    onSelect?.();
    if (active !== tripped) onOperate(id, active);
  };
  if (surface === 'inspector') {
    return (
      <div className="thermal-actions" role="group" aria-label={t('thermal.controls', { id })}>
        {actions.map((action) => (
          <button
            key={String(action.active)}
            className="button outline"
            aria-label={action.aria}
            disabled={blocked || action.active === tripped}
            onClick={() => operate(action.active)}
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <g role="group" aria-label={t('thermal.controls', { id })}>
      {actions.map((action) => (
        <g
          key={String(action.active)}
          className="thermal-control"
          role="button"
          tabIndex={blocked ? -1 : 0}
          aria-label={action.aria}
          aria-disabled={blocked || action.active === tripped}
          onPointerDown={(event) => {
            // Let the canvas handle routing and panning through these hit areas.
            if (blocked || event.button !== 0) return;
            event.stopPropagation();
            onSelect?.();
          }}
          onClick={(event) => {
            if (blocked) return;
            event.stopPropagation();
            operate(action.active);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            if (!event.repeat) operate(action.active);
          }}
          onKeyUp={(event) => {
            if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
          }}
        >
          <title>{action.aria}</title>
          <rect x={action.x} y="70" width="25" height="35" rx="3" />
        </g>
      ))}
    </g>
  );
}
