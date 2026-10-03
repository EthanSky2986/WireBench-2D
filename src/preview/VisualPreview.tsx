import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowLeft, CircuitBoard, Maximize, Minimize, Power, Square } from 'lucide-react';
import { DeviceArt } from '../components/DeviceArt';
import { RefinedDeviceArt } from '../components/RefinedDeviceArt';
import { WirePath } from '../components/WirePath';
import LanguageToggle from '../components/LanguageToggle';
import ThemeToggle from '../components/ThemeToggle';
import { roundedWirePath } from '../rendering/wireGeometry';
import { useSimulation } from '../hooks/useSimulation';
import { useBenchFullscreen, type FullscreenNotice } from '../hooks/useBenchFullscreen';
import { useI18n } from '../i18n';
import type { SimulationController } from '../hooks/useSimulation';
import { SAMPLE_TERMINALS, SAMPLE_WIRES, sampleWirePoints } from './sampleCircuit';
import './visual-preview.css';

type Treatment = 'original' | 'refined';

/** Pointer capture and focus loss both release the same momentary electrical input. */
function momentary(operate: SimulationController['operate']) {
  const release = () => operate('SB2', false);
  return {
    onPointerDown: (event: PointerEvent<HTMLElement | SVGElement>) => {
      if (event.button !== 0) return;
      // Release the previously focused control before starting this press.
      // Otherwise its native blur can cancel the newly pressed shared input.
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      operate('SB2', true);
    },
    onPointerUp: release,
    onPointerCancel: release,
    onLostPointerCapture: release,
    onBlur: release,
    onKeyDown: (event: KeyboardEvent<Element>) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      if (!event.repeat) operate('SB2', true);
    },
    onKeyUp: (event: KeyboardEvent<Element>) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      release();
    },
  };
}

function SampleBoard({
  treatment,
  simulation,
  selected,
  onSelect,
  showWires,
}: {
  treatment: Treatment;
  simulation: SimulationController;
  selected: string | null;
  onSelect: (id: string) => void;
  showWires: boolean;
}) {
  const { t } = useI18n();
  const uid = useId().replace(/:/g, '');
  const improved = treatment === 'refined';
  const Art = improved ? RefinedDeviceArt : DeviceArt;
  const { inputs, result, operate } = simulation;
  const selectedWire = SAMPLE_WIRES.find((wire) => wire.id === selected);
  const wires = [...SAMPLE_WIRES].sort(
    (a, b) => Number(a.id === selected) - Number(b.id === selected),
  );
  return (
    <svg
      viewBox="0 0 800 422"
      role="group"
      aria-label={t(`preview.board.${treatment}`)}
      className={`sample-board sample-board--${treatment}`}
    >
      <defs>
        <pattern id={`sample-slots-${uid}`} width="22" height="26" patternUnits="userSpaceOnUse">
          <rect
            x="10"
            y="5"
            width="3"
            height="12"
            rx="1.5"
            fill="var(--preview-board-pattern)"
            opacity="var(--preview-pattern-opacity)"
          />
        </pattern>
        <linearGradient id={`sample-rail-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--preview-rail-top)" />
          <stop offset=".25" stopColor="var(--preview-rail-highlight)" />
          <stop offset=".5" stopColor="var(--preview-rail-mid)" />
          <stop offset="1" stopColor="var(--preview-rail-bottom)" />
        </linearGradient>
        <linearGradient id={`sample-terminal-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor={improved ? '#bcc4ca' : '#acb7a8'} />
          <stop offset=".2" stopColor={improved ? '#edf0f2' : '#e3e6d9'} />
          <stop offset=".8" stopColor={improved ? '#dce1e4' : '#c7cfc0'} />
          <stop offset="1" stopColor={improved ? '#aeb8c0' : '#a3b09e'} />
        </linearGradient>
      </defs>
      <rect
        x="8"
        y="9"
        width="784"
        height="404"
        rx="8"
        fill="var(--preview-board-bg)"
        stroke="var(--preview-board-border)"
      />
      <rect x="10" y="10" width="780" height="400" rx="7" fill={`url(#sample-slots-${uid})`} />
      <rect
        x="104"
        y="191"
        width="668"
        height="11"
        rx="1"
        fill={`url(#sample-rail-${uid})`}
        stroke="var(--preview-rail-border)"
        strokeWidth=".6"
      />
      <g transform="translate(106 217)">
        <Art kind="contactor" id="KM1" active={result.coils.KM1} />
      </g>
      <g
        transform="translate(281 228) scale(.86)"
        role="button"
        tabIndex={0}
        aria-label={t('preview.pressInBoard', { version: t(`preview.${treatment}`) })}
        aria-pressed={!!inputs.SB2}
        className="sample-pushbutton"
        {...momentary(operate)}
      >
        <rect x="8" y="3" width="145" height="150" rx="8" className="sample-focus-ring" />
        <Art kind="button" id="SB2" active={inputs.SB2} />
      </g>
      {(['HL1', 'HL2', 'HL3'] as const).map((id, index) => (
        <g key={id} transform={`translate(${429 + index * 124} 241) scale(.69)`}>
          <Art kind="lamp" id={id} active={result.lamps[id]} />
        </g>
      ))}
      {Object.entries(SAMPLE_TERMINALS)
        .filter(([id]) => !id.startsWith('POWER'))
        .map(([id, p]) => (
          <path
            key={id}
            d={`M ${p.x} 190 V 204 Q ${p.x} 215 ${p.x + (id.startsWith('KM1') ? -5 : 0)} ${id.startsWith('KM1') ? 228 : id.startsWith('SB2') ? 238 : 251}`}
            stroke="var(--preview-fixed-wire)"
            fill="none"
            strokeWidth="1.5"
          />
        ))}
      {showWires &&
        wires.map((wire) => {
          const points = sampleWirePoints(wire);
          const path = improved
            ? roundedWirePath(points, 10)
            : `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
          return (
            <g
              key={wire.id}
              role="button"
              tabIndex={0}
              className="sample-wire"
              aria-label={t('preview.inspectWire', {
                from: wire.from,
                to: wire.to,
                version: t(`preview.${treatment}`),
              })}
              aria-pressed={selected === wire.id}
              onClick={() => onSelect(wire.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(wire.id);
                }
              }}
              opacity={selected && selected !== wire.id ? 0.22 : 1}
            >
              <path
                className="sample-wire-hit"
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth="14"
                pointerEvents="stroke"
              />
              {selected === wire.id && (
                <path
                  d={path}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="10"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity=".32"
                  pointerEvents="none"
                />
              )}
              {improved ? (
                <g pointerEvents="none">
                  <path
                    d={path}
                    fill="none"
                    stroke="var(--preview-wire-separation)"
                    strokeWidth="6.2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <WirePath points={points} color={wire.color} />
                </g>
              ) : (
                <g pointerEvents="none">
                  <path d={path} fill="none" stroke="var(--wire-halo)" strokeWidth="5.6" />
                  <path
                    d={path}
                    fill="none"
                    stroke={wire.color}
                    strokeWidth="2.8"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </g>
              )}
            </g>
          );
        })}
      {Object.entries(SAMPLE_TERMINALS).map(([id, p]) => {
        const marked = selectedWire?.from === id || selectedWire?.to === id;
        return (
          <g key={id} className="sample-terminal" pointerEvents="none">
            <rect
              x={p.x - 12}
              y={p.y - 16}
              width="24"
              height="49"
              rx="1.5"
              fill={`url(#sample-terminal-${uid})`}
              stroke={improved ? '#a2adb5' : '#98a790'}
              strokeWidth=".6"
            />
            <circle cx={p.x} cy={p.y} r="6.1" fill={improved ? '#8d989f' : '#94a391'} />
            <circle
              cx={p.x}
              cy={p.y}
              r="3.7"
              fill={improved ? '#29353d' : '#3b4d40'}
              stroke={improved ? '#cad1d5' : '#b6c1ad'}
            />
            <rect
              x={p.x - 10}
              y={p.y + 8}
              width="20"
              height="13"
              rx=".5"
              fill={improved ? '#fcfcfa' : '#edf0e3'}
            />
            <text
              x={p.x}
              y={p.y + 18}
              textAnchor="middle"
              fill={improved ? '#2d3942' : '#5e7063'}
              fontSize={id.includes('NO') ? 8 : 10}
              fontWeight="650"
            >
              {id.split(':')[1]}
            </text>
            <path
              d={`M ${p.x - 8} ${p.y + 24} h 16`}
              stroke={improved ? '#b57945' : '#c79562'}
              strokeWidth="3"
            />
            {marked && (
              <circle cx={p.x} cy={p.y} r="8" fill="none" stroke="#217955" strokeWidth="2" />
            )}
          </g>
        );
      })}
      <g
        className="sample-board-labels"
        fill="var(--preview-board-label)"
        textAnchor="middle"
        fontSize="12"
        fontWeight="600"
      >
        <text x="53" y="127">
          L / N
        </text>
        <text x="184" y="398">
          KM1 · {t(result.coils.KM1 ? 'preview.energized' : 'preview.released')}
        </text>
        <text x="351" y="398">
          SB2 · {t(inputs.SB2 ? 'preview.pressed' : 'preview.releasedButton')}
        </text>
        {['HL1', 'HL2', 'HL3'].map((id, index) => (
          <text key={id} x={484 + index * 124} y="374">
            {id} · {t(result.lamps[id] ? 'preview.on' : 'preview.off')}
          </text>
        ))}
      </g>
    </svg>
  );
}

function SmallLamps({
  treatment,
  simulation,
}: {
  treatment: Treatment;
  simulation: SimulationController;
}) {
  const { t } = useI18n();
  const Art = treatment === 'refined' ? RefinedDeviceArt : DeviceArt;
  return (
    <svg
      viewBox="0 0 300 90"
      width="300"
      height="90"
      role="img"
      aria-label={t('preview.smallLamps', { version: t(`preview.${treatment}`) })}
    >
      {['HL1', 'HL2', 'HL3'].map((id, index) => (
        <g key={id}>
          <g transform={`translate(${index * 100 + 22} 4) scale(.35)`}>
            <Art kind="lamp" id={id} active={simulation.result.lamps[id]} />
          </g>
          <text
            x={index * 100 + 50}
            y="79"
            textAnchor="middle"
            fontSize="10"
            fill="var(--text-secondary)"
          >
            {id} · {t(simulation.result.lamps[id] ? 'preview.on' : 'preview.off')}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function VisualPreview() {
  const { t } = useI18n();
  const simulation = useSimulation(SAMPLE_WIRES);
  const [selected, setSelected] = useState<string | null>(null);
  const [showWires, setShowWires] = useState(true);
  const [notice, setNotice] = useState<FullscreenNotice | null>(null);
  const { rootRef, expanded, toggle } = useBenchFullscreen(setNotice);
  const selectedWire = SAMPLE_WIRES.find((wire) => wire.id === selected);
  const status = !simulation.powered
    ? 'preview.powerOff'
    : simulation.result.coils.KM1
      ? 'preview.holding'
      : 'preview.ready';
  return (
    <div ref={rootRef} className="visual-preview">
      <header className="preview-header">
        <a href="/" className="preview-back">
          <ArrowLeft size={16} />
          {t('preview.back')}
        </a>
        <a href="/" className="preview-brand">
          <CircuitBoard size={21} />
          <strong>WireBench</strong>
          <span>{t('preview.study')}</span>
        </a>
        <div className="preview-header-actions">
          <LanguageToggle />
          <ThemeToggle />
          <button
            className="preview-fullscreen"
            onClick={() => void toggle()}
            aria-label={t(expanded ? 'ui.action.exitFullscreen' : 'ui.action.fullscreen')}
          >
            {expanded ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>
        </div>
      </header>
      <main className="preview-content">
        <div className="preview-heading">
          <div>
            <p className="preview-eyebrow">01 / {t('preview.study')}</p>
            <h1>{t('preview.title')}</h1>
            <p>{t('preview.description')}</p>
          </div>
          <span className={`preview-status ${simulation.result.coils.KM1 ? 'running' : ''}`}>
            <i />
            {t(status)}
          </span>
        </div>
        <div className="preview-controls">
          <button
            className={`preview-power ${simulation.powered ? 'is-powered' : ''}`}
            onClick={() => simulation.setPower(!simulation.powered)}
          >
            {simulation.powered ? <Square size={14} /> : <Power size={16} />}
            {t(simulation.powered ? 'ui.action.powerOff' : 'ui.action.powerOn')}
          </button>
          <button
            className={`preview-start ${simulation.inputs.SB2 ? 'is-pressed' : ''}`}
            aria-pressed={!!simulation.inputs.SB2}
            {...momentary(simulation.operate)}
          >
            {t('preview.start')}
          </button>
          <span className="preview-instruction">{t('preview.instructions')}</span>
        </div>
        <div className="preview-comparison">
          {(['original', 'refined'] as const).map((treatment) => (
            <section
              key={treatment}
              className={`preview-panel preview-panel--${treatment}`}
              aria-label={t(`preview.${treatment}`)}
            >
              <div className="preview-panel-heading">
                <div>
                  <span>{treatment === 'original' ? 'A' : 'B'}</span>
                  <h2>{t(`preview.${treatment}`)}</h2>
                </div>
                <p>{t(`preview.caption.${treatment}`)}</p>
              </div>
              <SampleBoard
                treatment={treatment}
                simulation={simulation}
                selected={selected}
                onSelect={(id) => setSelected(selected === id ? null : id)}
                showWires={showWires}
              />
              <div className="preview-small">
                <span>{t('preview.overview')}</span>
                <SmallLamps treatment={treatment} simulation={simulation} />
              </div>
            </section>
          ))}
        </div>
        <div className="preview-wire-tools">
          <button aria-pressed={showWires} onClick={() => setShowWires(!showWires)}>
            {t(showWires ? 'preview.hideWires' : 'preview.showWires')}
          </button>
          {selectedWire ? (
            <>
              <span>
                <code>{selectedWire.from}</code> → <code>{selectedWire.to}</code>
              </span>
              <button onClick={() => setSelected(null)}>{t('preview.clearSelection')}</button>
            </>
          ) : (
            <span>{t('preview.wireHint')}</span>
          )}
        </div>
        <div className="preview-notes">
          <p>
            <strong>{t('preview.lookLamps')}</strong>
            {t('preview.lookLampsDetail')}
          </p>
          <p>
            <strong>{t('preview.lookButton')}</strong>
            {t('preview.lookButtonDetail')}
          </p>
          <p>
            <strong>{t('preview.lookWire')}</strong>
            {t('preview.lookWireDetail')}
          </p>
        </div>
        <footer className="preview-footer">{t('preview.footer')}</footer>
        {notice && (
          <p className="preview-notice" role="status">
            {t(notice)}
            <button onClick={() => setNotice(null)}>{t('ui.notice.close')}</button>
          </p>
        )}
      </main>
    </div>
  );
}
