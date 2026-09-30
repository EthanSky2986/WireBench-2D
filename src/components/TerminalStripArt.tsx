import { useId } from 'react';
import type { Strip } from '../layout';

export interface TerminalStripArtProps {
  strips: readonly Strip[];
}

/** Decorative shell only; Bench owns the sockets, input events, and electrical identities. */
export function TerminalStripArt({ strips }: TerminalStripArtProps) {
  const gradientId = `terminal-plastic-${useId().replace(/:/g, '')}`;
  if (strips.length === 0) return null;

  const continuous = strips.length > 1;
  const left = Math.min(...strips.map((s) => s.x));
  const right = Math.max(...strips.map((s) => s.x + s.step * s.labels.length));
  const y = strips[0].y;

  return (
    <g
      data-terminal-bank={strips.map((s) => s.deviceId).join(' ')}
      aria-hidden="true"
      pointerEvents="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor={continuous ? '#a9b1b3' : '#c4cdc9'} />
          <stop offset=".3" stopColor={continuous ? '#d3d7d7' : '#e5e9e3'} />
          <stop offset="1" stopColor={continuous ? '#949fa3' : '#aab8b1'} />
        </linearGradient>
      </defs>
      <rect
        x={left - 6}
        y={y - 3}
        width={right - left + 12}
        height="68"
        rx="3"
        fill={continuous ? '#a5adae' : '#b7c0ae'}
        stroke={continuous ? '#778488' : '#8f9e89'}
      />
      {continuous &&
        [left - 6, right].map((x) => (
          <g key={x}>
            <rect x={x} y={y - 2} width="6" height="66" rx="1" fill="#b9bfbd" />
            <path
              d={`M${x + 1} ${y + 5}h4 M${x + 1} ${y + 57}h4`}
              stroke="#778583"
              strokeWidth="2"
            />
            <rect x={x + 1.5} y={y + 25} width="3" height="12" rx="1.5" fill="#6a7775" />
          </g>
        ))}
      {strips.map((s, groupIndex) => (
        <g key={`${s.deviceId}-${s.x}-${s.y}`} data-terminal-strip={s.deviceId}>
          {s.labels.map((label, i) => {
            const x = s.x + i * s.step;
            const centerX = x + s.step / 2;
            const fixedY = s.y + (s.side === 'top' ? 52 : 10);
            const clipY = s.y + (s.side === 'top' ? 39 : 16);
            return (
              <g key={`${s.deviceId}:${label}`}>
                <rect
                  x={x}
                  y={s.y}
                  width={continuous ? s.step : s.step - 1}
                  height="62"
                  rx={continuous ? 0.6 : 1}
                  fill={s.deviceId === 'POWER' && label === 'N' ? '#bfd1d7' : `url(#${gradientId})`}
                  stroke={continuous ? '#7e8a8e' : '#93a299'}
                  strokeWidth=".6"
                />
                {continuous && (
                  <>
                    <path
                      d={`M${x + 1.5} ${s.y + 2}h${s.step - 3} M${x + 1.5} ${s.y + 60}h${s.step - 3}`}
                      stroke="#e2e5e3"
                      strokeWidth=".8"
                    />
                    <circle cx={centerX} cy={fixedY} r="5.2" fill="#7d8a8f" />
                  </>
                )}
                <circle
                  cx={centerX}
                  cy={fixedY}
                  r="4.3"
                  fill={continuous ? '#263238' : '#4a5b50'}
                />
                <rect
                  x={x + 4}
                  y={clipY}
                  width={s.step - 9}
                  height="6"
                  rx="1"
                  fill={continuous ? '#d48652' : '#d19760'}
                  stroke={continuous ? '#a4653d' : 'none'}
                  strokeWidth=".6"
                />
                {continuous && (
                  <path
                    d={`M${x + 6} ${clipY + 1.5}h${s.step - 13} M${centerX} ${clipY + 2}v2.5`}
                    stroke="#f1b27e"
                    strokeWidth=".7"
                  />
                )}
                <rect
                  x={x + 2}
                  y={s.y + 24}
                  width={s.step - 5}
                  height="13"
                  fill={continuous ? '#f0f1ea' : '#f4f4ec'}
                />
                <text
                  x={centerX}
                  y={s.y + 34.5}
                  textAnchor="middle"
                  className={`terminal-label ${label.length > 2 ? 'small' : ''}`}
                >
                  {label}
                </text>
              </g>
            );
          })}
          {continuous && groupIndex > 0 && (
            <path d={`M${s.x} ${s.y}v62`} stroke="#647379" strokeWidth="1.1" />
          )}
        </g>
      ))}
    </g>
  );
}
