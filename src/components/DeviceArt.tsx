import { useId } from 'react';
import { useI18n } from '../i18n';

export type DeviceArtKind =
  'contactor' | 'thermal' | 'button' | 'limit' | 'estop' | 'lamp' | 'motor' | 'supply';

export interface DeviceArtProps {
  kind: DeviceArtKind;
  id: string;
  active?: boolean;
  tripped?: boolean;
  /** Lamp lens mounted in the bench's shared enclosure, without an individual faceplate. */
  panelMounted?: boolean;
}

const mono = "'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace";

function Screw({
  x,
  y,
  radius = 5,
  dark = false,
}: {
  x: number;
  y: number;
  radius?: number;
  dark?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={radius + 2} fill={dark ? '#11191b' : '#556363'} />
      <circle
        r={radius}
        fill={dark ? '#667171' : '#b9c3be'}
        stroke={dark ? '#374645' : '#e5e8df'}
        strokeWidth="0.6"
      />
      <path
        d={`M ${-radius + 1.4} 0 H ${radius - 1.4} M 0 ${-radius + 1.4} V ${radius - 1.4}`}
        stroke="#344342"
        strokeWidth="1.4"
      />
      <path
        d={`M ${-radius + 1.4} -0.8 H ${radius - 1.4}`}
        stroke="#e9ece2"
        strokeWidth="0.5"
        opacity="0.65"
      />
    </g>
  );
}

/** Self-contained device artwork in a 160 × 160 coordinate space.
 * All interaction and accessible labels are owned by the enclosing device.
 */
export function DeviceArt({ kind, id, active = false, tripped = false }: DeviceArtProps) {
  const { locale, t } = useI18n();
  const uid = `art-${useId().replace(/:/g, '')}`;
  const g = (name: string) => `url(#${uid}-${name})`;
  const tone = (kind === 'lamp' ? id.endsWith('1') : id.endsWith('3'))
    ? 'amber'
    : id.endsWith('2')
      ? 'green'
      : 'red';
  const colors = {
    amber: { light: '#fff093', mid: '#eeb838', dark: '#8e5a13', glow: '#efbf4b', pale: '#fff5bd' },
    green: { light: '#73d7b0', mid: '#249170', dark: '#095348', glow: '#3bc48f', pale: '#c4f5dd' },
    red: { light: '#f58d78', mid: '#c8483c', dark: '#762d2a', glow: '#ed6b54', pale: '#ffd6c5' },
  }[tone];

  return (
    <g aria-hidden="true" className={`device-art device-art--${kind}`}>
      <defs>
        <linearGradient id={`${uid}-housing`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#737f7b" />
          <stop offset="0.45" stopColor="#4c5a56" />
          <stop offset="1" stopColor="#35413e" />
        </linearGradient>
        <linearGradient id={`${uid}-black`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3c4847" />
          <stop offset="1" stopColor="#222e2c" />
        </linearGradient>
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2f2e9" />
          <stop offset="0.22" stopColor="#c3cdc7" />
          <stop offset="0.48" stopColor="#8b9995" />
          <stop offset="0.7" stopColor="#e5e7dd" />
          <stop offset="1" stopColor="#929f9a" />
        </linearGradient>
        <linearGradient id={`${uid}-panel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ebece4" />
          <stop offset="1" stopColor="#c4ccc3" />
        </linearGradient>
        <radialGradient id={`${uid}-lens`} cx="38%" cy="28%" r="77%">
          <stop offset="0" stopColor={active ? colors.light : colors.mid} />
          <stop offset="0.6" stopColor={colors.mid} />
          <stop offset="1" stopColor={colors.dark} />
        </radialGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor={colors.glow} stopOpacity="0.4" />
          <stop offset="0.75" stopColor={colors.glow} stopOpacity="0.17" />
          <stop offset="1" stopColor={colors.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-blue`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#416887" />
          <stop offset="0.5" stopColor="#2d4b6c" />
          <stop offset="1" stopColor="#203954" />
        </linearGradient>
        <linearGradient id={`${uid}-estop`} x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#dd5c47" />
          <stop offset="0.4" stopColor="#c94837" />
          <stop offset="1" stopColor="#9b312b" />
        </linearGradient>
      </defs>

      {kind === 'contactor' && (
        <g>
          <rect x="26" y="8" width="108" height="148" rx="5" fill="#26312e" opacity="0.16" />
          <path
            d="M 26 4 H 134 V 19 H 143 V 146 H 17 V 19 H 26 Z"
            fill={g('housing')}
            stroke="#384742"
            strokeWidth="1.5"
          />
          <path d="M 18 24 H 142 M 18 137 H 142" stroke="#88958b" strokeWidth="2" />
          {[29, 61, 93, 125].map((x, i) => (
            <g key={`top-${x}`}>
              <rect x={x - 10} y="12" width="20" height="24" rx="3" fill="#263631" />
              <Screw x={x} y={26} radius={4.5} dark />
              <text
                x={x}
                y="11"
                textAnchor="middle"
                fill="#e0e6db"
                fontFamily={mono}
                fontSize="5.8"
              >
                {['1 L1', '3 L2', '5 L3', '13 NO'][i]}
              </text>
            </g>
          ))}
          <rect
            x="25"
            y="43"
            width="110"
            height="77"
            rx="2"
            fill={g('black')}
            stroke="#202d29"
            strokeWidth="1.3"
          />
          <path d="M 27 45 H 133" stroke="#87928b" strokeWidth="1" opacity="0.6" />
          {[39, 66, 93, 120].map((x, i) => (
            <g key={`aux-${x}`}>
              <text
                x={x}
                y="53"
                textAnchor="middle"
                fill="#e6e8de"
                fontFamily={mono}
                fontSize="5.8"
              >
                {['53', '61', '71', '83'][i]}
              </text>
              <Screw x={x} y={62} radius={4} dark />
              <Screw x={x} y={106} radius={4} dark />
              <text
                x={x}
                y="117"
                textAnchor="middle"
                fill="#e6e8de"
                fontFamily={mono}
                fontSize="5.8"
              >
                {['54', '62', '72', '84'][i]}
              </text>
            </g>
          ))}
          <text x="34" y="78" fill="#d5dfd4" fontSize="8" fontWeight="650" letterSpacing="0.3">
            EasyTeSys
          </text>
          <text x="117" y="89" textAnchor="end" fill="#aebdb3" fontSize="6" fontFamily={mono}>
            LANN22
          </text>
          <rect x="73" y="78" width="13" height="22" rx="1" fill="#121f19" />
          <rect
            x="75"
            y={active ? 79 : 85}
            width="9"
            height={active ? 19 : 11}
            rx="0.7"
            fill={active ? '#f4b82f' : '#a77e35'}
          />
          {active && <path d="M 78 82 V 94" stroke="#ffe9a6" strokeWidth="2" opacity="0.8" />}
          {[29, 61, 93, 125].map((x, i) => (
            <g key={`bottom-${x}`}>
              <rect x={x - 10} y="125" width="20" height="17" rx="2" fill="#263631" />
              <Screw x={x} y={131} radius={4} dark />
              <text
                x={x}
                y="149"
                textAnchor="middle"
                fill="#56645e"
                fontFamily={mono}
                fontSize="5.8"
              >
                {['2 T1', '4 T2', '6 T3', '14 NO'][i]}
              </text>
            </g>
          ))}
          <rect x="35" y="151" width="90" height="8" rx="1.5" fill="#abb9a9" />
          <text
            x="80"
            y="157"
            textAnchor="middle"
            fill="#354f43"
            fontSize="5.5"
            fontFamily={mono}
            letterSpacing="1"
          >
            {id} · AC CONTACTOR
          </text>
        </g>
      )}

      {kind === 'thermal' && (
        <g>
          <rect x="22" y="15" width="118" height="139" rx="6" fill="#24312b" opacity="0.15" />
          <rect
            x="21"
            y="9"
            width="118"
            height="137"
            rx="4"
            fill={g('housing')}
            stroke="#384740"
            strokeWidth="1.5"
          />
          {[44, 80, 116].map((x, i) => (
            <g key={x}>
              <rect x={x - 12} y="12" width="24" height="31" rx="2" fill="#26352f" />
              <text
                x={x}
                y="21"
                textAnchor="middle"
                fill="#d2dfd5"
                fontSize="6"
                fontFamily={mono}
              >{`L${i + 1}`}</text>
              <Screw x={x} y={32} dark />
              <Screw x={x} y={135} radius={4.5} dark />
              <text
                x={x}
                y="154"
                textAnchor="middle"
                fill="#677568"
                fontSize="6"
                fontFamily={mono}
              >{`T${i + 1}`}</text>
            </g>
          ))}
          <rect
            x="27"
            y="47"
            width="106"
            height="72"
            rx="3"
            fill="#24312e"
            stroke="#a2afa0"
            strokeWidth="1.5"
          />
          <path
            d="M 29 49 H 130 V 116 H 29 Z"
            fill="#758877"
            fillOpacity="0.16"
            stroke="#45574b"
            strokeWidth="0.7"
          />
          <text x="35" y="60" fill="#c3d3c4" fontSize="6.5" fontWeight="600">
            THERMAL RELAY
          </text>
          <circle cx="52" cy="87" r="15" fill="#6c7b6d" stroke="#a6b5a4" strokeWidth="1" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
            <path
              key={angle}
              d="M 52 70 V 73"
              stroke="#bcc7b5"
              strokeWidth="1"
              transform={`rotate(${angle} 52 87)`}
            />
          ))}
          <circle cx="52" cy="87" r="10" fill="#b9c2ad" />
          <path d="M 48 92 L 57 80" stroke="#3f5145" strokeWidth="3" strokeLinecap="round" />
          <rect
            x="76"
            y="72"
            width="22"
            height="20"
            rx="2"
            fill={tripped ? '#b7533c' : '#bbbab1'}
            stroke="#162920"
          />
          <text x="87" y="101" textAnchor="middle" fill="#c4d0bc" fontSize="5">
            TEST
          </text>
          <rect x="105" y="71" width="16" height="23" rx="2" fill="#a94033" stroke="#222f25" />
          <path d="M 108 74 H 118" stroke="#d77d63" strokeWidth="2" />
          <text x="113" y="102" textAnchor="middle" fill="#c4d0bc" fontSize="5">
            RESET
          </text>
          <rect
            x="75"
            y="108"
            width="47"
            height="5"
            rx="1"
            fill={tripped ? '#e99751' : '#526954'}
          />
          <text x="36" y="114" fill="#b6c8b7" fontSize="6" fontFamily={mono}>
            {id}
          </text>
        </g>
      )}

      {kind === 'limit' && (
        <g>
          <rect x="47" y="66" width="68" height="91" rx="5" fill="#233947" opacity="0.15" />
          <rect
            x="46"
            y="65"
            width="68"
            height="87"
            rx="4"
            fill={g('blue')}
            stroke="#223c53"
            strokeWidth="1.5"
          />
          <path d="M 48 94 H 112 M 51 99 V 147" stroke="#69849a" strokeWidth="1" opacity="0.6" />
          <rect x="47" y="55" width="66" height="38" rx="5" fill={g('blue')} stroke="#213f56" />
          <Screw x={55} y={66} radius={3} />
          <Screw x={105} y={66} radius={3} />
          <g transform={`rotate(${active ? 31 : -17} 80 65)`}>
            <path
              d="M 72 66 L 74 23 Q 80 18 86 23 L 88 66 Z"
              fill={g('metal')}
              stroke="#7e908b"
              strokeWidth="1"
            />
            <circle cx="80" cy="24" r="21" fill="#233033" stroke="#121d22" strokeWidth="1.5" />
            <circle cx="80" cy="24" r="16" fill="#313f43" stroke="#465353" strokeWidth="1" />
            <circle cx="80" cy="24" r="8" fill={g('metal')} stroke="#9eaaa1" />
            <path d="M 65 15 A 17 17 0 0 1 82 7" stroke="#626e6c" strokeWidth="1.5" fill="none" />
          </g>
          <circle cx="80" cy="66" r="13" fill={g('metal')} stroke="#788b84" />
          <Screw x={80} y={66} radius={6} />
          <rect x="52" y="101" width="9" height="38" rx="0.6" fill="#b9c8c8" />
          <text
            transform="translate(59 138) rotate(-90)"
            fill="#3b566d"
            fontSize="5.8"
            fontWeight="600"
            letterSpacing="0.7"
          >
            LIMIT SWITCH
          </text>
          <text x="87" y="116" textAnchor="middle" fill="#d1deda" fontFamily={mono} fontSize="12">
            {id}
          </text>
          <text x="87" y="131" textAnchor="middle" fill="#aabfca" fontSize="7">
            {t(active ? 'device.art.triggered' : 'device.art.limit')}
          </text>
          <path d="M 70 152 V 160 M 78 152 V 160 M 86 152 V 160" stroke="#6c807c" strokeWidth="3" />
        </g>
      )}

      {kind === 'button' && (
        <g>
          <rect x="16" y="15" width="128" height="135" rx="7" fill="#263a30" opacity="0.13" />
          <rect
            x="14"
            y="10"
            width="132"
            height="135"
            rx="6"
            fill={g('panel')}
            stroke="#9ca99e"
            strokeWidth="1.2"
          />
          <Screw x={25} y={22} radius={3.3} />
          <Screw x={135} y={133} radius={3.3} />
          <circle cx="80" cy="73" r="44" fill="#65766d" opacity="0.15" transform="translate(1 4)" />
          <circle cx="80" cy="73" r="43" fill={g('metal')} stroke="#9aa69b" strokeWidth="1" />
          <circle cx="80" cy="73" r="36" fill="#283d31" stroke="#596e60" strokeWidth="1.5" />
          <circle
            cx="80"
            cy={active ? 74 : 71}
            r={active ? 30 : 32}
            fill={g('lens')}
            stroke={colors.dark}
            strokeWidth="1.5"
          />
          <path
            d={active ? 'M 59 56 A 27 27 0 0 1 98 55' : 'M 56 52 A 31 31 0 0 1 101 50'}
            fill="none"
            stroke={colors.light}
            strokeWidth="2"
            opacity={active ? 0.25 : 0.5}
            strokeLinecap="round"
          />
          {active && <circle cx="80" cy="74" r="26" fill="#172e24" fillOpacity="0.15" />}
          <text
            x="80"
            y="130"
            textAnchor="middle"
            fill="#42574b"
            fontFamily={mono}
            fontSize="12"
            fontWeight="600"
            letterSpacing="1"
          >
            {id}
          </text>
        </g>
      )}

      {kind === 'estop' && (
        <g>
          <rect
            x="14"
            y="10"
            width="132"
            height="135"
            rx="6"
            fill={g('panel')}
            stroke="#9ca99e"
            strokeWidth="1.2"
          />
          <Screw x={25} y={22} radius={3.3} />
          <Screw x={135} y={133} radius={3.3} />
          <circle cx="80" cy="72" r="49" fill="#d4bc4c" stroke="#baa543" strokeWidth="1" />
          <circle cx="80" cy="76" r="36" fill="#4c4840" />
          <circle cx="80" cy="71" r={active ? 39 : 44} fill="#842f29" />
          <circle
            cx="80"
            cy={active ? 74 : 67}
            r={active ? 37 : 43}
            fill={g('estop')}
            stroke="#a84031"
            strokeWidth="1.4"
          />
          {Array.from({ length: 32 }, (_, i) => (
            <path
              key={i}
              d={active ? 'M 80 40 V 43' : 'M 80 27 V 30'}
              transform={`rotate(${i * 11.25} 80 ${active ? 74 : 67})`}
              stroke="#eb7e5d"
              strokeWidth="1"
              opacity="0.35"
            />
          ))}
          <g
            transform={active ? 'translate(0 7)' : undefined}
            fill="none"
            stroke="#7f332b"
            strokeWidth="1.4"
            opacity="0.8"
          >
            <path d="M 59 61 A 23 23 0 0 1 89 46 M 89 46 L 83 46 M 89 46 L 88 40" />
            <path d="M 101 75 A 23 23 0 0 1 72 89 M 72 89 L 78 89 M 72 89 L 73 95" />
          </g>
          <text
            x="80"
            y="131"
            textAnchor="middle"
            fill="#42574b"
            fontFamily={mono}
            fontSize="10"
            fontWeight="650"
            letterSpacing="0.7"
          >
            E-STOP
          </text>
        </g>
      )}

      {kind === 'lamp' && (
        <g>
          <rect
            x="17"
            y="12"
            width="126"
            height="132"
            rx="6"
            fill={g('panel')}
            stroke="#9caa9f"
            strokeWidth="1"
          />
          <Screw x={27} y={23} radius={3} />
          <Screw x={133} y={133} radius={3} />
          {active && <circle cx="80" cy="73" r="66" fill={g('glow')} />}
          <circle cx="80" cy="75" r="43" fill="#778578" opacity="0.2" />
          <circle cx="80" cy="71" r="42" fill={g('metal')} stroke="#95a598" />
          <circle cx="80" cy="71" r="35" fill="#223d2e" stroke="#54685a" strokeWidth="1.5" />
          <circle cx="80" cy="71" r="31" fill={g('lens')} stroke={colors.dark} strokeWidth="1.2" />
          {active && <circle cx="80" cy="69" r="25" fill={colors.pale} fillOpacity="0.3" />}
          <path
            d="M 58 52 A 29 29 0 0 1 96 48"
            fill="none"
            stroke={colors.light}
            strokeWidth={active ? 4 : 2}
            opacity={active ? 0.8 : 0.35}
            strokeLinecap="round"
          />
          <path
            d="M 59 90 A 28 28 0 0 0 97 94"
            fill="none"
            stroke={colors.dark}
            strokeWidth="1.2"
            opacity="0.4"
          />
          <text
            x="80"
            y="129"
            textAnchor="middle"
            fill="#42574b"
            fontFamily={mono}
            fontSize="12"
            fontWeight="600"
            letterSpacing="1"
          >
            {id}
          </text>
        </g>
      )}

      {kind === 'motor' && (
        <g>
          <rect x="12" y="15" width="136" height="135" rx="7" fill="#284035" opacity="0.13" />
          <rect
            x="10"
            y="10"
            width="140"
            height="135"
            rx="6"
            fill={g('panel')}
            stroke="#96a89a"
            strokeWidth="1.2"
          />
          <Screw x={21} y={22} radius={3.5} />
          <Screw x={139} y={132} radius={3.5} />
          <rect
            x="29"
            y="31"
            width="102"
            height="91"
            rx="3"
            fill="#333f37"
            stroke="#8d9b8c"
            strokeWidth="1.5"
          />
          <rect x="35" y="37" width="90" height="79" rx="2" fill="#8a8170" />
          {[49, 80, 111].map((x, i) => (
            <g key={x}>
              <text x={x} y="49" textAnchor="middle" fill="#e5e2cf" fontFamily={mono} fontSize="7">
                {['U1', 'V1', 'W1'][i]}
              </text>
              <circle cx={x} cy="63" r="9" fill="#bda35c" stroke="#655b38" />
              <Screw x={x} y={63} radius={4} />
              <circle cx={x} cy="94" r="9" fill="#bda35c" stroke="#655b38" />
              <Screw x={x} y={94} radius={4} />
              <text x={x} y="111" textAnchor="middle" fill="#e5e2cf" fontFamily={mono} fontSize="7">
                {['U2', 'V2', 'W2'][i]}
              </text>
            </g>
          ))}
          <text
            x="80"
            y="138"
            textAnchor="middle"
            fill="#52644f"
            fontSize={locale === 'en' ? 7 : 8}
            fontWeight="600"
          >
            {t('device.art.motor')}
          </text>
        </g>
      )}

      {kind === 'supply' && (
        <g>
          <rect x="18" y="13" width="124" height="137" rx="5" fill="#324637" opacity="0.15" />
          <rect
            x="16"
            y="8"
            width="128"
            height="137"
            rx="5"
            fill={g('panel')}
            stroke="#98a999"
            strokeWidth="1.4"
          />
          {[26, 35, 44, 53, 62, 71, 80, 89, 98, 107, 116, 125].map((x) => (
            <g key={x} stroke="#899b8c" strokeWidth="2.5" strokeLinecap="round">
              <path d={`M ${x} 18 V 32 M ${x} 124 V 135`} />
            </g>
          ))}
          <rect x="25" y="42" width="110" height="72" rx="2" fill="#e8eadf" stroke="#a4b09f" />
          <rect x="25" y="42" width="110" height="15" fill="#45674f" />
          <text x="34" y="52.5" fill="#edf0e3" fontSize="7" fontFamily={mono} letterSpacing="0.6">
            WIREBENCH / POWER
          </text>
          <text x="34" y="78" fill="#38513e" fontSize={locale === 'en' ? 9 : 12} fontWeight="650">
            {t('device.art.supply')}
          </text>
          <text x="34" y="94" fill="#738371" fontSize="6.3" fontFamily={mono}>
            VIRTUAL POWER SUPPLY
          </text>
          <circle cx="119" cy="73" r="4" fill={active ? '#6abc79' : '#7f8c7b'} stroke="#577452" />
          {active && <circle cx="118" cy="72" r="1.5" fill="#ccf2b6" />}
          <text x="119" y="87" textAnchor="middle" fill="#71846e" fontSize="5">
            ON
          </text>
          <path d="M 34 104 H 80" stroke="#aebca6" strokeWidth="1" />
          <text x="126" y="108" textAnchor="end" fill="#71816b" fontFamily={mono} fontSize="6">
            {id}
          </text>
        </g>
      )}
    </g>
  );
}
