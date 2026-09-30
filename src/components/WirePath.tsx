import type { Point } from '../layout';
import { roundedWirePath } from '../rendering/wireGeometry';

export interface WirePathProps {
  points: readonly Point[];
  color: string;
  selected?: boolean;
  fault?: boolean;
  className?: string;
}

/** Decorative material only; the caller owns selection, hit targets and handles. */
export function WirePath({
  points,
  color,
  selected = false,
  fault = false,
  className,
}: WirePathProps) {
  const d = roundedWirePath(points);
  if (!d) return null;

  return (
    <g
      className={['wire-path', className].filter(Boolean).join(' ')}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      pointerEvents="none"
      aria-hidden="true"
    >
      {(selected || fault) && (
        <path
          d={d}
          stroke={fault ? '#d85b40' : '#23856e'}
          strokeWidth={fault ? 10 : 9}
          opacity={fault ? 0.23 : 0.18}
        />
      )}
      {/* An offset stroke gives depth without a blur filter for every wire. */}
      <path
        d={d}
        stroke="#18382b"
        strokeWidth="5.8"
        opacity="0.13"
        transform="translate(0.55 1.1)"
      />
      <path d={d} stroke="#25392f" strokeWidth="4.5" opacity="0.8" />
      <path d={d} stroke={color} strokeWidth="3.5" />
      <path
        d={d}
        stroke="#ffffff"
        strokeWidth="0.8"
        opacity="0.34"
        transform="translate(-0.18 -0.3)"
      />
    </g>
  );
}

export default WirePath;
