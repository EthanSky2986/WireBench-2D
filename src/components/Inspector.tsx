import { useEffect } from 'react';
import {
  ArrowRight,
  Cable,
  CircuitBoard,
  History,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { RefinedDeviceArt } from './RefinedDeviceArt';
import ThermalControls from './ThermalControls';
import ColorPicker from './ColorPicker';
import { CONTACTS, DEVICE_MAP } from '../sim/model';
import type { Wire } from '../sim/model';
import type { SimulationResult } from '../sim/engine';
import { friendlyTerminal, localizeDevice } from '../layout';
import { useI18n } from '../i18n';

interface InspectorProps {
  selected: string | null;
  wire: Wire | undefined;
  inputs: Record<string, boolean>;
  result: SimulationResult;
  powered: boolean;
  events: string[];
  onWireChange: (wire: Wire) => void;
  onRemoveWire: () => void;
  onOperate: (deviceId: string, active: boolean) => void;
}

/** Presents the selected object; persistent wire changes remain owned by App. */
export default function Inspector({
  selected,
  wire,
  inputs,
  result,
  powered,
  events,
  onWireChange,
  onRemoveWire,
  onOperate,
}: InspectorProps) {
  const { locale, t } = useI18n();
  const device = selected ? DEVICE_MAP[selected] : null;
  const deviceName = device ? localizeDevice(device, locale) : '';
  const contacts = device ? CONTACTS.filter((contact) => contact.deviceId === device.id) : [];
  const active = device
    ? device.kind === 'supply'
      ? powered
      : !!(result.coils[device.id] || result.lamps[device.id] || inputs[device.id])
    : false;
  const buttonId = !wire && device?.kind === 'button' ? device.id : null;

  // A removed/replaced momentary control must never leave its input latched.
  useEffect(() => {
    if (!buttonId) return;
    return () => onOperate(buttonId, false);
  }, [buttonId, onOperate]);

  return (
    <aside className="inspector">
      <div className="inspector-heading">
        <span>{wire ? t('inspector.wireTitle') : t('inspector.deviceTitle')}</span>
        <SlidersHorizontal size={15} />
      </div>
      {wire ? (
        <>
          <div className="wire-preview">
            <Cable size={40} style={{ color: wire.color }} />
            <span>{t('inspector.userWire')}</span>
          </div>
          <div className="inspector-content">
            <h2>{t('inspector.connections')}</h2>
            <div className="wire-endpoint">
              <span>{t('inspector.from')}</span>
              <code>{friendlyTerminal(wire.from)}</code>
            </div>
            <div className="endpoint-line">
              <ArrowRight size={15} />
            </div>
            <div className="wire-endpoint">
              <span>{t('inspector.to')}</span>
              <code>{friendlyTerminal(wire.to)}</code>
            </div>
            <div className="detail-label">{t('inspector.wireColor')}</div>
            <ColorPicker
              value={wire.color}
              disabled={powered}
              context="selected-wire"
              onChange={(color) => onWireChange({ ...wire, color })}
            />
            <p className="inspector-hint">{t('inspector.routingHint')}</p>
            <button
              className="button outline full"
              disabled={powered || !wire.points}
              onClick={() => {
                const { points, ...rest } = wire;
                void points;
                onWireChange(rest);
              }}
            >
              {t('inspector.autoRoute')}
            </button>
            <button className="button danger full" disabled={powered} onClick={onRemoveWire}>
              <Trash2 size={15} /> {t('inspector.deleteWire')}
            </button>
          </div>
        </>
      ) : device ? (
        <>
          <div className={`device-preview ${active ? 'active' : ''}`}>
            <div className="preview-grid" />
            <svg viewBox="0 0 180 175" role="img" aria-label={deviceName}>
              <g transform="translate(10 6)">
                <RefinedDeviceArt
                  kind={device.kind}
                  id={device.id}
                  active={active}
                  tripped={!!inputs[device.id]}
                  panelMounted={device.kind === 'lamp'}
                />
              </g>
            </svg>
            <span
              className={`device-status ${active ? (device.kind === 'thermal' ? 'thermal-tripped' : 'active') : ''}`}
            >
              <i />
              {device.kind === 'contactor'
                ? active
                  ? t('inspector.energized')
                  : t('inspector.released')
                : device.kind === 'lamp'
                  ? active
                    ? t('inspector.lit')
                    : t('inspector.unlit')
                  : device.kind === 'thermal'
                    ? active
                      ? t('inspector.tripped')
                      : t('inspector.normal')
                    : device.kind === 'motor'
                      ? t('inspector.reserved')
                      : device.kind === 'supply'
                        ? powered
                          ? t('inspector.powered')
                          : t('inspector.unpowered')
                        : active
                          ? t('inspector.actuated')
                          : t('inspector.initial')}
            </span>
          </div>
          <div className="inspector-content">
            <div className="device-title">
              <h2>{device.id === 'ESTOP' ? 'E-STOP' : device.id}</h2>
              <span>{t('inspector.terminalCount', { count: device.terminals.length })}</span>
            </div>
            <p className="device-description">{deviceName}</p>
            {device.kind === 'thermal' && (
              <ThermalControls
                id={device.id}
                tripped={active}
                surface="inspector"
                onOperate={onOperate}
              />
            )}
            {['button', 'limit', 'estop'].includes(device.kind) && (
              <button
                className={`button operate full ${active ? 'pressed' : ''}`}
                aria-label={t('inspector.operate', { id: device.id })}
                onPointerDown={(e) => {
                  if (device.kind === 'button') {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    onOperate(device.id, true);
                  }
                }}
                onPointerUp={() => {
                  if (device.kind === 'button') onOperate(device.id, false);
                }}
                onPointerCancel={() => {
                  if (device.kind === 'button') onOperate(device.id, false);
                }}
                onLostPointerCapture={() => {
                  if (device.kind === 'button') onOperate(device.id, false);
                }}
                onBlur={() => {
                  if (device.kind === 'button') onOperate(device.id, false);
                }}
                onClick={() => {
                  if (device.kind !== 'button') onOperate(device.id, !inputs[device.id]);
                }}
                onKeyDown={(e) => {
                  if (device.kind === 'button' && (e.key === ' ' || e.key === 'Enter')) {
                    e.preventDefault();
                    onOperate(device.id, true);
                  }
                }}
                onKeyUp={(e) => {
                  if (device.kind === 'button' && (e.key === ' ' || e.key === 'Enter')) {
                    e.preventDefault();
                    onOperate(device.id, false);
                  }
                }}
              >
                {device.kind === 'button'
                  ? active
                    ? t('inspector.releaseAction')
                    : t('inspector.holdAction')
                  : active
                    ? t('inspector.resetAction')
                    : t('inspector.triggerAction')}
              </button>
            )}
            {device.kind === 'contactor' && (
              <div className="coil-row">
                <span>{t('inspector.coil')}</span>
                <b className={active ? 'on' : ''}>
                  {active ? t('inspector.coilOn') : t('inspector.coilOff')}
                </b>
              </div>
            )}
            {contacts.length > 0 && (
              <>
                <div className="detail-label">
                  {t('inspector.contacts')} <span>{t('inspector.live')}</span>
                </div>
                <div className="contacts">
                  {contacts.map((c) => {
                    const closed = result.closedContacts.includes(c.id);
                    return (
                      <div className="contact-row" key={c.id}>
                        <svg width="31" height="17" viewBox="0 0 31 17" aria-hidden="true">
                          <path d="M0 12H8M24 12H31" stroke="currentColor" fill="none" />
                          <circle cx="9" cy="12" r="1.8" fill="currentColor" />
                          <circle cx="23" cy="12" r="1.8" fill="currentColor" />
                          <path
                            d={closed ? 'M9 12H23' : 'M9 12L21 3'}
                            stroke={closed ? '#278968' : '#8a958e'}
                            strokeWidth="1.6"
                          />
                        </svg>
                        <code>
                          {c.from.split(':')[1]}–{c.to.split(':')[1]}
                        </code>
                        <small>
                          {c.behavior === 'through' ? t('inspector.through') : c.behavior}
                        </small>
                        <span className={closed ? 'closed' : ''}>
                          {closed ? t('inspector.closed') : t('inspector.open')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {device.kind === 'contactor' && (
              <p className="inspector-hint">{t('inspector.contactorHint')}</p>
            )}
            {device.kind === 'lamp' && <p className="inspector-hint">{t('inspector.lampHint')}</p>}
            {device.kind === 'thermal' && (
              <p className="inspector-hint">{t('inspector.thermalHint')}</p>
            )}
            {device.kind === 'estop' && (
              <p className="inspector-hint">{t('inspector.estopHint')}</p>
            )}
            {device.kind === 'motor' && (
              <p className="inspector-hint">{t('inspector.motorHint')}</p>
            )}
            {device.kind === 'supply' && (
              <p className="inspector-hint">{t('inspector.supplyHint')}</p>
            )}
          </div>
        </>
      ) : (
        <div className="inspector-empty">
          <CircuitBoard size={30} />
          {t('inspector.empty')}
        </div>
      )}
      <div className="activity">
        <div className="detail-label">
          <History size={13} /> {t('inspector.activity')}
        </div>
        <div aria-live="polite">
          {events.slice(0, 3).map((event, i) => (
            <div className="event" key={`${event}-${i}`}>
              <i />
              <span>{event}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="model-note">
        <ShieldCheck size={15} />
        <p>
          {t('inspector.model')}
          <span>{t('inspector.modelHint')}</span>
        </p>
      </div>
    </aside>
  );
}
