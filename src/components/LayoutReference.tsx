import { useId } from 'react';
import { useI18n } from '../i18n';
import { BOARD, placements, strips, localizeDevice } from '../layout';
import { DEVICES } from '../sim/model';
import './layout-reference.css';

/** Read-only schematic generated from the same placements and terminal IDs as the workbench. */
export default function LayoutReference() {
  const { t, locale } = useI18n();
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div className="layout-reference">
      <svg
        viewBox={`0 0 ${BOARD.width} ${BOARD.height}`}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <title id={titleId}>{t('ui.modal.referenceHeading')}</title>
        <desc id={descriptionId}>{t('ui.modal.referenceAlt')}</desc>
        <rect
          x="1"
          y="1"
          width={BOARD.width - 2}
          height={BOARD.height - 2}
          rx="14"
          fill="var(--surface-inset)"
          stroke="var(--border-strong)"
        />
        {placements.map((part) => (
          <g key={part.id} data-reference-device={part.id}>
            <rect
              x={part.x}
              y={part.y}
              width={part.size}
              height={part.size}
              rx="8"
              fill="var(--surface-raised)"
              stroke="var(--border-strong)"
              strokeWidth="2"
            />
            <text
              x={part.x + part.size / 2}
              y={part.y + part.size / 2 + 6}
              textAnchor="middle"
              fontSize="19"
              fontWeight="700"
              fill="var(--text-primary)"
            >
              {part.id}
            </text>
          </g>
        ))}
        {strips.map((strip) => (
          <g key={`${strip.deviceId}-${strip.x}-${strip.y}`}>
            <text
              x={strip.x + (strip.step * strip.labels.length) / 2}
              y={strip.y - 12}
              textAnchor="middle"
              fontSize="15"
              fontWeight="600"
              fill="var(--accent)"
            >
              {strip.deviceId}
            </text>
            {strip.labels.map((label, index) => (
              <g
                key={label}
                data-reference-terminal={`${strip.deviceId}:${label}`}
                transform={`translate(${strip.x + strip.step * index} ${strip.y})`}
              >
                <rect
                  width={strip.step}
                  height="62"
                  rx="2"
                  fill="var(--accent-soft)"
                  stroke="var(--border-strong)"
                />
                <circle
                  cx={strip.step / 2}
                  cy={strip.side === 'top' ? 10 : 52}
                  r="3"
                  fill="var(--accent)"
                />
                <text
                  x={strip.step / 2}
                  y="36"
                  textAnchor="middle"
                  fontSize={label.length > 2 ? 10 : 13}
                  fontWeight="600"
                  fill="var(--text-primary)"
                >
                  {label}
                </text>
              </g>
            ))}
          </g>
        ))}
      </svg>
      <p>{t('ui.modal.referenceNote')}</p>
      <details>
        <summary>{t('ui.modal.referenceList')}</summary>
        <dl className="layout-reference-list">
          {DEVICES.map((device) => (
            <div key={device.id}>
              <dt>
                <strong>{device.id}</strong> {localizeDevice(device, locale)}
              </dt>
              <dd>{device.terminals.join(' · ')}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
