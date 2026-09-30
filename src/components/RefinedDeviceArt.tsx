import { useId } from 'react';
import type { DeviceArtProps } from './DeviceArt';
import { useI18n } from '../i18n';
import './refined-device-art.css';

interface LensPalette {
  dark: string;
  off: string;
  face: string;
  light: string;
  glow: string;
  core: string;
}

const LENSES: Record<'amber' | 'green' | 'red', LensPalette> = {
  amber: {
    dark: '#50300e',
    off: '#74501b',
    face: '#d99824',
    light: '#edc466',
    glow: '#ffbf38',
    core: '#fff5b3',
  },
  green: {
    dark: '#132c24',
    off: '#244b3c',
    face: '#30795a',
    light: '#69a688',
    glow: '#29d690',
    core: '#c6ffe0',
  },
  red: {
    dark: '#421b1b',
    off: '#652b2b',
    face: '#b9483e',
    light: '#df8170',
    glow: '#ff6851',
    core: '#ffe4c2',
  },
};

function Screw({
  x,
  y,
  radius = 4,
  metal,
}: {
  x: number;
  y: number;
  radius?: number;
  metal: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={radius + 2.2} fill="#151a1c" />
      <circle cy="0.4" r={radius + 0.5} fill="#070b0d" opacity="0.5" />
      <circle r={radius} fill={metal} stroke="#a6aeb1" strokeWidth="0.5" />
      <path
        d={`M ${-radius + 1} 0 H ${radius - 1} M 0 ${-radius + 1} V ${radius - 1}`}
        stroke="#41494d"
        strokeWidth="1.3"
      />
      <path
        d={`M ${-radius + 1} -0.7 H ${radius - 1}`}
        stroke="#f7f8f8"
        strokeWidth="0.35"
        opacity="0.8"
      />
    </g>
  );
}

/** Shared 160 × 160 device artwork for the bench, inspector and material preview.
 * The enclosing device owns interaction, accessible labels and electrical state.
 */
export function RefinedDeviceArt(props: DeviceArtProps) {
  const { kind, id, active = false, tripped = false } = props;
  const { locale, t } = useI18n();
  const uid = `refined-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const fill = (name: string) => `url(#${uid}-${name})`;
  const tone = (kind === 'lamp' ? id.endsWith('1') : id.endsWith('3'))
    ? 'amber'
    : id.endsWith('2')
      ? 'green'
      : 'red';
  const lens = LENSES[tone];

  return (
    <g
      aria-hidden="true"
      className={`refined-device-art refined-device-art--${kind}${active ? ' is-active' : ''}`}
    >
      <defs>
        <linearGradient id={`${uid}-case`} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#697176" />
          <stop offset="0.42" stopColor="#4d555b" />
          <stop offset="1" stopColor="#333b41" />
        </linearGradient>
        <linearGradient id={`${uid}-front`} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0" stopColor="#41494d" />
          <stop offset="1" stopColor="#293136" />
        </linearGradient>
        <linearGradient id={`${uid}-bevel`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7e8589" />
          <stop offset="0.45" stopColor="#535c61" />
          <stop offset="1" stopColor="#222a2e" />
        </linearGradient>
        <linearGradient id={`${uid}-plate`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#f0f1ee" />
          <stop offset="0.5" stopColor="#dde0de" />
          <stop offset="1" stopColor="#c4c9c8" />
        </linearGradient>
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#f8faf9" />
          <stop offset="0.18" stopColor="#dfe4e4" />
          <stop offset="0.47" stopColor="#a4afb2" />
          <stop offset="0.68" stopColor="#e6eaea" />
          <stop offset="1" stopColor="#7e8a8f" />
        </linearGradient>
        <linearGradient id={`${uid}-inset`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#111a1e" />
          <stop offset="0.65" stopColor="#3d494c" />
          <stop offset="1" stopColor="#687478" />
        </linearGradient>
        <linearGradient id={`${uid}-blue`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#66859c" />
          <stop offset="0.48" stopColor="#476b86" />
          <stop offset="1" stopColor="#2b4b65" />
        </linearGradient>
        <radialGradient id={`${uid}-emergency`} cx="33%" cy="22%" r="85%">
          <stop offset="0" stopColor="#e87d69" />
          <stop offset="0.42" stopColor="#c24b3e" />
          <stop offset="1" stopColor="#7d2c2b" />
        </radialGradient>
        <radialGradient id={`${uid}-button`} cx="35%" cy="24%" r="85%">
          <stop offset="0" stopColor={lens.light} />
          <stop offset="0.42" stopColor={lens.face} />
          <stop offset="1" stopColor={lens.dark} />
        </radialGradient>
        <radialGradient id={`${uid}-off`} cx="34%" cy="25%" r="90%">
          <stop offset="0" stopColor={lens.off} />
          <stop offset="0.65" stopColor={lens.dark} />
          <stop offset="1" stopColor="#131c1e" />
        </radialGradient>
        <radialGradient id={`${uid}-on`} cx="45%" cy="43%" r="62%">
          <stop offset="0" stopColor={lens.core} />
          <stop offset="0.38" stopColor={lens.core} />
          <stop offset="0.7" stopColor={lens.glow} />
          <stop offset="1" stopColor={lens.face} />
        </radialGradient>
        <radialGradient id={`${uid}-halo`}>
          <stop offset="0.43" stopColor={lens.glow} stopOpacity="0.18" />
          <stop offset="0.62" stopColor={lens.glow} stopOpacity="0.1" />
          <stop offset="1" stopColor={lens.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-window`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe16d" />
          <stop offset="0.5" stopColor="#f9bd32" />
          <stop offset="1" stopColor="#d78b0b" />
        </linearGradient>
      </defs>

      {kind === 'contactor' && (
        <g>
          <rect x="19" y="10" width="126" height="146" rx="4" fill="#172027" opacity="0.12" />
          <rect
            x="18"
            y="8"
            width="124"
            height="144"
            rx="3"
            fill="#333c42"
            stroke="#2b3338"
            strokeWidth="1"
          />
          <path
            d="M 27 6 H 133 V 19 H 142 V 139 H 134 V 151 H 26 V 139 H 18 V 19 H 27 Z"
            fill={fill('case')}
            stroke="#3e484d"
            strokeWidth="1"
          />
          <path d="M 28 7 H 132 M 19 20 V 137" stroke="#a1a9ac" strokeWidth="1" opacity="0.6" />
          <path d="M 141 21 V 138 H 134 V 150" stroke="#242e34" strokeWidth="2" />
          {[31, 47, 63, 79, 95, 111, 127].map((y) => (
            <g key={y} strokeWidth="1">
              <path d={`M 19 ${y} H 26`} stroke="#788287" opacity="0.65" />
              <path d={`M 134 ${y} H 140`} stroke="#26323a" />
            </g>
          ))}

          {[33, 64, 95, 126].map((x, index) => (
            <g key={x}>
              <path
                d={`M ${x - 12} 15 H ${x + 12} V 40 H ${x - 12} Z`}
                fill="#202a30"
                stroke="#788288"
                strokeWidth="0.7"
              />
              <path
                d={`M ${x - 10} 17 V 37 H ${x + 10}`}
                fill="none"
                stroke="#111c21"
                strokeWidth="1"
              />
              <Screw x={x} y={28} radius={5} metal={fill('metal')} />
              <text x={x} y="12" textAnchor="middle" className="refined-silkscreen">
                {['1 L1', '3 L2', '5 L3', '13 NO'][index]}
              </text>
              <rect
                x={x - 11}
                y="124"
                width="22"
                height="19"
                rx="1"
                fill="#243037"
                stroke="#6b767c"
                strokeWidth="0.6"
              />
              <Screw x={x} y={133} radius={4.4} metal={fill('metal')} />
              <text x={x} y="150" textAnchor="middle" className="refined-silkscreen">
                {['2 T1', '4 T2', '6 T3', '14 NO'][index]}
              </text>
            </g>
          ))}

          <rect x="23" y="46" width="116" height="77" rx="2" fill="#172025" opacity="0.5" />
          <path
            d="M 21 44 H 138 L 140 47 V 120 H 23 L 21 117 Z"
            fill={fill('bevel')}
            stroke="#283238"
            strokeWidth="0.8"
          />
          <rect x="24" y="47" width="113" height="71" rx="1" fill={fill('front')} />
          <path d="M 24 47 H 137 M 24 48 V 117" stroke="#859096" strokeWidth="0.7" opacity="0.65" />
          <path d="M 25 119 H 139 V 47" stroke="#111c22" strokeWidth="1.4" />
          {[38, 66, 94, 122].map((x, index) => (
            <g key={x}>
              <Screw x={x} y={59} radius={3.6} metal={fill('metal')} />
              <Screw x={x} y={106} radius={3.6} metal={fill('metal')} />
              <text x={x} y="52" textAnchor="middle" className="refined-contact-number">
                {['53', '61', '71', '83'][index]}
              </text>
              <text x={x} y="116" textAnchor="middle" className="refined-contact-number">
                {['54', '62', '72', '84'][index]}
              </text>
            </g>
          ))}
          <text x="32" y="80" fill="#eef1f1" fontSize="10" fontWeight="650" letterSpacing="0.3">
            {id}
          </text>
          <text x="32" y="90" fill="#b9c2c6" fontSize="5.3" letterSpacing="0.3">
            AC CONTACTOR
          </text>
          <text x="129" y="80" textAnchor="end" fill="#c3ccd0" fontSize="6" letterSpacing="0.1">
            LANN22
          </text>
          <path d="M 74 72 H 88 V 97 H 74 Z" fill="#101b21" stroke="#768189" strokeWidth="0.7" />
          <rect x="76" y="75" width="10" height="19" rx="0.7" fill="#725421" />
          <rect
            className="refined-coil-window"
            x="76"
            y="75"
            width="10"
            height="19"
            rx="0.7"
            fill={fill('window')}
          />
          <rect
            className="refined-coil-slide"
            x="77"
            y="76"
            width="8"
            height="4"
            rx="0.4"
            fill="#ddd6b9"
          />
          <path d="M 26 152 H 134" stroke="#aeb5b6" strokeWidth="1" opacity="0.35" />
        </g>
      )}

      {kind === 'thermal' && (
        <g>
          <rect x="22" y="14" width="118" height="140" rx="5" fill="#172027" opacity="0.12" />
          <rect
            x="21"
            y="9"
            width="118"
            height="137"
            rx="4"
            fill={fill('case')}
            stroke="#2b3338"
            strokeWidth="1.2"
          />
          <path d="M 24 10 H 135 M 22 14 V 141" fill="none" stroke="#a1a9ac" opacity="0.6" />
          {[44, 80, 116].map((x, i) => (
            <g key={x}>
              <rect
                x={x - 12}
                y="14"
                width="24"
                height="29"
                rx="2"
                fill="#202a30"
                stroke="#7a858b"
                strokeWidth="0.7"
              />
              <text
                x={x}
                y="23"
                textAnchor="middle"
                className="refined-silkscreen"
              >{`L${i + 1}`}</text>
              <Screw x={x} y={33} radius={4.5} metal={fill('metal')} />
              <rect x={x - 12} y="124" width="24" height="20" rx="2" fill="#202a30" />
              <Screw x={x} y={134} radius={4.5} metal={fill('metal')} />
              <text
                x={x}
                y="154"
                textAnchor="middle"
                fill="#627178"
                fontSize="6"
                className="refined-device-id"
              >{`T${i + 1}`}</text>
            </g>
          ))}
          <rect
            x="26"
            y="47"
            width="108"
            height="74"
            rx="2"
            fill={fill('bevel')}
            stroke="#253138"
          />
          <rect x="29" y="50" width="102" height="67" rx="1" fill={fill('front')} />
          <path d="M 30 51 H 129" stroke="#849198" opacity="0.6" />
          <text
            x="36"
            y="63"
            fill="#edf1f2"
            fontSize="9"
            fontWeight="650"
            className="refined-device-id"
          >
            {id}
          </text>
          <text x="127" y="62" textAnchor="end" fill="#bdc7cb" fontSize="5">
            THERMAL RELAY
          </text>
          <circle cx="53" cy="89" r="18" fill="#202b32" stroke="#7f8c92" strokeWidth="0.7" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
            <path
              key={angle}
              d="M 53 74 V 77"
              transform={`rotate(${angle} 53 89)`}
              stroke="#b8c1c5"
              strokeWidth="0.8"
            />
          ))}
          <circle cx="53" cy="89" r="11" fill={fill('plate')} stroke="#909da3" strokeWidth="0.7" />
          <path d="M 49 94 L 58 82" stroke="#45545b" strokeWidth="3" strokeLinecap="round" />
          <rect
            x="77"
            y="74"
            width="20"
            height="19"
            rx="2"
            fill="#1b272e"
            stroke="#808e95"
            strokeWidth="0.6"
          />
          <rect
            x="79"
            y={tripped ? 77 : 75}
            width="16"
            height="15"
            rx="1"
            fill={tripped ? '#c46b4a' : fill('plate')}
          />
          <text x="87" y="102" textAnchor="middle" fill="#c7d0d3" fontSize="5">
            TEST
          </text>
          <rect x="105" y="73" width="17" height="21" rx="2" fill="#752d2b" stroke="#17242b" />
          <rect x="107" y="74" width="13" height="16" rx="1" fill={fill('emergency')} />
          <text x="113" y="102" textAnchor="middle" fill="#c7d0d3" fontSize="5">
            RESET
          </text>
          <rect
            x="78"
            y="108"
            width="43"
            height="5"
            rx="1"
            fill={tripped ? '#efa957' : '#1e2c32'}
            stroke="#78868c"
            strokeWidth="0.5"
          />
          {tripped && <path d="M 82 110 H 117" stroke="#ffe0a4" strokeWidth="1" />}
        </g>
      )}

      {kind === 'limit' && (
        <g>
          <rect x="47" y="67" width="68" height="89" rx="5" fill="#172027" opacity="0.12" />
          <rect
            x="46"
            y="65"
            width="68"
            height="87"
            rx="4"
            fill={fill('blue')}
            stroke="#29465b"
            strokeWidth="1.2"
          />
          <path d="M 48 95 H 112 M 48 98 V 148" stroke="#8aa3b3" opacity="0.65" />
          <rect x="47" y="55" width="66" height="38" rx="5" fill={fill('blue')} stroke="#263f52" />
          <path d="M 53 56 H 107" stroke="#9cb1bc" opacity="0.65" />
          <Screw x={55} y={66} radius={3} metal={fill('metal')} />
          <Screw x={105} y={66} radius={3} metal={fill('metal')} />
          <g className="refined-limit-arm">
            <path
              d="M 72 66 L 74 23 Q 80 18 86 23 L 88 66 Z"
              fill={fill('metal')}
              stroke="#7e8e96"
            />
            <circle cx="80" cy="24" r="21" fill="#202b32" stroke="#101d25" strokeWidth="1.3" />
            <circle
              cx="80"
              cy="24"
              r="16"
              fill={fill('front')}
              stroke="#66747c"
              strokeWidth="0.8"
            />
            <circle cx="80" cy="24" r="8" fill={fill('metal')} stroke="#85939a" />
            <path
              d="M 65 15 A 17 17 0 0 1 82 7"
              stroke="#849198"
              strokeWidth="1.3"
              fill="none"
              opacity="0.7"
            />
          </g>
          <circle cx="80" cy="66" r="13" fill={fill('metal')} stroke="#71838e" />
          <Screw x={80} y={66} radius={6} metal={fill('metal')} />
          <rect x="52" y="102" width="10" height="37" rx="0.8" fill={fill('plate')} />
          <text
            transform="translate(59 137) rotate(-90)"
            fill="#3d576c"
            fontSize="5.5"
            fontWeight="600"
            letterSpacing="0.5"
          >
            LIMIT SWITCH
          </text>
          <text
            x="87"
            y="116"
            textAnchor="middle"
            fill="#edf2f5"
            fontSize="12"
            fontWeight="600"
            className="refined-device-id"
          >
            {id}
          </text>
          <text x="87" y="131" textAnchor="middle" fill="#c3d5e1" fontSize="7">
            {t(active ? 'device.art.triggered' : 'device.art.limit')}
          </text>
          <path d="M 70 152 V 160 M 78 152 V 160 M 86 152 V 160" stroke="#7f8e96" strokeWidth="3" />
        </g>
      )}

      {kind === 'estop' && (
        <g>
          <rect x="16" y="12" width="132" height="136" rx="7" fill="#283238" opacity="0.09" />
          <rect
            x="14"
            y="9"
            width="132"
            height="136"
            rx="6"
            fill={fill('plate')}
            stroke="#a5afb0"
          />
          <path
            d="M 21 10 H 139 Q 145 10 145 16 M 15 18 V 138"
            fill="none"
            stroke="#fff"
            opacity="0.9"
          />
          <Screw x={25} y={21} radius={2.9} metal={fill('metal')} />
          <Screw x={135} y={133} radius={2.9} metal={fill('metal')} />
          <circle cx="80" cy="73" r="49" fill="#d3b74d" stroke="#ab9340" strokeWidth="0.8" />
          <path d="M 36 68 A 45 45 0 0 1 99 32" fill="none" stroke="#f2df87" strokeWidth="1.2" />
          <circle cx="80" cy="75" r="37" fill={fill('inset')} stroke="#968c5f" />
          <circle cx="80" cy="73" r="39" fill="#692d2b" />
          <g className="refined-estop-cap">
            <circle
              cx="80"
              cy="67"
              r="43"
              fill={fill('emergency')}
              stroke="#96382f"
              strokeWidth="1.2"
            />
            {Array.from({ length: 32 }, (_, i) => (
              <path
                key={i}
                d="M 80 26 V 29"
                transform={`rotate(${i * 11.25} 80 67)`}
                stroke="#ec9279"
                strokeWidth="0.8"
                opacity="0.5"
              />
            ))}
            <path
              d="M 45 54 A 39 39 0 0 1 95 31"
              fill="none"
              stroke="#f9b399"
              strokeWidth="1.3"
              opacity="0.65"
            />
            <g fill="none" stroke="#702c29" strokeWidth="1.4" opacity="0.85">
              <path d="M 59 61 A 23 23 0 0 1 89 46 M 89 46 L 83 46 M 89 46 L 88 40" />
              <path d="M 101 75 A 23 23 0 0 1 72 89 M 72 89 L 78 89 M 72 89 L 73 95" />
            </g>
          </g>
          <text
            x="80"
            y="132"
            textAnchor="middle"
            fill="#48555b"
            fontSize="10"
            fontWeight="650"
            letterSpacing="0.7"
            className="refined-device-id"
          >
            E-STOP
          </text>
        </g>
      )}

      {kind === 'motor' && (
        <g>
          <rect x="12" y="14" width="140" height="136" rx="7" fill="#283238" opacity="0.09" />
          <rect
            x="10"
            y="9"
            width="140"
            height="136"
            rx="6"
            fill={fill('plate')}
            stroke="#a5afb0"
          />
          <path d="M 18 10 H 142 M 11 18 V 138" stroke="#fff" opacity="0.85" />
          <Screw x={21} y={21} radius={3} metal={fill('metal')} />
          <Screw x={139} y={133} radius={3} metal={fill('metal')} />
          <rect
            x="29"
            y="31"
            width="102"
            height="92"
            rx="3"
            fill={fill('bevel')}
            stroke="#758087"
          />
          <rect x="35" y="37" width="90" height="79" rx="2" fill="#817867" stroke="#3d413e" />
          <path d="M 36 38 H 124" stroke="#b2a88f" opacity="0.65" />
          {[49, 80, 111].map((x, i) => (
            <g key={x}>
              <text
                x={x}
                y="49"
                textAnchor="middle"
                fill="#eeeadb"
                fontSize="7"
                className="refined-device-id"
              >
                {['U1', 'V1', 'W1'][i]}
              </text>
              <circle cx={x} cy="63" r="9" fill="#c4a966" stroke="#776437" />
              <Screw x={x} y={63} radius={4} metal={fill('metal')} />
              <circle cx={x} cy="94" r="9" fill="#c4a966" stroke="#776437" />
              <Screw x={x} y={94} radius={4} metal={fill('metal')} />
              <text
                x={x}
                y="111"
                textAnchor="middle"
                fill="#eeeadb"
                fontSize="7"
                className="refined-device-id"
              >
                {['U2', 'V2', 'W2'][i]}
              </text>
            </g>
          ))}
          <text
            x="80"
            y="138"
            textAnchor="middle"
            fill="#48555b"
            fontSize={locale === 'en' ? 7 : 8}
            fontWeight="600"
          >
            {t('device.art.motor')}
          </text>
        </g>
      )}

      {kind === 'supply' && (
        <g>
          <rect x="18" y="12" width="128" height="137" rx="6" fill="#283238" opacity="0.09" />
          <rect
            x="16"
            y="8"
            width="128"
            height="137"
            rx="5"
            fill={fill('plate')}
            stroke="#a5afb0"
            strokeWidth="1.2"
          />
          <path d="M 23 9 H 136 M 17 16 V 137" stroke="#fff" opacity="0.85" />
          {[26, 35, 44, 53, 62, 71, 80, 89, 98, 107, 116, 125].map((x) => (
            <g key={x} stroke="#77868d" strokeWidth="2.3" strokeLinecap="round">
              <path d={`M ${x} 18 V 32 M ${x} 124 V 135`} />
            </g>
          ))}
          <rect x="25" y="42" width="110" height="72" rx="2" fill="#eef0ef" stroke="#a4afb2" />
          <path d="M 25 44 Q 25 42 27 42 H 133 Q 135 42 135 44 V 57 H 25 Z" fill="#3d5661" />
          <text
            x="34"
            y="52.5"
            fill="#edf1f2"
            fontSize="7"
            letterSpacing="0.6"
            className="refined-device-id"
          >
            WIREBENCH / POWER
          </text>
          <text x="34" y="78" fill="#354952" fontSize={locale === 'en' ? 9 : 12} fontWeight="650">
            {t('device.art.supply')}
          </text>
          <text x="34" y="94" fill="#6b7b82" fontSize="6.3" className="refined-device-id">
            VIRTUAL POWER SUPPLY
          </text>
          <circle cx="119" cy="73" r="4" fill={active ? '#57c491' : '#75857e'} stroke="#4c6860" />
          {active && <circle cx="118" cy="72" r="1.5" fill="#d2ffe8" />}
          <text x="119" y="87" textAnchor="middle" fill="#647a78" fontSize="5">
            ON
          </text>
          <path d="M 34 104 H 80" stroke="#bbc5c9" />
          <text
            x="126"
            y="108"
            textAnchor="end"
            fill="#647780"
            fontSize="6"
            className="refined-device-id"
          >
            {id}
          </text>
        </g>
      )}

      {(kind === 'button' || kind === 'lamp') && (
        <g>
          <rect x="16" y="12" width="132" height="136" rx="7" fill="#283238" opacity="0.09" />
          <rect
            x="14"
            y="9"
            width="132"
            height="136"
            rx="6"
            fill={fill('plate')}
            stroke="#a5afb0"
            strokeWidth="1"
          />
          <path
            d="M 21 10 H 139 Q 145 10 145 16 M 15 18 V 138"
            fill="none"
            stroke="#fff"
            strokeWidth="1"
            opacity="0.9"
          />
          <path
            d="M 17 142 H 138 Q 144 142 145 136"
            fill="none"
            stroke="#949fa2"
            strokeWidth="1"
            opacity="0.6"
          />
          <Screw x={25} y={21} radius={2.9} metal={fill('metal')} />
          <Screw x={135} y={133} radius={2.9} metal={fill('metal')} />
          <ellipse cx="81" cy="76" rx="44" ry="43" fill="#1c2a31" opacity="0.1" />
          {kind === 'lamp' && (
            <circle className="refined-lamp-light" cx="80" cy="71" r="65" fill={fill('halo')} />
          )}
          <circle cx="80" cy="71" r="45" fill="#7f8b90" />
          <circle cx="80" cy="70" r="44" fill={fill('metal')} stroke="#919da1" strokeWidth="0.8" />
          <path
            d="M 39 68 A 41 41 0 0 1 92 31"
            stroke="#fff"
            strokeWidth="1.2"
            opacity="0.9"
            fill="none"
          />
          <path
            d="M 120 76 A 41 41 0 0 1 64 108"
            stroke="#68787e"
            strokeWidth="1"
            opacity="0.65"
            fill="none"
          />
          <circle
            cx="80"
            cy="70"
            r="38.5"
            fill={fill('inset')}
            stroke="#e1e5e5"
            strokeWidth="0.65"
          />

          {kind === 'button' ? (
            <g>
              <circle cx="80" cy="73" r="34.3" fill={lens.dark} />
              <path
                className="refined-button-recess"
                d="M 46 70 A 34 34 0 0 1 114 70"
                fill="none"
                stroke="#10191c"
                strokeWidth="4"
              />
              <g className="refined-button-cap">
                <circle
                  cx="80"
                  cy="71"
                  r="34"
                  fill={fill('button')}
                  stroke={lens.dark}
                  strokeWidth="1"
                />
                <path
                  d="M 50 61 A 32 32 0 0 1 96 43"
                  stroke={lens.light}
                  strokeWidth="1.5"
                  opacity="0.85"
                  fill="none"
                />
                <path
                  d="M 57 91 A 32 32 0 0 0 107 84"
                  stroke={lens.dark}
                  strokeWidth="1.1"
                  opacity="0.6"
                  fill="none"
                />
                <ellipse
                  cx="69"
                  cy="53"
                  rx="15"
                  ry="6"
                  fill="#fff"
                  opacity="0.035"
                  transform="rotate(-20 69 53)"
                />
              </g>
            </g>
          ) : (
            <g>
              <circle
                cx="80"
                cy="70"
                r="34"
                fill={fill('off')}
                stroke={lens.dark}
                strokeWidth="1"
              />
              <circle className="refined-lamp-light" cx="80" cy="70" r="34" fill={fill('on')} />
              <circle
                className="refined-lamp-light"
                cx="80"
                cy="70"
                r="33"
                fill="none"
                stroke={lens.glow}
                strokeWidth="1.7"
              />
              <ellipse
                cx="69"
                cy="51"
                rx="15"
                ry="7"
                fill="#fff"
                opacity="0.09"
                transform="rotate(-24 69 51)"
              />
              <path
                d="M 50 58 A 32 32 0 0 1 97 42"
                fill="none"
                stroke="#fff"
                strokeWidth="1.5"
                opacity="0.35"
              />
              <path
                d="M 54 92 A 32 32 0 0 0 109 85"
                fill="none"
                stroke="#030d12"
                strokeWidth="1.1"
                opacity="0.4"
              />
            </g>
          )}
          <text
            x="80"
            y="130"
            textAnchor="middle"
            fill="#48555b"
            fontSize="12"
            fontWeight="650"
            letterSpacing="0.8"
            className="refined-device-id"
          >
            {id}
          </text>
        </g>
      )}
    </g>
  );
}
