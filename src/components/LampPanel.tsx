import { useId } from 'react';
import { LAMP_PANEL } from '../layout';

/** Shared three-lamp enclosure; the bench renders the individually selectable lenses above it. */
export default function LampPanel() {
  const gradient = `lamp-panel-${useId().replace(/:/g, '')}`;
  const { x, y, width, height } = LAMP_PANEL;
  return (
    <g data-lamp-panel="HL1 HL2 HL3" pointerEvents="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="var(--lamp-panel-top)" />
          <stop offset="1" stopColor="var(--lamp-panel-bottom)" />
        </linearGradient>
      </defs>
      <rect x={x + 3} y={y + 4} width={width} height={height} rx="9" fill="#172027" opacity=".2" />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="9"
        fill={`url(#${gradient})`}
        stroke="#8a989e"
        strokeWidth="1.5"
      />
      <path
        d={`M${x + 10} ${y + 2}H${x + width - 10} M${x + 2} ${y + 10}V${y + height - 10}`}
        stroke="#fff"
        opacity=".6"
        fill="none"
      />
      {[x + 13, x + width - 13].flatMap((sx) =>
        [y + 13, y + height - 13].map((sy) => (
          <g key={`${sx}-${sy}`} transform={`translate(${sx} ${sy})`}>
            <circle r="5" fill="#c0c9ca" stroke="#77868b" />
            <path d="M-3 0H3M0-3V3" stroke="#596c73" strokeWidth="1.2" />
          </g>
        )),
      )}
    </g>
  );
}
